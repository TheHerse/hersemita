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

function parseBoolean(value: unknown) {
  return value === true || value === "true" || value === "on";
}

function parseIntegerInRange(value: unknown, min: number, max: number) {
  const parsed = parseNumber(value);
  if (parsed == null) return null;
  const rounded = Math.round(parsed);
  return rounded >= min && rounded <= max ? rounded : null;
}

function parseWorkoutType(value: unknown) {
  const parsed = parseString(value);
  const allowed = new Set(["easy", "tempo", "interval", "long", "race", "recovery", "cross"]);
  return allowed.has(parsed) ? parsed : null;
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
  const rpe = parseIntegerInRange(body?.rpe, 1, 10);
  const trainingLoadInput = parseNumber(body?.trainingLoad);
  const trainingLoad = trainingLoadInput ?? (durationSeconds != null && rpe != null ? (durationSeconds / 60) * rpe * 0.6 : null);

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
    workout_type: parseWorkoutType(body?.workoutType),
    avg_hr: parseIntegerInRange(body?.avgHr, 1, 250),
    max_hr: parseIntegerInRange(body?.maxHr, 1, 250),
    rpe,
    training_load: trainingLoad,
    training_load_source: trainingLoadInput != null ? "manual" : trainingLoad != null ? "estimated_rpe" : "manual",
    elevation_gain_m: parseIntegerInRange(body?.elevationGainM, 0, 10000),
    soreness: parseIntegerInRange(body?.soreness, 1, 10),
    illness: parseBoolean(body?.illness),
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
