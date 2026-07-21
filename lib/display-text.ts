export function displayTrainingNote(value: string | null | undefined, fallback = "") {
  const note = String(value || "").trim();
  if (!note) return fallback;
  return note.replace(/^\[[^\]]+\]\s*/, "").trim() || fallback;
}

export function displayActivitySource(value: string | null | undefined) {
  const source = String(value || "").trim().toLowerCase();
  if (!source) return "Manual upload";
  if (source === "manual_demo" || source === "manual") return "Manual entry";
  if (source === "garmin_connect" || source === "garmin_clipboard") return "Garmin";
  if (source === "apple_watch") return "Apple Watch";
  if (source === "strava") return "Strava";
  return source
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
