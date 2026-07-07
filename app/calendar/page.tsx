import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import CoachHeader from "@/components/CoachHeader";
import WorkoutCalendarPlanner from "@/components/WorkoutCalendarPlanner";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { ensureDefaultRunnerGroups } from "@/lib/runner-groups";

export default async function CalendarPage() {
  const { userId } = await auth();
  if (!userId) redirect("/");

  const supabase = await createServerSupabaseClient();
  const { data: coach } = await supabase
    .from("coaches")
    .select("id, name, school_name")
    .eq("clerk_id", userId)
    .single();

  if (coach?.id) {
    await ensureDefaultRunnerGroups(coach.id, supabase);
  }

  const [{ data: runners }, { data: groups }] = coach?.id
    ? await Promise.all([
        supabase
          .from("runners")
          .select("id, first_name, last_name, grade")
          .eq("coach_id", coach.id)
          .order("last_name", { ascending: true }),
        supabase
          .from("runner_groups")
          .select("id, name, color")
          .eq("coach_id", coach.id)
          .order("name", { ascending: true }),
      ])
    : [{ data: [] }, { data: [] }];

  return (
    <div className="min-h-screen hersemita-page-bg">
      <CoachHeader active="calendar" />
      <WorkoutCalendarPlanner
        coachName={coach?.name || "Coach"}
        schoolName={coach?.school_name || "Workout Calendar"}
        runners={runners || []}
        groups={groups || []}
      />
    </div>
  );
}
