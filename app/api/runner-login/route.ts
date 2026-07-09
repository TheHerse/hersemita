import { NextResponse } from "next/server";
import { checkRateLimit, clientIpFromHeaders, rateLimitKey } from "@/lib/rate-limit";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { setRunnerSession } from "@/lib/runner-session";

const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 8;

function normalizeUsername(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeCode(value: unknown) {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const username = normalizeUsername(body?.username);
  const code = normalizeCode(body?.code);
  const limit = await checkRateLimit({
    key: rateLimitKey(["runner-login", clientIpFromHeaders(request.headers), username]),
    windowMs: WINDOW_MS,
    max: MAX_ATTEMPTS,
  });

  if (!username || !/^[A-Z0-9]{8,16}$/.test(code)) {
    return NextResponse.json({ error: "Invalid username or passcode" }, { status: 401 });
  }

  if (limit.limited) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }

  const { data: runner, error } = await supabaseAdmin
    .from("runners")
    .select("id, first_name, last_name")
    .eq("username", username)
    .eq("access_code", code)
    .maybeSingle();

  if (error || !runner) {
    return NextResponse.json({ error: "Invalid username or passcode" }, { status: 401 });
  }

  const runnerName = `${runner.first_name} ${runner.last_name}`;
  await setRunnerSession(runner.id, runnerName);

  return NextResponse.json({
    runner: {
      id: runner.id,
      name: runnerName,
    },
  });
}
