import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getRunnerSession } from "@/lib/runner-session";

export async function GET() {
  const session = await getRunnerSession();
  if (!session) {
    return NextResponse.json({ error: "Runner session required" }, { status: 401 });
  }

  const { data: runner, error: runnerError } = await supabaseAdmin
    .from("runners")
    .select("id, coach_id, first_name, last_name, grade, coaches(name, school_name)")
    .eq("id", session.runnerId)
    .maybeSingle();

  if (runnerError || !runner) {
    return NextResponse.json({ error: "Runner not found" }, { status: 404 });
  }

  const { data: memberships } = await supabaseAdmin
    .from("runner_group_members")
    .select("group_id")
    .eq("runner_id", session.runnerId);

  const groupIds = (memberships || []).map((membership) => String(membership.group_id));
  const targetIds = ["team", session.runnerId, ...groupIds];

  const { data: assignments, error } = await supabaseAdmin
    .from("workout_assignments")
    .select("id, assigned_date, target_type, target_id, workout_templates(title, kind, miles, pace, warmup, main_set, cooldown, strength, location, notes, tags)")
    .eq("coach_id", runner.coach_id)
    .in("target_id", targetIds)
    .order("assigned_date", { ascending: true });

  const coach = Array.isArray(runner.coaches) ? runner.coaches[0] : runner.coaches;

  if (error) {
    return NextResponse.json({
      runner: {
        id: runner.id,
        name: `${runner.first_name} ${runner.last_name}`,
        grade: runner.grade,
        schoolName: coach?.school_name || "Your school",
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
      schoolName: coach?.school_name || "Your school",
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
