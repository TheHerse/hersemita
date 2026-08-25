import { NextResponse } from "next/server";
import { checkRateLimit, clientIpFromHeaders, rateLimitKey } from "@/lib/rate-limit";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { setRunnerSession } from "@/lib/runner-session";
import { hashRunnerAccessCode, verifyRunnerAccessCode } from "@/lib/runner-credentials";
import { hasTrustedRequestOrigin } from "@/lib/request-origin";
import { isPlainObject, readBoundedJson } from "@/lib/request-body";
import { logSecurityEvent, securityReference } from "@/lib/security-events";

const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 8;

function normalizeUsername(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeCode(value: unknown) {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

export async function POST(request: Request) {
  if (!hasTrustedRequestOrigin(request)) {
    await logSecurityEvent({ actorType: "anonymous", actorReference: securityReference(clientIpFromHeaders(request.headers)), eventType: "origin.rejected", severity: "high", route: "/api/runner-login", outcome: "blocked" });
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }
  const parsedBody = await readBoundedJson(request, 2 * 1024);
  if (!parsedBody.ok) {
    return NextResponse.json({ error: parsedBody.error }, { status: parsedBody.status });
  }
  const body = isPlainObject(parsedBody.value) ? parsedBody.value : null;
  const username = normalizeUsername(body?.username);
  const code = normalizeCode(body?.code);
  const limit = await checkRateLimit({
    key: rateLimitKey(["runner-login", clientIpFromHeaders(request.headers), username]),
    windowMs: WINDOW_MS,
    max: MAX_ATTEMPTS,
  });

  if (!username || !/^[A-Z0-9]{8,16}$/.test(code)) {
    await logSecurityEvent({ actorType: "anonymous", actorReference: securityReference(username || clientIpFromHeaders(request.headers)), eventType: "auth.failed", severity: "warning", route: "/api/runner-login", outcome: "invalid_credentials" });
    return NextResponse.json({ error: "Invalid username or passcode" }, { status: 401 });
  }

  if (limit.limited) {
    await logSecurityEvent({ actorType: "anonymous", actorReference: securityReference(username), eventType: "auth.rate_limited", severity: "high", route: "/api/runner-login", outcome: "blocked" });
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }

  const { data: runner, error } = await supabaseAdmin
    .from("runners")
    .select("id, team_id, first_name, last_name, access_code, access_code_hash, portal_status, credential_version, session_version")
    .eq("username", username)
    .maybeSingle();

  const legacyMatch = Boolean(runner?.access_code && runner.access_code === code);
  const hashMatch = runner ? await verifyRunnerAccessCode(code, runner.access_code_hash) : false;

  if (error || !runner || runner.portal_status !== "active" || (!legacyMatch && !hashMatch)) {
    await logSecurityEvent({ teamId: runner?.team_id, actorType: "anonymous", actorReference: securityReference(username), eventType: "auth.failed", severity: "warning", route: "/api/runner-login", outcome: "invalid_credentials" });
    return NextResponse.json({ error: "Invalid username or passcode" }, { status: 401 });
  }

  let credentialVersion = Number(runner.credential_version || 1);
  let sessionVersion = Number(runner.session_version || 1);

  if (legacyMatch) {
    const upgradedHash = await hashRunnerAccessCode(code);
    credentialVersion += 1;
    sessionVersion += 1;
    const { error: upgradeError } = await supabaseAdmin
      .from("runners")
      .update({
        access_code: null,
        access_code_hash: upgradedHash,
        credential_version: credentialVersion,
        session_version: sessionVersion,
      })
      .eq("id", runner.id)
      .eq("credential_version", runner.credential_version);

    if (upgradeError) {
      return NextResponse.json({ error: "Runner login is temporarily unavailable" }, { status: 503 });
    }
  }

  const runnerName = `${runner.first_name} ${runner.last_name}`;
  await setRunnerSession(runner.id, runnerName, credentialVersion, sessionVersion);
  await logSecurityEvent({ teamId: runner.team_id, actorType: "runner", actorReference: securityReference(runner.id), eventType: "auth.succeeded", severity: "info", route: "/api/runner-login", outcome: "allowed" });

  return NextResponse.json({
    runner: {
      id: runner.id,
      name: runnerName,
    },
  });
}
