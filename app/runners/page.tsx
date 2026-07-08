import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import Link from "next/link";
import { ensureDefaultRunnerGroups } from "@/lib/runner-groups";
import CoachHeader from "@/components/CoachHeader";
import RosterWorkbench from "@/components/RosterWorkbench";

export default async function RunnersPage() {
  const { userId } = await auth();
  if (!userId) redirect("/");
  const supabase = await createServerSupabaseClient();

  const { data: coach } = await supabase
    .from("coaches")
    .select("id")
    .eq("clerk_id", userId)
    .single();

  if (coach?.id) {
    await ensureDefaultRunnerGroups(coach.id, supabase);
  }

  const { data: runners } = await supabase
    .from("runners")
    .select("*")
    .eq("coach_id", coach?.id)
    .order("first_name", { ascending: true })
    .order("last_name", { ascending: true });

  const { data: groups } = await supabase
    .from("runner_groups")
    .select("id, name, color")
    .eq("coach_id", coach?.id)
    .order("name", { ascending: true });

  const { data: memberships } = groups?.length
    ? await supabase
        .from("runner_group_members")
        .select("group_id, runner_id")
        .in("group_id", groups.map((group) => group.id))
    : { data: [] };

  const groupsById = new Map((groups || []).map((group) => [group.id, group]));
  const runnerGroups = new Map<string, typeof groups>();

  memberships?.forEach((membership) => {
    const group = groupsById.get(membership.group_id);
    if (!group) return;
    const existing = runnerGroups.get(membership.runner_id) || [];
    existing.push(group);
    runnerGroups.set(membership.runner_id, existing);
  });

  const runnerCount = runners?.length || 0;
  const runnersWithParentPhone = runners?.filter((runner) => runner.parent_phone).length || 0;
  const rosterRows = (runners || []).map((runner) => ({
    ...runner,
    groups: runnerGroups.get(runner.id) || [],
  }));

  return (
    <div className="min-h-screen hersemita-page-bg text-[#f8fafc]">
      <CoachHeader active="runners" />

      <main className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
        <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between rounded-2xl border border-white/10 bg-white/10 p-6 shadow-2xl shadow-black/10 backdrop-blur">
          <div className="min-w-0">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#00a7ff]">Roster Management</p>
            <h2 className="mt-2 text-3xl font-bold text-white sm:text-4xl">My Runners</h2>
            <p className="mt-2 max-w-2xl text-[#cbd5e1]">
              Manage athlete upload credentials, parent contact info, uploads, and test runners from one place.
            </p>
            {runners && runners.length > 0 && (
              <Link href="/runners/new" className="primary-action mt-5 inline-flex px-5 py-3">
                Add Runner
              </Link>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:min-w-[420px]">
            <div className="rounded-xl border border-white/15 bg-white/10 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#94a3b8]">Runners</p>
              <p className="mt-2 text-3xl font-bold text-[#00a7ff]">{runnerCount}</p>
            </div>
            <div className="rounded-xl border border-white/15 bg-white/10 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#94a3b8]">Parent Phones</p>
              <p className="mt-2 text-3xl font-bold text-[#00ff67]">{runnersWithParentPhone}</p>
            </div>
            <div className="rounded-xl border border-white/15 bg-white/10 p-4 col-span-2 sm:col-span-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#94a3b8]">Missing Phones</p>
              <p className="mt-2 text-3xl font-bold text-orange-400">{runnerCount - runnersWithParentPhone}</p>
            </div>
          </div>
        </div>
        
        {runners && runners.length > 0 ? (
          <RosterWorkbench runners={rosterRows} groups={groups || []} />
        ) : (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-10 text-center shadow-2xl shadow-black/20">
            <h3 className="text-2xl font-bold text-white">No runners added yet</h3>
            <p className="mx-auto mt-3 max-w-md text-[#cbd5e1]">
              Add your first athlete to generate upload credentials and start collecting run screenshots.
            </p>
            <Link href="/runners/new" className="primary-action mt-6 inline-flex px-5 py-3">
              Add First Runner
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
