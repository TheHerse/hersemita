import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getRunnerSession } from "@/lib/runner-session";

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export async function GET() {
  const session = await getRunnerSession();
  if (!session) {
    return NextResponse.json({ error: "Runner session required" }, { status: 401 });
  }

  const { data: runner, error: runnerError } = await supabaseAdmin
    .from("runners")
    .select("id, team_id, first_name, last_name, grade")
    .eq("id", session.runnerId)
    .maybeSingle();

  if (runnerError || !runner) {
    return NextResponse.json({ error: "Runner not found" }, { status: 404 });
  }

  const [{ data: team }, { data: memberships }] = await Promise.all([
    runner.team_id
      ? supabaseAdmin
          .from("teams")
          .select("name, school_name, owner_coach_id")
          .eq("id", runner.team_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabaseAdmin
    .from("runner_group_members")
    .select("group_id")
      .eq("runner_id", session.runnerId),
  ]);

  const { data: coach } = team?.owner_coach_id
    ? await supabaseAdmin
        .from("coaches")
        .select("name")
        .eq("id", team.owner_coach_id)
        .maybeSingle()
    : { data: null };

  const groupIds = (memberships || []).map((membership) => String(membership.group_id));
  const targetIds = ["team", session.runnerId, ...groupIds];

  const { data: assignments, error } = await supabaseAdmin
    .from("workout_assignments")
    .select("id, assigned_date, target_type, target_id, workout_templates(title, kind, miles, pace, warmup, main_set, cooldown, strength, location, notes, tags)")
    .eq("team_id", runner.team_id)
    .in("target_id", targetIds)
    .gte("assigned_date", isoDate(new Date()))
    .order("assigned_date", { ascending: true });

  if (error) {
    return NextResponse.json({
      runner: {
        id: runner.id,
        name: `${runner.first_name} ${runner.last_name}`,
        grade: runner.grade,
        schoolName: team?.school_name || team?.name || "Your school",
        coachName: coach?.name || "Coach",
      },
      assignments: [],
      setupRequired: true,
      error: error.message,
    });
  }

  return NextResponse.json({
    runner: {
      id: runner.id,
      name: `${runner.first_name} ${runner.last_name}`,
      grade: runner.grade,
      schoolName: team?.school_name || team?.name || "Your school",
      coachName: coach?.name || "Coach",
    },
    assignments: (assignments || []).map((assignment) => {
      const template = Array.isArray(assignment.workout_templates)
        ? assignment.workout_templates[0]
        : assignment.workout_templates;

      return {
        id: assignment.id,
        date: assignment.assigned_date,
        targetType: assignment.target_type,
        template,
      };
    }),
    setupRequired: false,
  });
}
