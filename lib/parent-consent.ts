export const REQUIRED_PARENT_CONSENT_KEYS = [
  "parent_authority",
  "terms",
  "privacy",
  "runner_portal",
  "training_data",
  "wellness_data",
] as const;

export function currentParentConsentVersion() {
  const version = process.env.PARENT_CONSENT_VERSION || "2026-08-draft";
  if (process.env.NODE_ENV === "production" && version.endsWith("draft")) {
    throw new Error("A counsel-approved PARENT_CONSENT_VERSION is required in production");
  }
  return version;
}

export function acceptedParentConsentChoices(formData: FormData) {
  return Object.fromEntries(
    REQUIRED_PARENT_CONSENT_KEYS.map((key) => [key, formData.get(key) === "on"])
  ) as Record<(typeof REQUIRED_PARENT_CONSENT_KEYS)[number], boolean>;
}
