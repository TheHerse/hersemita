import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

type AssignmentRecord = {
  id: string;
  coach_id: string;
  assigned_date: string;
  target_type: "team" | "group" | "runner";
  target_id: string;
  target_label: string | null;
  workout_templates: {
    title: string | null;
    kind: string | null;
  } | null;
};

type AssignmentQueryRecord = Omit<AssignmentRecord, "workout_templates"> & {
  workout_templates:
    | {
        title: string | null;
        kind: string | null;
      }
    | {
        title: string | null;
        kind: string | null;
      }[]
    | null;
};

type RunnerRecord = {
  id: string;
  coach_id: string;
  first_name: string;
  last_name: string;
};

type MembershipRecord = {
  group_id: string;
  runner_id: string;
};

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function isAuthorized(request: Request) {
  const secret = process.env.MISSED_WORKOUT_CRON_SECRET || process.env.CRON_SECRET;
  if (!secret && process.env.NODE_ENV !== "production") return true;
  if (!secret) return false;

  const authorization = request.headers.get("authorization") || "";
  const headerSecret = request.headers.get("x-cron-secret") || "";
  return authorization === `Bearer ${secret}` || headerSecret === secret;
}

export async function GET(request: Request) {
  return scanMissedWorkouts(request);
}

export async function POST(request: Request) {
  return scanMissedWorkouts(request);
}

async function scanMissedWorkouts(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const days = Math.min(14, Math.max(1, Number(url.searchParams.get("days") || 3)));
  const today = new Date();
  const endDate = isoDate(today);
  const startDate = isoDate(addDays(today, -days));

  const { data: assignments, error: assignmentError } = await supabaseAdmin
    .from("workout_assignments")
    .select("id, coach_id, assigned_date, target_type, target_id, target_label, workout_templates(title, kind)")
    .gte("assigned_date", startDate)
    .lt("assigned_date", endDate)
    .order("assigned_date", { ascending: true });

  if (assignmentError) {
    return NextResponse.json({ error: assignmentError.message }, { status: 500 });
  }

  const safeAssignments = ((assignments || []) as AssignmentQueryRecord[]).map((assignment) => ({
    ...assignment,
    workout_templates: Array.isArray(assignment.workout_templates)
      ? assignment.workout_templates[0] || null
      : assignment.workout_templates,
  }));
  if (safeAssignments.length === 0) {
    return NextResponse.json({ ok: true, scannedAssignments: 0, insertedAlerts: 0 });
  }

  const coachIds = [...new Set(safeAssignments.map((assignment) => assignment.coach_id))];
  const groupIds = [
    ...new Set(
      safeAssignments
        .filter((assignment) => assignment.target_type === "group")
        .map((assignment) => assignment.target_id)
    ),
  ];

  const [{ data: runners, error: runnerError }, { data: memberships, error: membershipError }] = await Promise.all([
    supabaseAdmin
      .from("runners")
      .select("id, coach_id, first_name, last_name")
      .in("coach_id", coachIds),
    groupIds.length
      ? supabaseAdmin
          .from("runner_group_members")
          .select("group_id, runner_id")
          .in("group_id", groupIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (runnerError || membershipError) {
    return NextResponse.json({ error: runnerError?.message || membershipError?.message || "Could not load runners" }, { status: 500 });
  }

  const safeRunners = (runners || []) as RunnerRecord[];
  const safeMemberships = (memberships || []) as MembershipRecord[];
  const runnersByCoach = new Map<string, RunnerRecord[]>();
  const runnersById = new Map(safeRunners.map((runner) => [runner.id, runner]));
  const groupMembers = new Map<string, string[]>();

  safeRunners.forEach((runner) => {
    const current = runnersByCoach.get(runner.coach_id) || [];
    current.push(runner);
    runnersByCoach.set(runner.coach_id, current);
  });

  safeMemberships.forEach((membership) => {
    const current = groupMembers.get(membership.group_id) || [];
    current.push(membership.runner_id);
    groupMembers.set(membership.group_id, current);
  });

  const assignedRunnerIds = new Set<string>();
  safeAssignments.forEach((assignment) => {
    resolveTargetRunnerIds(assignment, runnersByCoach, groupMembers).forEach((runnerId) => assignedRunnerIds.add(runnerId));
  });

  const { data: activities, error: activityError } = assignedRunnerIds.size
    ? await supabaseAdmin
        .from("activities")
        .select("runner_id, start_time")
        .in("runner_id", [...assignedRunnerIds])
        .gte("start_time", `${startDate}T00:00:00.000Z`)
        .lt("start_time", `${endDate}T00:00:00.000Z`)
    : { data: [], error: null };

  if (activityError) {
    return NextResponse.json({ error: activityError.message }, { status: 500 });
  }

  const completedKeys = new Set(
    (activities || []).map((activity) => `${activity.runner_id}:${isoDate(new Date(activity.start_time))}`)
  );

  const alertRows = safeAssignments.flatMap((assignment) => {
    const runnerIds = resolveTargetRunnerIds(assignment, runnersByCoach, groupMembers);
    return runnerIds.flatMap((runnerId) => {
      if (completedKeys.has(`${runnerId}:${assignment.assigned_date}`)) return [];

      const runner = runnersById.get(runnerId);
      const runnerName = runner ? `${runner.first_name} ${runner.last_name}` : "Runner";
      const workoutName = assignment.workout_templates?.title || assignment.target_label || "assigned workout";

      return {
        runner_id: runnerId,
        coach_id: assignment.coach_id,
        alert_type: "missed_workout",
        message: `${runnerName} has no uploaded activity for ${workoutName} on ${assignment.assigned_date}.`,
        severity: "medium",
        dedupe_key: `${runnerId}:missed_workout:${assignment.id}`,
      };
    });
  });

  if (alertRows.length === 0) {
    return NextResponse.json({
      ok: true,
      scannedAssignments: safeAssignments.length,
      checkedRunners: assignedRunnerIds.size,
      insertedAlerts: 0,
    });
  }

  const { error: insertError } = await supabaseAdmin
    .from("coach_alerts")
    .upsert(alertRows, { onConflict: "dedupe_key", ignoreDuplicates: true });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    scannedAssignments: safeAssignments.length,
    checkedRunners: assignedRunnerIds.size,
    candidateAlerts: alertRows.length,
    insertedAlerts: alertRows.length,
  });
}

function resolveTargetRunnerIds(
  assignment: AssignmentRecord,
  runnersByCoach: Map<string, RunnerRecord[]>,
  groupMembers: Map<string, string[]>
) {
  if (assignment.target_type === "team") {
    return (runnersByCoach.get(assignment.coach_id) || []).map((runner) => runner.id);
  }

  if (assignment.target_type === "group") {
    return groupMembers.get(assignment.target_id) || [];
  }

  return [assignment.target_id];
}
