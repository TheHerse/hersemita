import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import type { CSSProperties } from "react";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import PhoneNumberInput from "@/components/PhoneNumberInput";
import CoachHeader from "@/components/CoachHeader";
import { makeRunnerUsername } from "@/lib/runner-access";
import { syncPrimaryRunnerGuardian } from "@/lib/guardian-contacts";
import {
  DEFAULT_RUNNER_GROUP_NAMES,
  ensureDefaultRunnerGroups,
  syncRunnerAutomaticGroups,
  type RunnerDivision,
} from "@/lib/runner-groups";
import { getCurrentTeamContext } from "@/lib/team-context";

function groupColorVar(color: string) {
  return { "--group-color": color } as CSSProperties;
}

export default async function NewRunnerPage() {
  const { userId } = await auth();
  
  if (!userId) {
    redirect("/");
  }
  const supabase = await createServerSupabaseClient();

  const teamContext = await getCurrentTeamContext(userId);
  const legacyCoachId = teamContext?.team.owner_coach_id || teamContext?.coach.id;
  const teamId = teamContext?.team.id;

  if (legacyCoachId && teamId) {
    await ensureDefaultRunnerGroups(legacyCoachId, supabase, teamId);
  }

  const { data: groups } = teamId
    ? await supabase
        .from("runner_groups")
        .select("id, name, color")
        .eq("team_id", teamId)
        .order("name", { ascending: true })
    : { data: [] };

  const customGroups = (groups || []).filter((group) => !DEFAULT_RUNNER_GROUP_NAMES.includes(group.name));

  async function addRunner(formData: FormData) {
    "use server";
    
    const { userId } = await auth();
    if (!userId) redirect("/");
    const supabase = await createServerSupabaseClient();
    
    const firstName = formData.get("firstName") as string;
    const lastName = formData.get("lastName") as string;
    const grade = parseInt(formData.get("grade") as string);
    const division = formData.get("division") as RunnerDivision;
    const parentPhone = formData.get("parentPhone") as string;
    const parentEmail = formData.get("parentEmail") as string;
    const ageStatus = String(formData.get("ageStatus") || "");
    const runnerEmail = String(formData.get("runnerEmail") || "").trim().toLowerCase();
    const customGroupIds = formData.getAll("groups") as string[];
    
    const username = makeRunnerUsername(firstName, lastName);

    if (!new Set(["minor_13_to_17", "adult_18_plus"]).has(ageStatus)) {
      throw new Error("High-school runners must be identified as age 13–17 or age 18+.");
    }
    if (ageStatus === "adult_18_plus" && !runnerEmail) {
      throw new Error("An adult runner email is required for adult self-consent.");
    }

    const teamContext = await getCurrentTeamContext(userId);
    const legacyCoachId = teamContext?.team.owner_coach_id || teamContext?.coach.id;
    const teamId = teamContext?.team.id;

    if (!legacyCoachId || !teamId) {
      console.error("Failed to find active team");
      return;
    }
    
    const { data: newRunner, error: runnerError } = await supabase
      .from("runners")
      .insert({
        coach_id: legacyCoachId,
        team_id: teamId,
        first_name: firstName,
        last_name: lastName,
        grade,
        parent_phone: parentPhone,
        access_code: null,
        access_code_hash: null,
        portal_status: ageStatus === "adult_18_plus" ? "pending_adult_consent" : "pending_parent_consent",
        age_status: ageStatus,
        age_status_attested_at: new Date().toISOString(),
        age_status_attested_by: userId,
        age_status_season: new Date().getFullYear().toString(),
        runner_email: runnerEmail || null,
        username,
      })
      .select("id")
      .single();
    
    if (runnerError) {
      console.error("Error adding runner:", runnerError);
      return;
    }

    if (newRunner?.id) {
      await syncRunnerAutomaticGroups({
        coachId: legacyCoachId,
        teamId,
        runnerId: newRunner.id,
        grade,
        division,
        client: supabase,
      });

      await syncPrimaryRunnerGuardian({
        client: supabase,
        teamId,
        runnerId: newRunner.id,
        phone: parentPhone,
        email: parentEmail,
      });

      const { data: extraGroups } = customGroupIds.length > 0
        ? await supabase
            .from("runner_groups")
            .select("id")
            .eq("team_id", teamId)
            .in("id", customGroupIds)
        : { data: [] };

      const allowedGroupIds = extraGroups?.map((group) => group.id) || [];

      if (allowedGroupIds.length > 0) {
        await supabase.from("runner_group_members").insert(
          allowedGroupIds.map((groupId) => ({
            group_id: groupId,
            runner_id: newRunner.id,
          }))
        );
      }
    }
    
    redirect(`/runners/${newRunner?.id}/edit`);
  }

  return (
    <div className="min-h-screen hersemita-page-bg">
      <CoachHeader active="runners" />

      <main className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto">
        <div className="mb-8 rounded-2xl border border-white/10 bg-white/10 p-5 sm:p-6 shadow-2xl shadow-black/10 backdrop-blur">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#00a7ff]">Roster Management</p>
          <h2 className="mt-2 text-3xl font-bold text-white">Add New Runner</h2>
          <p className="mt-2 text-[#cbd5e1]">Create an athlete profile, parent contact, and optional group assignments.</p>
        </div>
        
        <form action={addRunner} className="bg-white p-5 sm:p-6 rounded-xl shadow-sm border border-slate-200 space-y-6">
            <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">First Name</label>
                <input name="firstName" type="text" required className="w-full px-4 py-2 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-[#00a7ff] transition-colors" />
            </div>
            
            <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Last Name</label>
                <input name="lastName" type="text" required className="w-full px-4 py-2 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-[#00a7ff] transition-colors" />
            </div>
            
            <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Grade</label>
                <select name="grade" required className="w-full px-4 py-2 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-[#00a7ff] transition-colors bg-white">
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
                    <input type="radio" name="division" value="Boys" required className="sr-only peer" />
                    <span className="group-chip group-chip-striped flex items-center justify-center rounded-full border px-4 py-3 text-sm font-bold transition" style={groupColorVar("#ef4444")}>
                      Boys
                    </span>
                  </label>
                  <label className="cursor-pointer">
                    <input type="radio" name="division" value="Girls" required className="sr-only peer" />
                    <span className="group-chip group-chip-striped flex items-center justify-center rounded-full border px-4 py-3 text-sm font-bold transition" style={groupColorVar("#14b8a6")}>
                      Girls
                    </span>
                  </label>
                  <label className="cursor-pointer">
                    <input type="radio" name="division" value="None / Other" required className="sr-only peer" />
                    <span className="group-chip group-chip-solid flex items-center justify-center rounded-full border px-4 py-3 text-sm font-bold transition" style={groupColorVar("#64748b")}>
                      None / Other
                    </span>
                  </label>
                </div>
            </div>

            <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Legal age status</label>
                <select name="ageStatus" required defaultValue="" className="w-full rounded-lg border-2 border-slate-200 bg-white px-4 py-2 transition-colors focus:border-[#00a7ff] focus:outline-none">
                  <option value="" disabled>Select age status</option>
                  <option value="minor_13_to_17">Age 13–17</option>
                  <option value="adult_18_plus">Age 18 or older</option>
                </select>
                <p className="mt-1 text-xs text-slate-500">Hersemita does not store a birth date. Children under 13 cannot be enrolled.</p>
            </div>

            <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Runner Email</label>
                <input name="runnerEmail" type="email" placeholder="runner@example.com" className="w-full rounded-lg border-2 border-slate-200 px-4 py-2 transition-colors focus:border-[#00a7ff] focus:outline-none" />
                <p className="mt-1 text-xs text-slate-500">Required for runners age 18+ so they can consent for themselves. Do not enter a parent email here.</p>
            </div>
          
            <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Parent Phone Number</label>
                <PhoneNumberInput name="parentPhone" placeholder="5551234567" />
                <p className="text-xs text-slate-500 mt-1">Digits only. For SMS updates about practices, meets, runner check-ins, and training updates.</p>
            </div>

            <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Parent Portal Email</label>
                <input name="parentEmail" type="email" placeholder="parent@example.com" className="w-full rounded-lg border-2 border-slate-200 px-4 py-2 transition-colors focus:border-[#00a7ff] focus:outline-none" />
                <p className="mt-1 text-xs text-slate-500">Parents use this email to access their linked runner in the parent portal.</p>
            </div>

            <label className="flex gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <input
                type="checkbox"
                name="smsConsentConfirmed"
                required
                className="mt-1 h-4 w-4 rounded border-slate-300 text-[#00a7ff] focus:ring-[#00a7ff]"
              />
              <span>
                I confirm the parent or guardian provided this phone number and agreed to receive Hersemita SMS updates from this coach. Message frequency varies. Message and data rates may apply. Reply STOP to opt out or HELP for help.
              </span>
            </label>

            {customGroups.length > 0 && (
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Custom Groups</label>
                <div className="flex flex-wrap gap-2">
                  {customGroups.map((group) => (
                    <label key={group.id} className="cursor-pointer">
                      <input type="checkbox" name="groups" value={group.id} className="sr-only peer" />
                      <span
                        className="group-chip group-chip-solid inline-flex rounded-full border px-3 py-1 text-sm font-semibold transition"
                        style={groupColorVar(group.color)}
                      >
                        {group.name}
                      </span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-slate-500 mt-2">Grade and selected division are assigned automatically. Select any extra coach-created groups here.</p>
              </div>
            )}
          
            <button type="submit" className="primary-action w-full py-3 text-lg">
              Add Runner
            </button>
        </form>
      </main>
    </div>
  );
}
