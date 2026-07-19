import { NextResponse } from "next/server";
import { cleanupUnreferencedActivityScreenshots } from "@/lib/activity-screenshot-storage";

function isAuthorized(request: Request) {
  const secret = process.env.SCREENSHOT_CLEANUP_SECRET || process.env.CRON_SECRET;
  if (!secret && process.env.NODE_ENV !== "production") return true;
  if (!secret) return false;

  const authorization = request.headers.get("authorization") || "";
  const headerSecret = request.headers.get("x-cron-secret") || "";
  return authorization === `Bearer ${secret}` || headerSecret === secret;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const dryRun = url.searchParams.get("dryRun") === "1";
  const olderThanHours = Number(url.searchParams.get("olderThanHours") || 24);

  const result = await cleanupUnreferencedActivityScreenshots({
    olderThanHours: Number.isFinite(olderThanHours) && olderThanHours >= 1 ? olderThanHours : 24,
    dryRun,
  });

  return NextResponse.json({
    ok: true,
    ...result,
  });
}
