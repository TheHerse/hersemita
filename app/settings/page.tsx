import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import CoachHeader from "@/components/CoachHeader";
import { normalizeDistanceUnit } from "@/lib/distance-units";

async function saveCoachProfile(formData: FormData) {
  "use server";

  const { userId } = await auth();
  if (!userId) redirect("/");
  const supabase = await createServerSupabaseClient();

  const name = (formData.get("name") as string)?.trim();
  const schoolName = (formData.get("schoolName") as string)?.trim();
  const preferredDistanceUnit = normalizeDistanceUnit(formData.get("preferredDistanceUnit"));

  if (!name) {
    redirect("/settings?error=Coach%20name%20is%20required.");
  }

  const { data: existingCoach } = await supabase
    .from("coaches")
    .select("id")
    .eq("clerk_id", userId)
    .single();

  const payload = {
    email: userId,
    clerk_id: userId,
    name,
    school_name: schoolName || null,
    preferred_distance_unit: preferredDistanceUnit,
  };

  const { error } = existingCoach?.id
    ? await supabase
        .from("coaches")
        .update(payload)
        .eq("id", existingCoach.id)
    : await supabase
        .from("coaches")
        .insert(payload);

  if (error) {
    redirect(`/settings?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/settings?saved=1");
}

export default async function CoachSettingsPage({
  searchParams,
}: {
  searchParams?: Promise<{ saved?: string; error?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/");
  const supabase = await createServerSupabaseClient();

  const params = await searchParams;

  const { data: coach, error } = await supabase
    .from("coaches")
    .select("id, name, school_name, preferred_distance_unit")
    .eq("clerk_id", userId)
    .single();

  return (
    <div className="min-h-screen hersemita-page-bg text-white">
      <CoachHeader />

      <main className="mx-auto max-w-2xl p-4 sm:p-6 lg:p-8">
        <div className="mb-8 rounded-2xl border border-white/10 bg-white/10 p-5 shadow-2xl shadow-black/10 backdrop-blur sm:p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#00a7ff]">Coach Settings</p>
          <h2 className="mt-2 text-3xl font-bold text-white">Team Identity</h2>
          <p className="mt-2 text-[#cbd5e1]">
            Add your coach name and school or team name so the dashboard and parent messages feel official.
          </p>
        </div>

        {(error || params?.error) && (
          <div className="mb-6 rounded-xl border border-orange-400/30 bg-orange-400/10 p-4 text-sm text-orange-100">
            {params?.error || "Coach profile fields are not set up yet. Run supabase/coach-profile-fields.sql in Supabase SQL Editor, then refresh."}
          </div>
        )}

        {params?.saved && (
          <div className="mb-6 rounded-xl border border-[#00ff67]/30 bg-[#00ff67]/10 p-4 text-sm text-green-100">
            Coach profile saved.
          </div>
        )}

        <form action={saveCoachProfile} className="space-y-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Coach Display Name</label>
            <input
              name="name"
              type="text"
              required
              defaultValue={coach?.name || ""}
              placeholder="Coach Martinez"
              className="w-full rounded-lg border-2 border-slate-200 px-4 py-3 transition-colors focus:border-[#00a7ff] focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">School or Team Name</label>
            <input
              name="schoolName"
              type="text"
              defaultValue={coach?.school_name || ""}
              placeholder="Central High Cross Country"
              className="w-full rounded-lg border-2 border-slate-200 px-4 py-3 transition-colors focus:border-[#00a7ff] focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Default Distance Unit</label>
            <select
              name="preferredDistanceUnit"
              defaultValue={normalizeDistanceUnit(coach?.preferred_distance_unit)}
              className="w-full rounded-lg border-2 border-slate-200 bg-white px-4 py-3 text-slate-900 transition-colors focus:border-[#00a7ff] focus:outline-none"
            >
              <option value="miles">Miles</option>
              <option value="kilometers">Kilometers</option>
            </select>
            <p className="mt-1 text-sm text-slate-500">
              Runs are stored in miles for now. Runner entry and summaries can display your preferred unit.
            </p>
          </div>

          <button type="submit" className="w-full rounded-lg bg-gradient-to-r from-[#00ff67] to-[#00a7ff] px-4 py-3 text-lg font-bold text-white transition hover:shadow-lg hover:shadow-[#00a7ff]/25">
            Save Profile
          </button>
        </form>
      </main>
    </div>
  );
}
