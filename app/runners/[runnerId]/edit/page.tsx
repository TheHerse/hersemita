import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import type { CSSProperties } from "react";
import PhoneNumberInput from "@/components/PhoneNumberInput";
import CoachHeader from "@/components/CoachHeader";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { makeAccessCode, makeRunnerUsername } from "@/lib/runner-access";
import {
  DEFAULT_RUNNER_GROUP_NAMES,
  ensureDefaultRunnerGroups,
  syncRunnerAutomaticGroups,
  type RunnerDivision,
} from "@/lib/runner-groups";

type Group = {
  id: string;
  name: string;
  color: string;
};

function groupColorVar(color: string) {
  return { "--group-color": color } as CSSProperties;
}

async function getCoachId(userId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: coach } = await supabase
    .from("coaches")
    .select("id")
    .eq("clerk_id", userId)
    .single();

  return coach?.id as string | undefined;
}

async function updateRunner(runnerId: string, formData: FormData) {
  "use server";

  const { userId } = await auth();
  if (!userId) redirect("/");
  const supabase = await createServerSupabaseClient();

  const coachId = await getCoachId(userId);
  if (!coachId) redirect("/runners");

  const firstName = (formData.get("firstName") as string)?.trim();
  const lastName = (formData.get("lastName") as string)?.trim();
  const grade = parseInt(formData.get("grade") as string);
  const division = formData.get("division") as RunnerDivision;
  const parentPhone = (formData.get("parentPhone") as string)?.trim();
  const customGroupIds = formData.getAll("groups") as string[];

  const { data: runner } = await supabase
    .from("runners")
    .select("id")
    .eq("id", runnerId)
    .eq("coach_id", coachId)
    .single();

  if (!runner?.id || !firstName || !lastName || !grade || !division) {
    redirect("/runners");
  }

  const { error } = await supabase
    .from("runners")
    .update({
      first_name: firstName,
      last_name: lastName,
      grade,
      parent_phone: parentPhone || null,
    })
    .eq("id", runner.id)
    .eq("coach_id", coachId);

  if (error) {
    throw new Error(error.message);
  }

  await syncRunnerAutomaticGroups({
    coachId,
    runnerId: runner.id,
    grade,
    division,
    client: supabase,
  });

  const { data: allowedCustomGroups } = customGroupIds.length
    ? await supabase
        .from("runner_groups")
        .select("id")
        .eq("coach_id", coachId)
        .in("id", customGroupIds)
    : { data: [] };

  const { data: allCoachGroups } = await supabase
    .from("runner_groups")
    .select("id, name")
    .eq("coach_id", coachId);

  const customGroupIdsForCoach =
    allCoachGroups
      ?.filter((group) => !DEFAULT_RUNNER_GROUP_NAMES.includes(group.name))
      .map((group) => group.id) || [];
  if (customGroupIdsForCoach.length > 0) {
    await supabase
      .from("runner_group_members")
      .delete()
      .eq("runner_id", runner.id)
      .in("group_id", customGroupIdsForCoach);
  }

  const allowedIds = allowedCustomGroups?.map((group) => group.id) || [];
  if (allowedIds.length > 0) {
    await supabase.from("runner_group_members").insert(
      allowedIds.map((groupId) => ({
        group_id: groupId,
        runner_id: runner.id,
      }))
    );
  }

  redirect("/runners");
}

async function rotateRunnerCredentials(runnerId: string) {
  "use server";

  const { userId } = await auth();
  if (!userId) redirect("/");
  const supabase = await createServerSupabaseClient();

  const coachId = await getCoachId(userId);
  if (!coachId) redirect("/runners");

  const { data: runner } = await supabase
    .from("runners")
    .select("first_name, last_name")
    .eq("id", runnerId)
    .eq("coach_id", coachId)
    .single();

  if (!runner) redirect("/runners");

  const { error } = await supabase
    .from("runners")
    .update({
      access_code: makeAccessCode(),
      username: makeRunnerUsername(runner.first_name, runner.last_name),
    })
    .eq("id", runnerId)
    .eq("coach_id", coachId);

  if (error) {
    throw new Error(error.message);
  }

  redirect(`/runners/${runnerId}/edit`);
}

