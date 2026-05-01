import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import type { CSSProperties } from "react";
import { supabase } from "@/lib/supabase";
import Image from "next/image";
import Link from "next/link";
import PhoneNumberInput from "@/components/PhoneNumberInput";
import { DEFAULT_RUNNER_GROUP_NAMES, ensureDefaultRunnerGroups, syncRunnerAutomaticGroups } from "@/lib/runner-groups";

function groupColorVar(color: string) {
  return { "--group-color": color } as CSSProperties;
}

export default async function NewRunnerPage() {
  const { userId } = await auth();
  
  if (!userId) {
    redirect("/");
  }

  const { data: coach } = await supabase
    .from("coaches")
    .select("id")
    .eq("email", userId)
    .single();

  if (coach?.id) {
    await ensureDefaultRunnerGroups(coach.id);
  }

  const { data: groups } = coach?.id
    ? await supabase
        .from("runner_groups")
        .select("id, name, color")
        .eq("coach_id", coach.id)
        .order("name", { ascending: true })
    : { data: [] };

  const customGroups = (groups || []).filter((group) => !DEFAULT_RUNNER_GROUP_NAMES.includes(group.name));

  async function addRunner(formData: FormData) {
    "use server";
    
    const { userId } = await auth();
    if (!userId) redirect("/");
    
    const firstName = formData.get("firstName") as string;
    const lastName = formData.get("lastName") as string;
    const grade = parseInt(formData.get("grade") as string);
    const division = formData.get("division") as "Boys" | "Girls";
    const parentPhone = formData.get("parentPhone") as string;
    const customGroupIds = formData.getAll("groups") as string[];
    
    const accessCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    const { data: coachData, error: coachError } = await supabase
      .from("coaches")
      .select("id")
      .eq("email", userId)
      .single();
    let coach = coachData;
    
    if (coachError && coachError.code !== 'PGRST116') {
      console.error("Error finding coach:", coachError);
    }
    
    if (!coach) {
      const { data: newCoach, error: createError } = await supabase
        .from("coaches")
        .insert({ email: userId, name: "Coach" })
        .select()
        .single();
      
      if (createError) {
        console.error("Error creating coach:", createError);
        return;
      }
      coach = newCoach;
    }
    
    if (!coach?.id) {
      console.error("Failed to get or create coach");
      return;
    }
    
    const { data: newRunner, error: runnerError } = await supabase
      .from("runners")
      .insert({
        coach_id: coach.id,
        first_name: firstName,
        last_name: lastName,
        grade,
        parent_phone: parentPhone,
        access_code: accessCode,
      })
      .select("id")
      .single();
    
    if (runnerError) {
      console.error("Error adding runner:", runnerError);
      return;
    }

    if (newRunner?.id) {
      await syncRunnerAutomaticGroups({
        coachId: coach.id,
        runnerId: newRunner.id,
        grade,
        division,
      });

      const { data: extraGroups } = customGroupIds.length > 0
        ? await supabase
            .from("runner_groups")
            .select("id")
            .eq("coach_id", coach.id)
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
    
    redirect("/runners");
  }

  return (
    <div className="min-h-screen hersemita-page-bg">
      <header className="bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-50 sm:px-6 sm:py-4">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg overflow-hidden bg-white">
            <Image src="/logo.png" alt="Hersemita" width={40} height={40} className="w-full h-full object-contain" />
          </div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-[#00ff67] to-[#00a7ff] bg-clip-text text-transparent">
            Hersemita
          </h1>
        </div>
        <Link href="/runners" className="w-full rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-center text-sm font-bold text-white transition hover:bg-white/15 sm:w-auto">
          &larr; Back to Runners
        </Link>
        </div>
      </header>

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
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="cursor-pointer">
                    <input type="radio" name="division" value="Boys" required className="sr-only peer" />
                    <span className="flex items-center justify-center rounded-lg border-2 border-slate-200 bg-slate-100 px-4 py-3 font-bold text-slate-700 transition peer-checked:border-[#ef4444] peer-checked:bg-red-50 peer-checked:text-red-700">
                      Boys
                    </span>
                  </label>
                  <label className="cursor-pointer">
                    <input type="radio" name="division" value="Girls" required className="sr-only peer" />
                    <span className="flex items-center justify-center rounded-lg border-2 border-slate-200 bg-slate-100 px-4 py-3 font-bold text-slate-700 transition peer-checked:border-[#14b8a6] peer-checked:bg-teal-50 peer-checked:text-teal-700">
                      Girls
                    </span>
                  </label>
                </div>
            </div>
          
            <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Parent Phone Number</label>
                <PhoneNumberInput name="parentPhone" placeholder="5551234567" />
                <p className="text-xs text-slate-500 mt-1">Digits only. For SMS updates about run verification.</p>
            </div>

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
                <p className="text-xs text-slate-500 mt-2">Grade and Boys/Girls are assigned automatically. Select any extra coach-created groups here.</p>
              </div>
            )}
          
            <button type="submit" className="w-full bg-gradient-to-r from-[#00ff67] to-[#00a7ff] text-white py-3 rounded-lg hover:shadow-lg hover:shadow-[#00a7ff]/25 transition-all font-bold text-lg">
              Add Runner
            </button>
        </form>
      </main>
    </div>
  );
}
