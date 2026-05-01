import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { DEFAULT_RUNNER_GROUP_NAMES, ensureDefaultRunnerGroups, getSolidGroupStyle, getStripedGroupStyle } from "@/lib/runner-groups";
import CoachMobileMenu from "@/components/CoachMobileMenu";

const CUSTOM_GROUP_COLORS = [
  "#00a7ff",
  "#00ff67",
  "#f97316",
  "#7c3aed",
  "#ef4444",
  "#14b8a6",
];

const GRADE_GROUP_ORDER = ["9th", "10th", "11th", "12th"];
const DIVISION_GROUP_ORDER = ["Boys", "Girls"];
const AUTOMATIC_GROUP_ORDER = [...GRADE_GROUP_ORDER, ...DIVISION_GROUP_ORDER];

type Group = {
  id: string;
  name: string;
  color: string;
};

type Runner = {
  id: string;
  first_name: string;
  last_name: string;
  grade: number;
};

function groupColorVar(color: string) {
  return { "--group-color": color } as CSSProperties;
}

function sortGroupsByNameOrder(groups: Group[], order: string[]) {
  return [...groups].sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name));
}

async function getCoachId(userId: string) {
  const { data: coach } = await supabase
    .from("coaches")
    .select("id")
    .eq("email", userId)
    .single();

  return coach?.id as string | undefined;
}

async function updateRunnerGroups(formData: FormData) {
  "use server";

  const { userId } = await auth();
  if (!userId) redirect("/");

  const coachId = await getCoachId(userId);
  if (!coachId) redirect("/groups");

  const runnerId = formData.get("runnerId") as string;
  const gradeGroupId = formData.get("gradeGroup") as string | null;
  const divisionGroupId = formData.get("divisionGroup") as string | null;
  const customGroupIds = formData.getAll("groups") as string[];
  const groupIds = [gradeGroupId, divisionGroupId, ...customGroupIds].filter(Boolean) as string[];

  const { data: runner } = await supabase
    .from("runners")
    .select("id")
    .eq("id", runnerId)
    .eq("coach_id", coachId)
    .single();

  if (!runner?.id) redirect("/groups");

  const { data: allowedGroups } = await supabase
    .from("runner_groups")
    .select("id, name")
    .eq("coach_id", coachId)
    .in("id", groupIds.length ? groupIds : ["00000000-0000-0000-0000-000000000000"]);

  const allowedGroupIds = allowedGroups?.map((group) => group.id) || [];
  const selectedGradeGroup = allowedGroups?.find((group) => GRADE_GROUP_ORDER.includes(group.name));
  const selectedGrade = selectedGradeGroup ? parseInt(selectedGradeGroup.name) : null;

  if (selectedGrade) {
    await supabase
      .from("runners")
      .update({ grade: selectedGrade })
      .eq("id", runnerId)
      .eq("coach_id", coachId);
  }

  await supabase.from("runner_group_members").delete().eq("runner_id", runnerId);

  if (allowedGroupIds.length > 0) {
    await supabase.from("runner_group_members").insert(
      allowedGroupIds.map((groupId) => ({
        group_id: groupId,
        runner_id: runnerId,
      }))
    );
  }

  redirect("/groups");
}

