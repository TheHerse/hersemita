import { NextResponse } from "next/server";
import { clearRunnerSession, getRunnerSession } from "@/lib/runner-session";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { normalizeDistanceUnit } from "@/lib/distance-units";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getRunnerSession();
  if (!session) {
    return NextResponse.json({ error: "Runner session required" }, { status: 401 });
  }

  const { data: runner } = await supabaseAdmin
    .from("runners")
    .select("id, first_name, last_name, grade, coaches(name, school_name, preferred_distance_unit)")
    .eq("id", session.runnerId)
    .maybeSingle();

  const coach = runner?.coaches ? (Array.isArray(runner.coaches) ? runner.coaches[0] : runner.coaches) : null;

  return NextResponse.json({
    runner: {
      id: session.runnerId,
      name: runner ? `${runner.first_name} ${runner.last_name}` : session.runnerName,
      grade: runner?.grade || null,
      schoolName: coach?.school_name || "Your school",
      coachName: coach?.name || "Coach",
      preferredDistanceUnit: normalizeDistanceUnit(coach?.preferred_distance_unit),
    },
  });
}

export async function DELETE() {
  await clearRunnerSession();
  return NextResponse.json({ ok: true });
}
