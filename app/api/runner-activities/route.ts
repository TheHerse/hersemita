import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getRunnerSession } from "@/lib/runner-session";

function parseNumber(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  const session = await getRunnerSession();
  if (!session) {
    return NextResponse.json({ error: "Runner session required" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const screenshotUrls: string[] = Array.isArray(body?.screenshotUrls)
    ? body.screenshotUrls.filter((url: unknown): url is string => typeof url === "string")
    : [];
  const distance = parseNumber(body?.distance);
  const durationSeconds = parseNumber(body?.durationSeconds);
  const paceSeconds = parseNumber(body?.paceSeconds) || 0;
  const date = parseString(body?.date);

  if (!screenshotUrls.length || distance == null || durationSeconds == null || !date) {
    return NextResponse.json({ error: "Missing run details" }, { status: 400 });
  }

  const invalidScreenshot = screenshotUrls.some((url) => !url.includes(`/activity-screenshots/${session.runnerId}/`));
  if (invalidScreenshot) {
    return NextResponse.json({ error: "Screenshot path does not match runner session" }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("activities").insert({
    runner_id: session.runnerId,
    garmin_activity_id: `manual_${Date.now()}`,
    distance_miles: distance,
    duration_seconds: durationSeconds,
    pace_per_mile: paceSeconds,
    start_time: new Date(date).toISOString(),
    verified: false,
    uploaded_by: "runner",
    file_type: "screenshot",
    screenshot_urls: screenshotUrls,
    detected_app: parseString(body?.detectedApp) || null,
    raw_distance: parseString(body?.rawDistance) || null,
    raw_pace: parseString(body?.rawPace) || null,
    notes: parseString(body?.notes) || null,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
