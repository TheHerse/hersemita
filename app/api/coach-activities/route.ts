import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { storagePathFromActivityScreenshotUrl } from "@/lib/activity-screenshot-storage";
import { getCurrentTeamContext } from "@/lib/team-context";
import { hasTrustedRequestOrigin } from "@/lib/request-origin";
import { isPlainObject, readBoundedJson } from "@/lib/request-body";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { logSecurityEvent, securityReference } from "@/lib/security-events";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const WORKOUT_TYPES = new Set(["easy", "tempo", "interval", "long", "race", "recovery", "cross"]);
const FILE_TYPES = new Set(["manual", "screenshot", "fit", "gpx", "tcx"]);

function finiteNumber(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function boundedInteger(value: unknown, minimum: number, maximum: number) {
  const number = finiteNumber(value);
  if (number == null || !Number.isInteger(number) || number < minimum || number > maximum) return null;
  return number;
}

export async function POST(request: Request) {
  if (!hasTrustedRequestOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Coach authentication required" }, { status: 401 });
  }

  const context = await getCurrentTeamContext(userId);
  if (!context?.team.id) {
    return NextResponse.json({ error: "Team access required" }, { status: 403 });
  }

  const parsed = await readBoundedJson(request, 24 * 1024);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  }
  const body = isPlainObject(parsed.value) ? parsed.value : null;
  const runnerId = typeof body?.runnerId === "string" ? body.runnerId : "";
  const fileType = typeof body?.fileType === "string" ? body.fileType.toLowerCase() : "";
  const distanceMiles = finiteNumber(body?.distanceMiles);
  const durationSeconds = boundedInteger(body?.durationSeconds, 1, 7 * 24 * 60 * 60);
  const pacePerMile = boundedInteger(body?.pacePerMile, 1, 24 * 60 * 60);
  const startTime = typeof body?.startTime === "string" ? new Date(body.startTime) : null;
  const screenshotReference = typeof body?.screenshotReference === "string" ? body.screenshotReference : null;

  if (
    !UUID_PATTERN.test(runnerId) ||
    !FILE_TYPES.has(fileType) ||
    distanceMiles == null || distanceMiles <= 0 || distanceMiles > 200 ||
    durationSeconds == null || pacePerMile == null ||
    !startTime || !Number.isFinite(startTime.getTime()) ||
    startTime.getTime() > Date.now() + 24 * 60 * 60 * 1000
  ) {
    return NextResponse.json({ error: "Invalid activity details" }, { status: 400 });
  }

  if (fileType === "screenshot") {
    const path = screenshotReference ? storagePathFromActivityScreenshotUrl(screenshotReference) : null;
    if (!path || !path.startsWith(`${runnerId}/`)) {
      return NextResponse.json({ error: "Invalid screenshot reference" }, { status: 400 });
    }
  } else if (screenshotReference) {
    return NextResponse.json({ error: "Unexpected screenshot reference" }, { status: 400 });
  }

  const { data: runner } = await supabaseAdmin
    .from("runners")
    .select("id")
    .eq("id", runnerId)
    .eq("team_id", context.team.id)
    .is("archived_at", null)
    .maybeSingle();

  if (!runner?.id) {
    await logSecurityEvent({
      teamId: context.team.id,
      actorType: "coach",
      actorReference: securityReference(userId),
      eventType: "authorization.denied",
      severity: "high",
      route: "/api/coach-activities",
      outcome: "runner_not_in_team",
    });
    return NextResponse.json({ error: "Runner not found for this team" }, { status: 404 });
  }

  const workoutType = typeof body?.workoutType === "string" && WORKOUT_TYPES.has(body.workoutType)
    ? body.workoutType
    : null;
  const rpe = body?.rpe == null ? null : boundedInteger(body.rpe, 1, 10);
  const soreness = body?.soreness == null ? null : boundedInteger(body.soreness, 1, 10);
  const avgHr = body?.avgHr == null ? null : boundedInteger(body.avgHr, 1, 250);
  const maxHr = body?.maxHr == null ? null : boundedInteger(body.maxHr, 1, 250);
  const elevationGainM = body?.elevationGainM == null ? null : boundedInteger(body.elevationGainM, 0, 10000);
  const trainingLoad = body?.trainingLoad == null ? null : finiteNumber(body.trainingLoad);
  if (trainingLoad != null && (trainingLoad < 0 || trainingLoad > 10000)) {
    return NextResponse.json({ error: "Invalid training load" }, { status: 400 });
  }

  const originalFilename = typeof body?.originalFilename === "string"
    ? body.originalFilename.slice(0, 255)
    : null;
  const notes = typeof body?.notes === "string" ? body.notes.slice(0, 2000) : null;

  const { error } = await supabaseAdmin.from("activities").insert({
    runner_id: runnerId,
    garmin_activity_id: `coach_${fileType}_${Date.now()}`,
    distance_miles: distanceMiles,
    duration_seconds: durationSeconds,
    pace_per_mile: pacePerMile,
    start_time: startTime.toISOString(),
    verified: false,
    uploaded_by: "coach",
    file_type: fileType,
    original_filename: originalFilename,
    screenshot_urls: screenshotReference ? [screenshotReference] : [],
    notes,
    workout_type: workoutType,
    rpe,
    soreness,
    illness: body?.illness === true,
    avg_hr: avgHr,
    max_hr: maxHr,
    training_load: trainingLoad,
    training_load_source: trainingLoad != null ? "manual" : "manual",
    elevation_gain_m: elevationGainM,
  });

  if (error) {
    return NextResponse.json({ error: "Activity could not be saved" }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
