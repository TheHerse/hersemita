import { randomBytes } from "node:crypto";

function cleanNamePart(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 18);
}

export function makeAccessCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(10);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

export function makeRunnerUsername(firstName: string, lastName: string) {
  const last = cleanNamePart(lastName) || "runner";
  const firstInitial = cleanNamePart(firstName).slice(0, 1) || "x";
  const randomNumber = Math.floor(1000 + Math.random() * 9000).toString();

  return `${last}_${firstInitial}${randomNumber}`;
}
