import { cookies } from "next/headers";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const COOKIE_NAME = "hersemita_runner_credential_reveal";
const ADULT_COOKIE_NAME = "hersemita_adult_runner_credential_reveal";
const MAX_AGE_SECONDS = 5 * 60;

type CredentialReveal = {
  runnerId: string;
  username: string;
  accessCode: string;
  exp: number;
};

function encryptionKey() {
  const secret = process.env.RUNNER_CREDENTIAL_REVEAL_SECRET || process.env.RUNNER_SESSION_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("RUNNER_CREDENTIAL_REVEAL_SECRET or RUNNER_SESSION_SECRET is required in production");
  }
  return createHash("sha256").update(secret || "dev-only-credential-reveal-secret").digest();
}

async function setCredentialReveal(cookieName: string, path: string, runnerId: string, username: string, accessCode: string) {
  const value: CredentialReveal = {
    runnerId,
    username,
    accessCode,
    exp: Date.now() + MAX_AGE_SECONDS * 1000,
  };
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  (await cookies()).set(cookieName, `${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path,
    maxAge: MAX_AGE_SECONDS,
  });
}

async function getCredentialReveal(cookieName: string, runnerId: string) {
  const encoded = (await cookies()).get(cookieName)?.value;
  if (!encoded) return null;
  const [ivValue, tagValue, encryptedValue] = encoded.split(".");
  if (!ivValue || !tagValue || !encryptedValue) return null;

  try {
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivValue, "base64url"));
    decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedValue, "base64url")),
      decipher.final(),
    ]).toString("utf8");
    const value = JSON.parse(decrypted) as CredentialReveal;
    if (value.runnerId !== runnerId || value.exp < Date.now()) return null;
    return value;
  } catch {
    return null;
  }
}

export function setRunnerCredentialReveal(runnerId: string, username: string, accessCode: string) {
  return setCredentialReveal(COOKIE_NAME, "/runners", runnerId, username, accessCode);
}

export function getRunnerCredentialReveal(runnerId: string) {
  return getCredentialReveal(COOKIE_NAME, runnerId);
}

export function setAdultRunnerCredentialReveal(runnerId: string, username: string, accessCode: string) {
  return setCredentialReveal(ADULT_COOKIE_NAME, "/adult", runnerId, username, accessCode);
}

export function getAdultRunnerCredentialReveal(runnerId: string) {
  return getCredentialReveal(ADULT_COOKIE_NAME, runnerId);
}
