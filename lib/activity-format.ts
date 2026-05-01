export function formatPace(paceSeconds?: number | null) {
  if (!paceSeconds || paceSeconds <= 0) return "--:--";
  const minutes = Math.floor(paceSeconds / 60);
  const seconds = Math.round(paceSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function parsePaceToSeconds(pace: string) {
  const [minutes, seconds] = pace.split(":").map(Number);
  return (minutes || 0) * 60 + (seconds || 0);
}
