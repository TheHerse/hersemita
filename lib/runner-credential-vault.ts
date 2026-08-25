import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const PREFIX = "vault:v1";

function vaultKey() {
  const secret = process.env.RUNNER_CREDENTIAL_REVEAL_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("RUNNER_CREDENTIAL_REVEAL_SECRET is required in production");
  }
  return createHash("sha256")
    .update(`hersemita-runner-credential-vault:v1:${secret || "dev-only-vault-secret"}`)
    .digest();
}

export function encryptRunnerAccessCode(runnerId: string, accessCode: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", vaultKey(), iv);
  cipher.setAAD(Buffer.from(`${PREFIX}:${runnerId}`));
  const encrypted = Buffer.concat([cipher.update(accessCode, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [PREFIX, iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(":");
}

export function decryptRunnerAccessCode(runnerId: string, storedValue: string | null | undefined) {
  if (!storedValue?.startsWith(`${PREFIX}:`)) return null;
  const [prefix, version, ivValue, tagValue, encryptedValue] = storedValue.split(":");
  if (`${prefix}:${version}` !== PREFIX || !ivValue || !tagValue || !encryptedValue) return null;

  try {
    const decipher = createDecipheriv("aes-256-gcm", vaultKey(), Buffer.from(ivValue, "base64url"));
    decipher.setAAD(Buffer.from(`${PREFIX}:${runnerId}`));
    decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
    const accessCode = Buffer.concat([
      decipher.update(Buffer.from(encryptedValue, "base64url")),
      decipher.final(),
    ]).toString("utf8");
    return /^[A-Z0-9]{8,16}$/.test(accessCode) ? accessCode : null;
  } catch {
    return null;
  }
}

export function isEncryptedRunnerAccessCode(value: string | null | undefined) {
  return Boolean(value?.startsWith(`${PREFIX}:`));
}
