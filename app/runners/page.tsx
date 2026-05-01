import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Image from "next/image";
import Link from "next/link";
import { DEFAULT_RUNNER_GROUP_NAMES, ensureDefaultRunnerGroups, getSolidGroupStyle, getStripedGroupStyle } from "@/lib/runner-groups";
import CoachMobileMenu from "@/components/CoachMobileMenu";

export default async function RunnersPage() {
  const { userId } = await auth();
  if (!userId) redirect("/");

  const { data: coach } = await supabase
    .from("coaches")
    .select("id")
    .eq("email", userId)
    .single();

  if (coach?.id) {
    await ensureDefaultRunnerGroups(coach.id);
  }

  const { data: runners } = await supabase
    .from("runners")
    .select("*")
    .eq("coach_id", coach?.id)
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

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(0,167,255,0.18),transparent_34%),radial-gradient(circle_at_top_right,rgba(0,255,103,0.12),transparent_30%),linear-gradient(135deg,#0f172a_0%,#1e293b_48%,#0f172a_100%)] text-[#f8fafc]">
      <header className="border-b border-slate-200 bg-white px-4 py-3 sticky top-0 z-50 shadow-sm sm:px-6 sm:py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg overflow-hidden bg-white">
            <Image src="/logo.png" alt="Hersemita" width={40} height={40} className="w-full h-full object-contain" />
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-[#00ff67] to-[#00a7ff] bg-clip-text text-transparent">
              Hersemita
            </h1>
          </Link>
          <div className="hidden items-center gap-3 sm:flex">
            <Link href="/dashboard" className="shrink-0 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-[#00a7ff]/60 hover:text-[#00a7ff]">
              Dashboard
            </Link>
            <Link href="/groups" className="shrink-0 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-[#00a7ff]/60 hover:text-[#00a7ff]">
              Groups
            </Link>
            <Link href="/activities" className="shrink-0 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-[#00a7ff]/60 hover:text-[#00a7ff]">
              Activities
            </Link>
            <Link href="/runners/new" className="shrink-0 rounded-lg bg-gradient-to-r from-[#00ff67] to-[#00a7ff] px-4 py-2 text-sm font-bold text-white transition hover:shadow-lg hover:shadow-[#00a7ff]/20">
              Add Runner
            </Link>
            <Link href="/settings" className="shrink-0 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-[#00a7ff]/60 hover:text-[#00a7ff]">
              Settings
            </Link>
          </div>
          <CoachMobileMenu
            links={[
              { href: "/dashboard", label: "Dashboard" },
              { href: "/groups", label: "Groups" },
              { href: "/activities", label: "Activities" },
              { href: "/runners/new", label: "Add Runner" },
              { href: "/runners/message", label: "Message Parents" },
              { href: "/settings", label: "Settings" },
            ]}
          />
        </div>
      </header>

      <main className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
        <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between rounded-2xl border border-white/10 bg-white/10 p-6 shadow-2xl shadow-black/10 backdrop-blur">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#00a7ff]">Roster Management</p>
            <h2 className="mt-2 text-3xl font-bold text-white sm:text-4xl">My Runners</h2>
            <p className="mt-2 max-w-2xl text-[#cbd5e1]">
              Manage athlete access codes, parent contact info, uploads, and test runners from one place.
            </p>
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
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/10 shadow-2xl shadow-black/20 backdrop-blur">
            <div className="border-b border-white/10 bg-white/[0.06] px-5 py-4">
              <h3 className="text-lg font-bold text-white">Team Roster</h3>
              <p className="mt-1 text-sm text-[#94a3b8]">Use groups for future chart filters, messaging lists, and roster reports.</p>
            </div>
            <div className="space-y-4 p-4 md:hidden">
              {runners.map((runner) => (
                <div key={runner.id} className="rounded-xl border border-white/10 bg-[#111827] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-bold text-white">{runner.first_name} {runner.last_name}</div>
                      <div className="mt-1 text-sm text-[#94a3b8]">Grade {runner.grade}</div>
                    </div>
                    <span className="rounded-md border border-[#00a7ff]/30 bg-[#00a7ff]/10 px-3 py-1 font-mono text-sm font-bold text-[#7dd3fc]">
                      {runner.access_code}
                    </span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {(runnerGroups.get(runner.id) || []).map((group) => (
                      <span
                        key={group.id}
                        className="rounded-full border px-3 py-1 text-xs font-bold text-white"
                        style={DEFAULT_RUNNER_GROUP_NAMES.includes(group.name) ? getStripedGroupStyle(group.color) : getSolidGroupStyle(group.color)}
                      >
                        {group.name}
                      </span>
                    ))}
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <Link href={`/runners/upload/${runner.id}`} className="rounded-lg bg-[#008cff] px-3 py-2 text-center text-sm font-bold text-white shadow-sm shadow-[#008cff]/20 transition hover:bg-[#00a7ff]">
                      Upload
                    </Link>
                    <Link href={`/runner/login?code=${runner.access_code}`} className="rounded-lg bg-[#00d95a] px-3 py-2 text-center text-sm font-bold text-white shadow-sm shadow-[#00d95a]/20 transition hover:bg-[#00ff67]">
                      Portal
                    </Link>
                    <Link href={`/runners/${runner.id}/edit`} className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-center text-sm font-bold text-white transition hover:bg-white/15">
                      Edit
                    </Link>
                    <Link href={`/runners/${runner.id}/delete`} className="rounded-lg bg-red-500 px-3 py-2 text-center text-sm font-semibold text-white transition-colors hover:bg-red-600">
                      Delete
                    </Link>
                  </div>
                  <div className="mt-3 text-xs text-[#94a3b8]">
                    {runner.parent_phone ? `Parent: ${runner.parent_phone}` : "No parent phone"}
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[880px]">
              <thead className="border-b border-white/10 bg-[#111827]">
                <tr>
                  <th className="text-left px-6 py-4 text-xs font-bold uppercase tracking-wide text-[#94a3b8]">Runner</th>
                  <th className="text-left px-6 py-4 text-xs font-bold uppercase tracking-wide text-[#94a3b8]">Grade</th>
                  <th className="text-left px-6 py-4 text-xs font-bold uppercase tracking-wide text-[#94a3b8]">Groups</th>
                  <th className="text-left px-6 py-4 text-xs font-bold uppercase tracking-wide text-[#94a3b8]">Access Code</th>
                  <th className="text-left px-6 py-4 text-xs font-bold uppercase tracking-wide text-[#94a3b8]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {runners.map((runner) => (
                  <tr key={runner.id} className="transition hover:bg-white/[0.04]">
                    <td className="px-6 py-4">
                      <div className="font-bold text-white">{runner.first_name} {runner.last_name}</div>
                      <div className="mt-1 text-xs text-[#94a3b8]">Runner profile</div>
                    </td>
                    <td className="px-6 py-4 text-[#cbd5e1]">{runner.grade}th</td>
                    <td className="px-6 py-4">
                      {(runnerGroups.get(runner.id) || []).length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {(runnerGroups.get(runner.id) || []).map((group) => (
                            <span
                              key={group.id}
                              className="rounded-full border px-3 py-1 text-xs font-bold text-white"
                              style={DEFAULT_RUNNER_GROUP_NAMES.includes(group.name) ? getStripedGroupStyle(group.color) : getSolidGroupStyle(group.color)}
                            >
                              {group.name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="rounded-full border border-orange-400/30 bg-orange-400/10 px-3 py-1 text-xs font-semibold text-orange-300">
                          Ungrouped
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="rounded-md border border-[#00a7ff]/30 bg-[#00a7ff]/10 px-3 py-1 font-mono text-sm font-bold text-[#7dd3fc]">
                        {runner.access_code}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-2">
                        <Link href={`/runners/upload/${runner.id}`} className="rounded-lg bg-[#008cff] px-3 py-2 text-sm font-bold text-white shadow-sm shadow-[#008cff]/20 transition hover:bg-[#00a7ff] hover:shadow-md hover:shadow-[#00a7ff]/30">
                          Upload Run
                        </Link>
                        <Link 
                          href={`/runner/login?code=${runner.access_code}`} 
                          className="rounded-lg bg-[#00d95a] px-3 py-2 text-sm font-bold text-white shadow-sm shadow-[#00d95a]/20 transition hover:bg-[#00ff67] hover:shadow-md hover:shadow-[#00ff67]/25"
                        >
                          Portal Link
                        </Link>
                        <Link
                          href={`/runners/${runner.id}/edit`}
                          className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-white/15"
                        >
                          Edit
                        </Link>
                        <Link
                          href={`/runners/${runner.id}/delete`}
                          className="rounded-lg bg-red-500 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-600"
                        >
                          Delete
                        </Link>
                      </div>
                      <div className="mt-2 text-xs text-[#94a3b8]">
                        {runner.parent_phone ? `Parent: ${runner.parent_phone}` : "No parent phone"}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-10 text-center shadow-2xl shadow-black/20">
            <h3 className="text-2xl font-bold text-white">No runners added yet</h3>
            <p className="mx-auto mt-3 max-w-md text-[#cbd5e1]">
              Add your first athlete to generate an upload access code and start collecting run screenshots.
            </p>
            <Link href="/runners/new" className="mt-6 inline-flex rounded-lg bg-gradient-to-r from-[#00ff67] to-[#00a7ff] px-5 py-3 font-bold text-white transition hover:shadow-lg hover:shadow-[#00a7ff]/20">
              Add First Runner
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
