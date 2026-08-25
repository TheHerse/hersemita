import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getRunnerSession } from "@/lib/runner-session";
import { distanceToMiles, normalizeDistanceUnit, paceToMiles } from "@/lib/distance-units";
import { runnerOwnsActivityScreenshotReference } from "@/lib/activity-screenshot-storage";
import { hasTrustedRequestOrigin } from "@/lib/request-origin";
import { isPlainObject, readBoundedJson } from "@/lib/request-body";

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
  if (!hasTrustedRequestOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }
  const session = await getRunnerSession();
  if (!session) {
    return NextResponse.json({ error: "Runner session required" }, { status: 401 });
  }

  const parsedBody = await readBoundedJson(request, 16 * 1024);
  if (!parsedBody.ok) {
    return NextResponse.json({ error: parsedBody.error }, { status: parsedBody.status });
  }
  const body = isPlainObject(parsedBody.value) ? parsedBody.value : null;
  const screenshotUrls: string[] = Array.isArray(body?.screenshotUrls)
    ? body.screenshotUrls.filter((url: unknown): url is string => typeof url === "string")
    : [];
  const distanceUnit = normalizeDistanceUnit(body?.distanceUnit);
  const distance = parseNumber(body?.distance);
  const distanceMiles = distance == null ? null : distanceToMiles(distance, distanceUnit);
  const durationSeconds = parseNumber(body?.durationSeconds);
  const inputPaceSeconds = parseNumber(body?.paceSeconds) || 0;
  const paceSeconds = inputPaceSeconds > 0 ? Math.round(paceToMiles(inputPaceSeconds, distanceUnit)) : inputPaceSeconds;
  const date = parseString(body?.date);
  const rpe = parseIntegerInRange(body?.rpe, 1, 10);
  const trainingLoadInput = parseNumber(body?.trainingLoad);
  const trainingLoad = trainingLoadInput ?? (durationSeconds != null && rpe != null ? (durationSeconds / 60) * rpe * 0.6 : null);

  if (
    distanceMiles == null ||
    distanceMiles <= 0 ||
    distanceMiles > 200 ||
    durationSeconds == null ||
    durationSeconds <= 0 ||
    durationSeconds > 7 * 24 * 60 * 60 ||
    !date ||
    screenshotUrls.length > 3
  ) {
    return NextResponse.json({ error: "Missing run details" }, { status: 400 });
  }

  const startTime = new Date(date);
  if (!Number.isFinite(startTime.getTime()) || startTime.getTime() > Date.now() + 24 * 60 * 60 * 1000) {
    return NextResponse.json({ error: "Invalid activity date" }, { status: 400 });
  }

  if (trainingLoad != null && (trainingLoad < 0 || trainingLoad > 10000)) {
    return NextResponse.json({ error: "Invalid training load" }, { status: 400 });
  }

  const invalidScreenshot = screenshotUrls.some((url) => !runnerOwnsActivityScreenshotReference(url, session.runnerId));
  if (invalidScreenshot) {
    return NextResponse.json({ error: "Screenshot path does not match runner session" }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("activities").insert({
    runner_id: session.runnerId,
    garmin_activity_id: `manual_${Date.now()}`,
    distance_miles: distanceMiles,
    duration_seconds: durationSeconds,
    pace_per_mile: paceSeconds,
    start_time: startTime.toISOString(),
    verified: false,
    uploaded_by: "runner",
    file_type: screenshotUrls.length > 0 ? "screenshot" : "manual",
    screenshot_urls: screenshotUrls,
    detected_app: parseString(body?.detectedApp).slice(0, 100) || null,
    raw_distance: parseString(body?.rawDistance).slice(0, 100) || null,
    raw_pace: parseString(body?.rawPace).slice(0, 100) || null,
    notes: parseString(body?.notes).slice(0, 2000) || null,
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
