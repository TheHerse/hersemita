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

function formatPace(seconds: number | null) {
  if (!seconds || seconds <= 0) return "";
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.round(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainder}`;
}

function formatDuration(seconds: number | null) {
  if (!seconds || seconds <= 0) return "";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = Math.round(seconds % 60).toString().padStart(2, "0");
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, "0")}:${remainder}` : `${minutes}:${remainder}`;
}

function safeDate(value: string | null) {
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
  const runnerIds = new Set(
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

  let query = supabase
    .from("activities")
    .select(`
      id,
      runner_id,
      distance_miles,
      pace_per_mile,
      duration_seconds,
      start_time,
      verified,
      uploaded_by,
      file_type,
      detected_app,
      workout_type,
      avg_hr,
      max_hr,
      rpe,
      soreness,
      illness,
      training_load,
      training_load_source,
      elevation_gain_m,
      notes,
      raw_distance,
      raw_pace,
      runners!inner (
        id,
        first_name,
        last_name,
        grade,
        username,
        team_id
      )
    `)
    .eq("runners.team_id", teamId)
    .order("start_time", { ascending: false });

  if (verifiedOnly) {
    query = query.eq("verified", true);
  }

  if (runnerIds.size > 0) {
    query = query.in("runner_id", Array.from(runnerIds));
  }

  if (Number.isFinite(days) && days > 0) {
    const since = new Date();
    since.setDate(since.getDate() - days);
    query = query.gte("start_time", since.toISOString());
  }

  const { data: activities, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const headers = [
    "Runner",
    "Username",
    "Grade",
    "Date",
    `Distance (${unitLabel})`,
    `Pace per ${unitLabel}`,
    "Duration",
    "Verified",
    "Source",
    "Workout Type",
    "RPE",
    "Soreness",
    "Sick",
    "Training Load",
    "Load Source",
    "Avg HR",
    "Max HR",
    "Elevation Gain (m)",
    "Notes",
    "Raw Distance",
    "Raw Pace",
  ];

  const sortedActivities = [...(activities || [])].sort((a, b) => {
    const runnerA = Array.isArray(a.runners) ? a.runners[0] : a.runners;
    const runnerB = Array.isArray(b.runners) ? b.runners[0] : b.runners;
    const nameA = `${runnerA?.last_name || ""} ${runnerA?.first_name || ""}`.trim().toLowerCase();
    const nameB = `${runnerB?.last_name || ""} ${runnerB?.first_name || ""}`.trim().toLowerCase();
    const nameCompare = nameA.localeCompare(nameB);
    if (nameCompare !== 0) return nameCompare;
    const idCompare = String(a.runner_id || "").localeCompare(String(b.runner_id || ""));
    if (idCompare !== 0) return idCompare;
    return new Date(b.start_time || 0).getTime() - new Date(a.start_time || 0).getTime();
  });

  let previousRunnerId = "";
  const rows = sortedActivities.map((activity) => {
    const runner = Array.isArray(activity.runners) ? activity.runners[0] : activity.runners;
    const runnerId = String(activity.runner_id || runner?.id || "");
    const isFirstRunnerRow = runnerId !== previousRunnerId;
    previousRunnerId = runnerId;
    const distance = milesToDistance(Number(activity.distance_miles || 0), preferredDistanceUnit);
    const pace = paceFromMiles(Number(activity.pace_per_mile || 0), preferredDistanceUnit);
    const source = activity.file_type || activity.detected_app || activity.uploaded_by || "manual";

    return [
      isFirstRunnerRow ? `${runner?.first_name || ""} ${runner?.last_name || ""}`.trim() : "",
      isFirstRunnerRow ? runner?.username || "" : "",
      isFirstRunnerRow ? runner?.grade || "" : "",
      safeDate(activity.start_time),
      distance ? distance.toFixed(2) : "",
      formatPace(pace),
      formatDuration(activity.duration_seconds),
      activity.verified ? "Yes" : "No",
      source,
      activity.workout_type || "",
      activity.rpe || "",
      activity.soreness || "",
      activity.illness ? "Yes" : "No",
      activity.training_load || "",
      activity.training_load_source || "",
      activity.avg_hr || "",
      activity.max_hr || "",
      activity.elevation_gain_m || "",
      activity.notes || "",
      activity.raw_distance || "",
      activity.raw_pace || "",
    ];
  });

  const csv = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="hersemita-activities-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
