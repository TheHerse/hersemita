import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getRunnerSession } from "@/lib/runner-session";
import { milesToDistance, normalizeDistanceUnit, paceFromMiles, type DistanceUnit } from "@/lib/distance-units";

export const dynamic = "force-dynamic";

function paceForUnit(secondsPerMile: number | null, preferredDistanceUnit: DistanceUnit) {
  if (!secondsPerMile || secondsPerMile <= 0) return null;
  return paceFromMiles(secondsPerMile, preferredDistanceUnit);
}

function formatPace(seconds: number | null) {
  if (!seconds || seconds <= 0) return "--";
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
}

export async function GET() {
  const session = await getRunnerSession();
  if (!session) {
    return NextResponse.json({ error: "Runner session required" }, { status: 401 });
  }

  const { data: runner, error: runnerError } = await supabaseAdmin
    .from("runners")
    .select("id, team_id, first_name, last_name, grade, coaches(name, school_name, preferred_distance_unit)")
    .eq("id", session.runnerId)
    .maybeSingle();

  if (runnerError || !runner) {
    return NextResponse.json({ error: "Runner not found" }, { status: 404 });
  }

  const { data: activities, error } = await supabaseAdmin
    .from("activities")
    .select("id, distance_miles, pace_per_mile, duration_seconds, start_time, verified, detected_app, notes")
    .eq("runner_id", session.runnerId)
    .order("start_time", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const safeActivities = activities || [];
  const totalMiles = safeActivities.reduce((sum, activity) => sum + Number(activity.distance_miles || 0), 0);
  const verifiedCount = safeActivities.filter((activity) => activity.verified).length;
  const fastest = safeActivities
    .map((activity) => Number(activity.pace_per_mile || 0))
    .filter((pace) => pace > 0)
    .sort((a, b) => a - b)[0] || null;
  const lastSevenDays = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const weekMiles = safeActivities
    .filter((activity) => new Date(activity.start_time).getTime() >= lastSevenDays)
    .reduce((sum, activity) => sum + Number(activity.distance_miles || 0), 0);

  const { data: team } = runner.team_id
    ? await supabaseAdmin
        .from("teams")
        .select("name, school_name, default_distance_unit")
        .eq("id", runner.team_id)
        .maybeSingle()
    : { data: null };

  const coach = Array.isArray(runner.coaches) ? runner.coaches[0] : runner.coaches;
  const preferredDistanceUnit = normalizeDistanceUnit(team?.default_distance_unit || coach?.preferred_distance_unit);

  return NextResponse.json({
    runner: {
      id: runner.id,
      name: `${runner.first_name} ${runner.last_name}`,
      grade: runner.grade,
      schoolName: team?.school_name || team?.name || coach?.school_name || "Your school",
      coachName: coach?.name || "Coach",
      preferredDistanceUnit,
    },
    summary: {
      totalRuns: safeActivities.length,
      totalMiles,
      weekMiles,
      totalDistance: milesToDistance(totalMiles, preferredDistanceUnit),
      weekDistance: milesToDistance(weekMiles, preferredDistanceUnit),
      verifiedCount,
      fastestPace: formatPace(paceForUnit(fastest, preferredDistanceUnit)),
    },
    activities: safeActivities.slice(0, 12).map((activity) => ({
      id: activity.id,
      distanceMiles: Number(activity.distance_miles || 0),
      distance: milesToDistance(Number(activity.distance_miles || 0), preferredDistanceUnit),
      pace: formatPace(paceForUnit(activity.pace_per_mile, preferredDistanceUnit)),
      durationSeconds: activity.duration_seconds,
      startTime: activity.start_time,
      verified: Boolean(activity.verified),
      detectedApp: activity.detected_app,
      notes: activity.notes,
    })),
  });
}
