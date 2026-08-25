import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";

const COOKIE_NAME = "hersemita_runner_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

type RunnerSession = {
  runnerId: string;
  runnerName: string;
  credentialVersion: number;
  sessionVersion: number;
  exp: number;
};

function getSecret() {
  const secret = process.env.RUNNER_SESSION_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("RUNNER_SESSION_SECRET is required in production");
  }
  return "dev-only-runner-session-secret-change-me";
}

function toBase64Url(value: string) {
  return Buffer.from(value).toString("base64url");
}

function fromBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(value: string) {
  return createHmac("sha256", getSecret()).update(value).digest("base64url");
}

export async function setRunnerSession(
  runnerId: string,
  runnerName: string,
  credentialVersion: number,
  sessionVersion: number
) {
  const session: RunnerSession = {
    runnerId,
    runnerName,
    credentialVersion,
    sessionVersion,
    exp: Date.now() + MAX_AGE_SECONDS * 1000,
  };
  const payload = toBase64Url(JSON.stringify(session));
  const signature = sign(payload);

  (await cookies()).set(COOKIE_NAME, `${payload}.${signature}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearRunnerSession() {
  (await cookies()).delete(COOKIE_NAME);
}

export async function getRunnerSession() {
  const value = (await cookies()).get(COOKIE_NAME)?.value;
  if (!value) return null;

  const [payload, signature] = value.split(".");
  if (!payload || !signature) return null;

  const expected = sign(payload);
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== actualBuffer.length || !timingSafeEqual(expectedBuffer, actualBuffer)) {
    return null;
  }

  try {
    const session = JSON.parse(fromBase64Url(payload)) as RunnerSession;
    if (
      !session.runnerId ||
      !session.runnerName ||
      !Number.isSafeInteger(session.credentialVersion) ||
      !Number.isSafeInteger(session.sessionVersion) ||
      session.exp < Date.now()
    ) return null;

    const { data: runner } = await supabaseAdmin
      .from("runners")
      .select("id, first_name, last_name, portal_status, credential_version, session_version")
      .eq("id", session.runnerId)
      .maybeSingle();

    if (
      !runner ||
      runner.portal_status !== "active" ||
      Number(runner.credential_version) !== session.credentialVersion ||
      Number(runner.session_version) !== session.sessionVersion
    ) return null;

    return {
      ...session,
      runnerName: `${runner.first_name} ${runner.last_name}`.trim(),
    };
  } catch {
    return null;
  }
}
