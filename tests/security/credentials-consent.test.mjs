import assert from "node:assert/strict";
import test from "node:test";
import { acceptedAdultConsentChoices, REQUIRED_ADULT_CONSENT_KEYS } from "../../lib/adult-consent.ts";
import { acceptedParentConsentChoices, REQUIRED_PARENT_CONSENT_KEYS } from "../../lib/parent-consent.ts";
import { hashRunnerAccessCode, verifyRunnerAccessCode } from "../../lib/runner-credentials.ts";

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
