const APP_STYLES: Record<string, { name: string; border: string; background: string; color: string }> = {
  garmin_connect: {
    name: "Garmin Connect",
    border: "#38bdf8",
    background: "#082f49",
    color: "#bae6fd",
  },
  garmin_clipboard: {
    name: "Garmin Clipboard",
    border: "#38bdf8",
    background: "#082f49",
    color: "#bae6fd",
  },
  strava: {
    name: "Strava",
    border: "#fb923c",
    background: "#431407",
    color: "#fed7aa",
  },
  apple_watch: {
    name: "Apple Watch",
    border: "#22c55e",
    background: "#052e16",
    color: "#bbf7d0",
  },
  unknown: {
    name: "Screenshot",
    border: "#64748b",
    background: "#0f172a",
    color: "#e2e8f0",
  },
};

export default function ActivityAppBadge({ app }: { app?: string | null }) {
  const style = APP_STYLES[app || "unknown"] || APP_STYLES.unknown;

  return (
    <span
      className="inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-bold"
      style={{
        borderColor: style.border,
        backgroundColor: style.background,
        color: style.color,
      }}
    >
      {style.name}
    </span>
  );
}
