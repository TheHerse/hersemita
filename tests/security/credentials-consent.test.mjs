import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { acceptedAdultConsentChoices, REQUIRED_ADULT_CONSENT_KEYS } from "../../lib/adult-consent.ts";
import { acceptedParentConsentChoices, REQUIRED_PARENT_CONSENT_KEYS } from "../../lib/parent-consent.ts";
import { hashRunnerAccessCode, verifyRunnerAccessCode } from "../../lib/runner-credentials.ts";
import { decryptRunnerAccessCode, encryptRunnerAccessCode } from "../../lib/runner-credential-vault.ts";

test("runner passcodes are salted, verifiable, and reject incorrect codes", async () => {
  const code = "ABCDEFGH23";
  const first = await hashRunnerAccessCode(code);
  const second = await hashRunnerAccessCode(code);
  assert.notEqual(first, second);
  assert.equal(first.includes(code), false);
  assert.equal(await verifyRunnerAccessCode(code, first), true);
  assert.equal(await verifyRunnerAccessCode("WRONGCODE2", first), false);
  assert.equal(await verifyRunnerAccessCode(code, "invalid"), false);
});

test("runner access-code vault encryption is authenticated and bound to one runner", () => {
  const code = "ABCDEFGH23";
  const runnerId = "11111111-1111-4111-8111-111111111111";
  const encrypted = encryptRunnerAccessCode(runnerId, code);
  assert.equal(encrypted.includes(code), false);
  assert.equal(decryptRunnerAccessCode(runnerId, encrypted), code);
  assert.equal(decryptRunnerAccessCode("22222222-2222-4222-8222-222222222222", encrypted), null);
  const parts = encrypted.split(":");
  const replacement = parts[2].startsWith("A") ? "B" : "A";
  parts[2] = `${replacement}${parts[2].slice(1)}`;
  assert.equal(decryptRunnerAccessCode(runnerId, parts.join(":")), null);
  assert.equal(decryptRunnerAccessCode(runnerId, code), null);
});

test("runner sessions are nonpersistent and expire within 12 hours", async () => {
  const source = await readFile(new URL("../../lib/runner-session.ts", import.meta.url), "utf8");
  assert.match(source, /SESSION_LIFETIME_SECONDS = 60 \* 60 \* 12/);
  const cookieOptions = source.slice(source.indexOf("cookies()).set"), source.indexOf("export async function clearRunnerSession"));
  assert.doesNotMatch(cookieOptions, /maxAge|expires:/);
  assert.match(source, /session\.exp < Date\.now\(\)/);
  assert.match(source, /runner\.portal_status !== "active"/);
  assert.match(source, /runner\.credential_version\) !== session\.credentialVersion/);
  assert.match(source, /runner\.session_version\) !== session\.sessionVersion/);
});

test("runner login revokes any lingering adult Clerk session before issuing its cookie", async () => {
  const source = await readFile(new URL("../../app/api/runner-login/route.ts", import.meta.url), "utf8");
  assert.match(source, /await client\.sessions\.revokeSession\(adultSessionId\)/);
  assert.ok(source.indexOf("revokeSession(adultSessionId)") < source.indexOf("setRunnerSession(runner.id"));
  assert.match(source, /auth\.adult_session_revocation_failed/);
});

test("parent withdrawal redirect displays an explicit success confirmation", async () => {
  const source = await readFile(new URL("../../app/parent/dashboard/page.tsx", import.meta.url), "utf8");
  assert.match(source, /query\?\.consent === "withdrawn"/);
  assert.match(source, /Authorization was withdrawn successfully/);
  assert.match(source, /role="status"/);
});

test("withdrawn minors remain available for authorized guardian privacy requests", async () => {
  const source = await readFile(new URL("../../lib/privacy-request-access.ts", import.meta.url), "utf8");
  assert.match(source, /runner_guardians/);
  assert.match(source, /guardianIds/);
  assert.doesNotMatch(source, /portal_status.*active/);
  assert.match(source, /adult_18_plus.*adult_parent_access_enabled/);
});

test("security-definer pseudonymization resolves pgcrypto from its trusted schema", async () => {
  const privacySql = await readFile(new URL("../../supabase/privacy-requests.sql", import.meta.url), "utf8");
  const seasonSql = await readFile(new URL("../../supabase/season-closeout.sql", import.meta.url), "utf8");
  assert.match(privacySql, /set search_path = pg_catalog, extensions, public/);
  assert.match(seasonSql, /set search_path = pg_catalog, extensions, public/);
});

test("parent consent requires every independently named choice", () => {
  const form = new FormData();
  REQUIRED_PARENT_CONSENT_KEYS.forEach((key) => form.set(key, "on"));
  const accepted = acceptedParentConsentChoices(form);
  assert.equal(REQUIRED_PARENT_CONSENT_KEYS.every((key) => accepted[key]), true);
  form.delete("wellness_data");
  assert.equal(acceptedParentConsentChoices(form).wellness_data, false);
});

test("adult consent requires adult authority separately from data choices", () => {
  const form = new FormData();
  REQUIRED_ADULT_CONSENT_KEYS.forEach((key) => form.set(key, "on"));
  assert.equal(REQUIRED_ADULT_CONSENT_KEYS.every((key) => acceptedAdultConsentChoices(form)[key]), true);
  form.delete("adult_authority");
  assert.equal(acceptedAdultConsentChoices(form).adult_authority, false);
});
