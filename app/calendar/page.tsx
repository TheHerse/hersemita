import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import CoachHeader from "@/components/CoachHeader";
import WorkoutCalendarPlanner from "@/components/WorkoutCalendarPlanner";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { ensureDefaultRunnerGroups } from "@/lib/runner-groups";
import { getCurrentTeamContext } from "@/lib/team-context";

export default async function CalendarPage() {
  const { userId } = await auth();
  if (!userId) redirect("/");

  const supabase = await createServerSupabaseClient();
  const { data: coach } = await supabase
    .from("coaches")
    .select("id, name, school_name")
    .eq("clerk_id", userId)
    .single();
  const teamContext = await getCurrentTeamContext(userId);
  const legacyCoachId = teamContext?.team.owner_coach_id || teamContext?.coach.id || coach?.id;
  const teamId = teamContext?.team.id;

  if (legacyCoachId && teamId) {
    await ensureDefaultRunnerGroups(legacyCoachId, supabase, teamId);
  }

  const [{ data: runners }, { data: groups }] = teamId
    ? await Promise.all([
        supabase
          .from("runners")
          .select("id, first_name, last_name, grade")
          .eq("team_id", teamId)
          .is("archived_at", null)
          .order("last_name", { ascending: true }),
        supabase
          .from("runner_groups")
          .select("id, name, color")
          .eq("team_id", teamId)
          .order("name", { ascending: true }),
      ])
    : [{ data: [] }, { data: [] }];

  return (
    <div className="min-h-screen hersemita-page-bg">
      <CoachHeader active="calendar" />
      <WorkoutCalendarPlanner
        coachName={coach?.name || "Coach"}
        schoolName={teamContext?.team.school_name || teamContext?.team.name || coach?.school_name || "Workout Calendar"}
        runners={runners || []}
        groups={groups || []}
      />
    </div>
  );
}
