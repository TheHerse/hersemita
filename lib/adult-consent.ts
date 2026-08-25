export const REQUIRED_ADULT_CONSENT_KEYS = [
  "adult_authority",
  "terms",
  "privacy",
  "training_data",
  "wellness_data",
] as const;

export function currentAdultConsentVersion() {
  const version = process.env.ADULT_CONSENT_VERSION || "2026-08-draft";
  if (process.env.NODE_ENV === "production" && version.endsWith("draft")) {
    throw new Error("A counsel-approved ADULT_CONSENT_VERSION is required in production");
  }
  return version;
}

export function acceptedAdultConsentChoices(formData: FormData) {
  return Object.fromEntries(
    REQUIRED_ADULT_CONSENT_KEYS.map((key) => [key, formData.get(key) === "on"])
  ) as Record<(typeof REQUIRED_ADULT_CONSENT_KEYS)[number], boolean>;
}
