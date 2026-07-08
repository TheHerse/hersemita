import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import CoachHeader from "@/components/CoachHeader";
import CoachAnalyticsWorkbench from "@/components/CoachAnalyticsWorkbench";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { ensureDefaultRunnerGroups } from "@/lib/runner-groups";

export default async function AnalyticsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/");

  const supabase = await createServerSupabaseClient();
  const { data: coach } = await supabase
    .from("coaches")
    .select("id, name, school_name, preferred_distance_unit")
    .eq("clerk_id", userId)
    .single();

  if (coach?.id) {
    await ensureDefaultRunnerGroups(coach.id, supabase);
  }

  const [{ data: runners }, { data: groups }, { data: activities }] = coach?.id
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
        supabase
          .from("activities")
          .select("id, runner_id, distance_miles, pace_per_mile, duration_seconds, start_time, verified, detected_app, runners!inner(coach_id)")
          .eq("runners.coach_id", coach.id)
          .order("start_time", { ascending: false }),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];

  const { data: memberships } = groups?.length
    ? await supabase
        .from("runner_group_members")
        .select("group_id, runner_id")
        .in("group_id", groups.map((group) => group.id))
    : { data: [] };

  return (
    <div className="min-h-screen hersemita-page-bg">
      <CoachHeader active="analytics" />
      <CoachAnalyticsWorkbench
        coachName={coach?.name || "Coach"}
        schoolName={coach?.school_name || "Team Analytics"}
        runners={runners || []}
        groups={groups || []}
        memberships={memberships || []}
        activities={activities || []}
        preferredDistanceUnit={coach?.preferred_distance_unit || "miles"}
      />
    </div>
  );
}
