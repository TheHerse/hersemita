import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { distanceUnitLabel, milesToDistance, normalizeDistanceUnit, paceFromMiles } from "@/lib/distance-units";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getCurrentTeamContext } from "@/lib/team-context";

export const dynamic = "force-dynamic";

function csvCell(value: unknown) {
  const text = value == null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function formatPace(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "";
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.round(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainder}`;
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatDate(value: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-US");
}

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const url = new URL(request.url);
  const days = Number(url.searchParams.get("days") || "0");
  const verifiedOnly = url.searchParams.get("verified") === "1";
  const requestedRunnerIds = new Set(
    (url.searchParams.get("runnerIds") || "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)
  );

  const supabase = await createServerSupabaseClient();
  const teamContext = await getCurrentTeamContext(userId);
  const teamId = teamContext?.team.id;
  const { data: coach } = await supabase
    .from("coaches")
    .select("id, preferred_distance_unit")
    .eq("clerk_id", userId)
    .single();

  if (!coach?.id) {
    return NextResponse.json({ error: "Coach profile not found" }, { status: 404 });
  }

  const preferredDistanceUnit = normalizeDistanceUnit(teamContext?.team.default_distance_unit || coach.preferred_distance_unit);
  const unitLabel = distanceUnitLabel(preferredDistanceUnit);

  let runnerQuery = supabase
    .from("runners")
    .select("id, first_name, last_name, grade, parent_phone")
    .eq("team_id", teamId)
    .order("last_name", { ascending: true });

  if (requestedRunnerIds.size > 0) {
    runnerQuery = runnerQuery.in("id", Array.from(requestedRunnerIds));
  }

  const { data: runners, error: runnerError } = await runnerQuery;
  if (runnerError) {
    return NextResponse.json({ error: runnerError.message }, { status: 500 });
  }

  const runnerIds = (runners || []).map((runner) => runner.id);
  let activities: any[] = [];

  if (runnerIds.length > 0) {
    let activityQuery = supabase
      .from("activities")
      .select("id, runner_id, distance_miles, pace_per_mile, start_time, verified, training_load, rpe, soreness, illness, notes")
      .in("runner_id", runnerIds)
      .order("start_time", { ascending: false });

    if (verifiedOnly) {
      activityQuery = activityQuery.eq("verified", true);
    }

    if (Number.isFinite(days) && days > 0) {
      const since = new Date();
      since.setDate(since.getDate() - days);
      activityQuery = activityQuery.gte("start_time", since.toISOString());
    }

    const { data, error } = await activityQuery;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    activities = data || [];
  }

  const byRunner = new Map<string, typeof activities>();
  activities.forEach((activity) => {
    const current = byRunner.get(activity.runner_id) || [];
    current.push(activity);
    byRunner.set(activity.runner_id, current);
  });

  const headers = [
    "Runner",
    "Grade",
    "Parent Phone",
    "Runs",
    "Verified Runs",
    `Total Distance (${unitLabel})`,
    `Average Pace per ${unitLabel}`,
    `Longest Run (${unitLabel})`,
    "Last Upload",
    "Average RPE",
    "Average Soreness",
    "Sick Days",
    "Average Training Load",
    "Status",
  ];

  const rows = (runners || []).map((runner) => {
    const runnerActivities = byRunner.get(runner.id) || [];
    const distances = runnerActivities.map((activity) => Number(activity.distance_miles || 0)).filter((value) => value > 0);
    const paces = runnerActivities.map((activity) => Number(activity.pace_per_mile || 0)).filter((value) => value > 0);
    const rpe = runnerActivities.map((activity) => Number(activity.rpe || 0)).filter((value) => value > 0);
    const soreness = runnerActivities.map((activity) => Number(activity.soreness || 0)).filter((value) => value > 0);
    const loads = runnerActivities.map((activity) => Number(activity.training_load || 0)).filter((value) => value > 0);
    const totalDistance = milesToDistance(distances.reduce((sum, value) => sum + value, 0), preferredDistanceUnit);
    const longestRun = milesToDistance(distances.length ? Math.max(...distances) : 0, preferredDistanceUnit);
    const avgPace = paceFromMiles(average(paces), preferredDistanceUnit);
    const verifiedRuns = runnerActivities.filter((activity) => activity.verified).length;
    const lastUpload = runnerActivities[0]?.start_time || null;
    const sickDays = runnerActivities.filter((activity) => activity.illness).length;
    const status =
      runnerActivities.length === 0
        ? "No data"
        : verifiedRuns < runnerActivities.length
          ? "Needs verification"
          : "Current";

    return [
      `${runner.first_name || ""} ${runner.last_name || ""}`.trim(),
      runner.grade || "",
      runner.parent_phone || "",
      runnerActivities.length,
      verifiedRuns,
      totalDistance.toFixed(2),
      formatPace(avgPace),
      longestRun.toFixed(2),
      formatDate(lastUpload),
      average(rpe).toFixed(1),
      average(soreness).toFixed(1),
      sickDays,
      average(loads).toFixed(1),
      status,
    ];
  });

  const csv = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="hersemita-runner-summary-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
