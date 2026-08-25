import { randomBytes, scrypt as nodeScrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(nodeScrypt);
const KEY_LENGTH = 64;
const FORMAT = "scrypt-v1";

export async function hashRunnerAccessCode(code: string) {
  const salt = randomBytes(16);
  const derived = await scrypt(code, salt, KEY_LENGTH) as Buffer;
  return `${FORMAT}$${salt.toString("base64url")}$${derived.toString("base64url")}`;
}

export async function verifyRunnerAccessCode(code: string, encodedHash: string | null | undefined) {
  if (!encodedHash) return false;
  const [format, saltValue, hashValue] = encodedHash.split("$");
  if (format !== FORMAT || !saltValue || !hashValue) return false;

  try {
    const salt = Buffer.from(saltValue, "base64url");
    const expected = Buffer.from(hashValue, "base64url");
    if (expected.length !== KEY_LENGTH) return false;
    const actual = await scrypt(code, salt, expected.length) as Buffer;
    return timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}
