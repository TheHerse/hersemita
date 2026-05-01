import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import ActivityAppBadge from "@/components/ActivityAppBadge";
import ScreenshotProofViewer from "@/components/ScreenshotProofViewer";
import { formatPace } from "@/lib/activity-format";
import { supabase } from "@/lib/supabase";

async function updateActivity(activityId: string, formData: FormData) {
  "use server";

  const { userId } = await auth();
  if (!userId) redirect("/");

  const { data: activity } = await supabase
    .from("activities")
    .select("id, runners!inner(coach_id, coaches!inner(email))")
    .eq("id", activityId)
    .eq("runners.coaches.email", userId)
    .single();

  if (!activity?.id) redirect("/activities");

  const distance = parseFloat(formData.get("distance") as string);
  const paceMinutes = parseInt(formData.get("paceMinutes") as string) || 0;
  const paceSeconds = parseInt(formData.get("paceSeconds") as string) || 0;
  const notes = (formData.get("notes") as string)?.trim();
  const verified = formData.get("verified") === "on";

  const { error } = await supabase
    .from("activities")
    .update({
      distance_miles: distance,
      pace_per_mile: paceMinutes * 60 + paceSeconds,
      notes: notes || null,
      verified,
    })
    .eq("id", activity.id);

  if (error) throw new Error(error.message);

  redirect("/activities");
}

export default async function EditActivityPage({
  params,
}: {
  params: Promise<{ activityId: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/");

  const { activityId } = await params;

  const { data: activity } = await supabase
    .from("activities")
    .select(`
      *,
      runners!inner (
        id,
        first_name,
        last_name,
        coach_id,
        coaches!inner(email)
      )
    `)
    .eq("id", activityId)
    .eq("runners.coaches.email", userId)
    .single();

  if (!activity) redirect("/activities");

  const paceMinutes = Math.floor((activity.pace_per_mile || 0) / 60);
  const paceSeconds = Math.round((activity.pace_per_mile || 0) % 60);

  return (
    <div className="min-h-screen hersemita-page-bg text-white">
      <header className="border-b border-slate-200 bg-white px-4 py-3 sticky top-0 z-50 shadow-sm sm:px-6 sm:py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg overflow-hidden bg-white">
              <Image src="/logo.png" alt="Hersemita" width={40} height={40} className="w-full h-full object-contain" />
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-[#00ff67] to-[#00a7ff] bg-clip-text text-transparent">
              Hersemita
            </h1>
          </Link>
          <Link href="/activities" className="rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/15">
            &larr; Back to Activities
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl p-4 sm:p-6 lg:p-8">
        <div className="mb-8 rounded-2xl border border-white/10 bg-white/10 p-5 shadow-2xl shadow-black/10 backdrop-blur sm:p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#00a7ff]">Edit Activity</p>
          <h2 className="mt-2 text-3xl font-bold text-white">
            {activity.runners.first_name} {activity.runners.last_name}
          </h2>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-[#cbd5e1]">
            <span>{new Date(activity.start_time).toLocaleDateString()}</span>
            <span>/</span>
            <ActivityAppBadge app={activity.detected_app} />
            <span>Current: {activity.distance_miles?.toFixed(2)} mi / {formatPace(activity.pace_per_mile)}/mi</span>
          </div>
        </div>

        <form action={updateActivity.bind(null, activity.id)} className="space-y-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Distance (miles)</label>
            <input
              name="distance"
              type="number"
              step="0.01"
              required
              defaultValue={activity.distance_miles?.toFixed(2)}
              className="w-full rounded-lg border-2 border-slate-200 px-4 py-3 transition-colors focus:border-[#00a7ff] focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Pace (min:sec per mile)</label>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
              <input
                name="paceMinutes"
                type="number"
                min="0"
                required
                defaultValue={paceMinutes}
                className="w-full rounded-lg border-2 border-slate-200 px-4 py-3 transition-colors focus:border-[#00a7ff] focus:outline-none"
              />
              <span className="font-bold text-slate-400">:</span>
              <input
                name="paceSeconds"
                type="number"
                min="0"
                max="59"
                required
                defaultValue={paceSeconds}
                className="w-full rounded-lg border-2 border-slate-200 px-4 py-3 transition-colors focus:border-[#00a7ff] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Coach Notes</label>
            <textarea
              name="notes"
              defaultValue={activity.notes || ""}
              rows={4}
              className="w-full rounded-lg border-2 border-slate-200 px-4 py-3 transition-colors focus:border-[#00a7ff] focus:outline-none"
            />
          </div>

          <label className="flex items-center gap-3 rounded-xl border border-slate-700 bg-[#111827] p-4">
            <input name="verified" type="checkbox" defaultChecked={activity.verified} className="h-5 w-5" />
            <span className="font-bold text-white">Mark as verified</span>
          </label>

          <ScreenshotProofViewer urls={activity.screenshot_urls} />

          <button type="submit" className="w-full rounded-lg bg-gradient-to-r from-[#00ff67] to-[#00a7ff] px-4 py-3 text-lg font-bold text-white transition hover:shadow-lg hover:shadow-[#00a7ff]/25">
            Save Activity
          </button>
        </form>
      </main>
    </div>
  );
}