export default async function EditRunnerPage({
  params,
}: {
  params: Promise<{ runnerId: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/");
  const supabase = await createServerSupabaseClient();

  const { runnerId } = await params;
  const coachId = await getCoachId(userId);
  if (!coachId) redirect("/runners");

  await ensureDefaultRunnerGroups(coachId, supabase);

  const [{ data: runner }, { data: groups }] = await Promise.all([
    supabase
      .from("runners")
      .select("id, first_name, last_name, grade, parent_phone, access_code, username")
      .eq("id", runnerId)
      .eq("coach_id", coachId)
      .single(),
    supabase
      .from("runner_groups")
      .select("id, name, color")
      .eq("coach_id", coachId)
      .order("name", { ascending: true }),
  ]);

  if (!runner) redirect("/runners");

  const safeGroups = (groups || []) as Group[];
  const customGroups = safeGroups.filter((group) => !DEFAULT_RUNNER_GROUP_NAMES.includes(group.name));

  const { data: memberships } = safeGroups.length
    ? await supabase
        .from("runner_group_members")
        .select("group_id")
        .eq("runner_id", runner.id)
        .in("group_id", safeGroups.map((group) => group.id))
    : { data: [] };

  const assigned = new Set(memberships?.map((membership) => membership.group_id) || []);
  const division =
    (safeGroups.find((group) => ["Boys", "Girls"].includes(group.name) && assigned.has(group.id))?.name as RunnerDivision | undefined) ||
    "None / Other";

  return (
    <div className="min-h-screen hersemita-page-bg">
      <CoachHeader active="runners" />

      <main className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto">
        <div className="mb-8 rounded-2xl border border-white/10 bg-white/10 p-5 sm:p-6 shadow-2xl shadow-black/10 backdrop-blur">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#00a7ff]">Runner Profile</p>
          <h2 className="mt-2 text-3xl font-bold text-white">
            Edit {runner.first_name} {runner.last_name}
          </h2>
          <p className="mt-2 text-[#cbd5e1]">Grade changes update the automatic grade group so the roster stays consistent.</p>
        </div>

        <form action={updateRunner.bind(null, runner.id)} className="bg-white p-5 sm:p-6 rounded-xl shadow-sm border border-slate-200 space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">First Name</label>
              <input name="firstName" type="text" required defaultValue={runner.first_name} className="w-full px-4 py-2 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-[#00a7ff] transition-colors" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Last Name</label>
              <input name="lastName" type="text" required defaultValue={runner.last_name} className="w-full px-4 py-2 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-[#00a7ff] transition-colors" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Grade</label>
            <select name="grade" required defaultValue={runner.grade} className="w-full px-4 py-2 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-[#00a7ff] transition-colors bg-white">
              <option value="9">9th</option>
              <option value="10">10th</option>
              <option value="11">11th</option>
              <option value="12">12th</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Division</label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label className="cursor-pointer">
                <input type="radio" name="division" value="Boys" required defaultChecked={division === "Boys"} className="sr-only peer" />
                <span className="group-chip group-chip-striped flex items-center justify-center rounded-full border px-4 py-3 text-sm font-bold transition" style={groupColorVar("#ef4444")}>
                  Boys
                </span>
              </label>
              <label className="cursor-pointer">
                <input type="radio" name="division" value="Girls" required defaultChecked={division === "Girls"} className="sr-only peer" />
                <span className="group-chip group-chip-striped flex items-center justify-center rounded-full border px-4 py-3 text-sm font-bold transition" style={groupColorVar("#14b8a6")}>
                  Girls
                </span>
              </label>
              <label className="cursor-pointer">
                <input type="radio" name="division" value="None / Other" required defaultChecked={division === "None / Other"} className="sr-only peer" />
                <span className="group-chip group-chip-solid flex items-center justify-center rounded-full border px-4 py-3 text-sm font-bold transition" style={groupColorVar("#64748b")}>
                  None / Other
                </span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Parent Phone Number</label>
            <PhoneNumberInput name="parentPhone" placeholder="5551234567" defaultValue={runner.parent_phone} />
          </div>

          {customGroups.length > 0 && (
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Custom Groups</label>
              <div className="flex flex-wrap gap-2">
                {customGroups.map((group) => (
                  <label key={group.id} className="cursor-pointer">
                    <input type="checkbox" name="groups" value={group.id} defaultChecked={assigned.has(group.id)} className="sr-only peer" />
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

          <button type="submit" className="w-full bg-gradient-to-r from-[#00ff67] to-[#00a7ff] text-white py-3 rounded-lg hover:shadow-lg hover:shadow-[#00a7ff]/25 transition-all font-bold text-lg">
            Save Runner
          </button>
        </form>

        <div className="mt-6 rounded-xl border border-white/10 bg-white/10 p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-bold text-white">Runner Upload Credentials</h3>
              <p className="mt-1 text-sm text-[#cbd5e1]">Username: <span className="font-mono font-bold text-[#7dd3fc]">{runner.username || "Run the username SQL migration"}</span></p>
              <p className="mt-1 text-sm text-[#cbd5e1]">Code: <span className="font-mono font-bold text-[#7dd3fc]">{runner.access_code}</span></p>
            </div>
            <form action={rotateRunnerCredentials.bind(null, runner.id)}>
              <button type="submit" className="rounded-lg bg-red-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-600">
                Rotate Credentials
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