async function createCustomGroup(formData: FormData) {
  "use server";

  const { userId } = await auth();
  if (!userId) redirect("/");

  const coachId = await getCoachId(userId);
  if (!coachId) redirect("/groups");

  await ensureDefaultRunnerGroups(coachId);

  const name = (formData.get("name") as string)?.trim();
  const color = (formData.get("color") as string) || CUSTOM_GROUP_COLORS[0];

  if (!name) redirect("/groups");
  if (DEFAULT_RUNNER_GROUP_NAMES.includes(name)) {
    redirect(`/groups?error=${encodeURIComponent("That group already exists as an automatic group.")}`);
  }

  const { error } = await supabase.from("runner_groups").insert({
    coach_id: coachId,
    name,
    color,
  });

  if (error) {
    redirect(`/groups?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/groups");
}

async function deleteCustomGroup(groupId: string) {
  "use server";

  const { userId } = await auth();
  if (!userId) redirect("/");

  const coachId = await getCoachId(userId);
  if (!coachId) redirect("/groups");

  const { data: group } = await supabase
    .from("runner_groups")
    .select("id, name")
    .eq("id", groupId)
    .eq("coach_id", coachId)
    .single();

  if (!group || DEFAULT_RUNNER_GROUP_NAMES.includes(group.name)) {
    redirect("/groups");
  }

  await supabase
    .from("runner_groups")
    .delete()
    .eq("id", group.id)
    .eq("coach_id", coachId);

  redirect("/groups");
}

export default async function GroupsPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/");

  const params = await searchParams;
  const coachId = await getCoachId(userId);
  if (!coachId) redirect("/runners/new");

  const { error: defaultGroupsError } = await ensureDefaultRunnerGroups(coachId);

  const [{ data: groups, error: groupsError }, { data: runners }] = await Promise.all([
    supabase
      .from("runner_groups")
      .select("id, name, color")
      .eq("coach_id", coachId)
      .order("name", { ascending: true }),
    supabase
      .from("runners")
      .select("id, first_name, last_name, grade")
      .eq("coach_id", coachId)
      .order("last_name", { ascending: true }),
  ]);

  const safeGroups = (groups || []) as Group[];
  const automaticGroups = sortGroupsByNameOrder(
    safeGroups.filter((group) => DEFAULT_RUNNER_GROUP_NAMES.includes(group.name)),
    AUTOMATIC_GROUP_ORDER
  );
  const customGroups = safeGroups.filter((group) => !DEFAULT_RUNNER_GROUP_NAMES.includes(group.name));
  const safeRunners = (runners || []) as Runner[];

  const { data: memberships } = safeGroups.length
    ? await supabase
        .from("runner_group_members")
        .select("group_id, runner_id")
        .in("group_id", safeGroups.map((group) => group.id))
    : { data: [] };

  const runnerGroupMap = new Map<string, Set<string>>();
  memberships?.forEach((membership) => {
    const existing = runnerGroupMap.get(membership.runner_id) || new Set<string>();
    existing.add(membership.group_id);
    runnerGroupMap.set(membership.runner_id, existing);
  });

  return (
    <div className="min-h-screen hersemita-page-bg text-white">
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
            <Link href="/runners" className="shrink-0 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-[#00a7ff]/60 hover:text-[#00a7ff]">
              Runners
            </Link>
            <Link href="/activities" className="shrink-0 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-[#00a7ff]/60 hover:text-[#00a7ff]">
              Activities
            </Link>
            <Link href="/settings" className="shrink-0 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-[#00a7ff]/60 hover:text-[#00a7ff]">
              Settings
            </Link>
          </div>
          <CoachMobileMenu
            links={[
              { href: "/dashboard", label: "Dashboard" },
              { href: "/runners", label: "Runners" },
              { href: "/activities", label: "Activities" },
              { href: "/runners/new", label: "Add Runner" },
              { href: "/runners/message", label: "Message Parents" },
              { href: "/settings", label: "Settings" },
            ]}
          />
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        <div className="mb-8 rounded-2xl border border-white/10 bg-white/10 p-5 sm:p-6 shadow-2xl shadow-black/10 backdrop-blur">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#00a7ff]">Roster Groups</p>
          <h2 className="mt-2 text-3xl font-bold text-white sm:text-4xl">Groups and Tags</h2>
          <p className="mt-2 max-w-3xl text-[#cbd5e1]">
            Grade and gender groups are automatic. Coaches can add their own groups like Varsity, JV, Travel Squad, Injured, or Meet Roster.
          </p>
        </div>

        {(groupsError || defaultGroupsError) && (
          <div className="mb-6 rounded-xl border border-orange-400/30 bg-orange-400/10 p-4 text-sm text-orange-100">
            Groups are not set up in Supabase yet. Run the SQL in <span className="font-mono">supabase/runner-groups.sql</span>, then refresh this page.
          </div>
        )}

        {params?.error && (
          <div className="mb-6 rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-100">
            {params.error}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <section className="rounded-2xl border border-white/10 bg-white/10 p-5 sm:p-6 shadow-2xl shadow-black/20 backdrop-blur">
            <h3 className="text-xl font-bold text-white">Create Custom Group</h3>
            <p className="mt-1 text-sm text-[#cbd5e1]">Use whatever language your program already uses.</p>

            <form action={createCustomGroup} className="mt-5 space-y-5">
              <div>
                <label className="block text-sm font-semibold text-[#e2e8f0] mb-2">Group Name</label>
                <input
                  name="name"
                  type="text"
                  required
                  placeholder="Varsity, JV, Meet Roster"
                  className="w-full rounded-lg border border-white/10 bg-[#0f172a]/80 px-4 py-3 text-white placeholder:text-slate-500 focus:border-[#00a7ff] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#e2e8f0] mb-2">Color</label>
                <div className="grid grid-cols-6 gap-2">
                  {CUSTOM_GROUP_COLORS.map((color, index) => (
                    <label key={color} className="cursor-pointer">
                      <input type="radio" name="color" value={color} defaultChecked={index === 0} className="sr-only peer" />
                      <span
                        className="block h-9 rounded-lg border-2 border-white/10 peer-checked:border-white"
                        style={{ backgroundColor: color }}
                      />
                    </label>
                  ))}
                </div>
              </div>

              <button type="submit" className="w-full rounded-lg bg-gradient-to-r from-[#00ff67] to-[#00a7ff] px-4 py-3 font-bold text-white transition hover:shadow-lg hover:shadow-[#00a7ff]/20">
                Add Group
              </button>
            </form>

            <div className="mt-6 space-y-2">
              <h4 className="text-sm font-bold uppercase tracking-wide text-[#94a3b8]">Custom Groups</h4>
              {customGroups.length === 0 ? (
                <p className="text-sm text-[#cbd5e1]">No custom groups yet.</p>
              ) : (
                customGroups.map((group) => (
                  <div key={group.id} className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-[#111827] px-3 py-2">
                    <span
                      className="inline-flex rounded-full border px-3 py-1 text-sm font-semibold text-white"
                      style={getSolidGroupStyle(group.color)}
                    >
                      {group.name}
                    </span>
                    <form action={deleteCustomGroup.bind(null, group.id)}>
                      <button type="submit" className="rounded-md bg-red-500 px-2 py-1 text-xs font-bold text-white transition hover:bg-red-600">
                        Delete
                      </button>
                    </form>
                  </div>
                ))
              )}
            </div>

            <div className="mt-6 space-y-2">
              <h4 className="text-sm font-bold uppercase tracking-wide text-[#94a3b8]">Automatic Groups</h4>
              <div className="flex flex-wrap gap-2">
                {automaticGroups.map((group) => (
                  <span
                    key={group.id}
                    className="inline-flex rounded-full border px-3 py-1 text-sm font-semibold text-white"
                    style={getStripedGroupStyle(group.color)}
                  >
                    {group.name}
                  </span>
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/10 shadow-2xl shadow-black/20 backdrop-blur overflow-hidden">
            <div className="border-b border-white/10 bg-white/[0.06] px-5 py-4">
              <h3 className="text-xl font-bold text-white">Assign Runners</h3>
              <p className="mt-1 text-sm text-[#94a3b8]">Choose one grade, one division, and any custom groups.</p>
            </div>

            <div className="divide-y divide-white/10">
              {safeRunners.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-[#cbd5e1]">Add runners before assigning groups.</p>
                  <Link href="/runners/new" className="mt-4 inline-flex rounded-lg bg-gradient-to-r from-[#00ff67] to-[#00a7ff] px-5 py-3 font-bold text-white">
                    Add Runner
                  </Link>
                </div>
              ) : (
                safeRunners.map((runner) => {
                  const assigned = runnerGroupMap.get(runner.id) || new Set<string>();
                  const gradeGroups = sortGroupsByNameOrder(
                    automaticGroups.filter((group) => GRADE_GROUP_ORDER.includes(group.name)),
                    GRADE_GROUP_ORDER
                  );
                  const divisionGroups = sortGroupsByNameOrder(
                    automaticGroups.filter((group) => DIVISION_GROUP_ORDER.includes(group.name)),
                    DIVISION_GROUP_ORDER
                  );

                  return (
                    <form key={runner.id} action={updateRunnerGroups} className="p-5">
                      <input type="hidden" name="runnerId" value={runner.id} />
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                        <div className="min-w-0">
                          <div className="font-bold text-white">{runner.first_name} {runner.last_name}</div>
                          <div className="mt-1 text-sm text-[#94a3b8]">Grade {runner.grade}</div>
                        </div>

                        <div className="flex flex-1 flex-col gap-3">
                          {safeGroups.length === 0 ? (
                            <span className="text-sm text-[#cbd5e1]">Create a group first.</span>
                          ) : (
                            <>
                              <div>
                                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#94a3b8]">Grade</p>
                                <div className="flex flex-wrap gap-2">
                                  {gradeGroups.map((group) => (
                                    <label key={group.id} className="cursor-pointer">
                                      <input
                                        type="radio"
                                        name="gradeGroup"
                                        value={group.id}
                                        defaultChecked={assigned.has(group.id)}
                                        required
                                        className="sr-only peer"
                                      />
                                      <span
                                        className="group-chip group-chip-striped inline-flex rounded-full border px-3 py-1 text-sm font-semibold transition"
                                        style={groupColorVar(group.color)}
                                      >
                                        {group.name}
                                      </span>
                                    </label>
                                  ))}
                                </div>
                              </div>

                              <div>
                                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#94a3b8]">Division</p>
                                <div className="flex flex-wrap gap-2">
                                  {divisionGroups.map((group) => (
                                    <label key={group.id} className="cursor-pointer">
                                      <input
                                        type="radio"
                                        name="divisionGroup"
                                        value={group.id}
                                        defaultChecked={assigned.has(group.id)}
                                        required
                                        className="sr-only peer"
                                      />
                                      <span
                                        className="group-chip group-chip-striped inline-flex rounded-full border px-3 py-1 text-sm font-semibold transition"
                                        style={groupColorVar(group.color)}
                                      >
                                        {group.name}
                                      </span>
                                    </label>
                                  ))}
                                </div>
                              </div>

                              {customGroups.length > 0 && (
                                <div>
                                  <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#94a3b8]">Custom</p>
                                  <div className="flex flex-wrap gap-2">
                                    {customGroups.map((group) => (
                                      <label key={group.id} className="cursor-pointer">
                                        <input
                                          type="checkbox"
                                          name="groups"
                                          value={group.id}
                                          defaultChecked={assigned.has(group.id)}
                                          className="sr-only peer"
                                        />
                                        <span
                                          className="group-chip group-chip-solid inline-flex rounded-full border px-3 py-1 text-sm font-semibold transition"
                                          style={groupColorVar(group.color)}
                                        >
                                          {group.name}
                                        </span>
                                      </label>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </>
                          )}
                        </div>

                        <button type="submit" className="w-full rounded-lg bg-[#008cff] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#00a7ff] xl:w-auto">
                          Save Groups
                        </button>
                      </div>
                    </form>
                  );
                })
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
