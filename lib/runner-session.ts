import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";

const COOKIE_NAME = "hersemita_runner_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

type RunnerSession = {
  runnerId: string;
  runnerName: string;
  exp: number;
};

function getSecret() {
  return process.env.CLERK_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "dev-runner-session-secret";
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

export async function setRunnerSession(runnerId: string, runnerName: string) {
  const session: RunnerSession = {
    runnerId,
    runnerName,
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
    if (!session.runnerId || !session.runnerName || session.exp < Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}
