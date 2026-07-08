import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import ActivityAppBadge from "@/components/ActivityAppBadge";
import CoachHeader from "@/components/CoachHeader";
import ScreenshotProofViewer from "@/components/ScreenshotProofViewer";
import { formatPace } from "@/lib/activity-format";
import { distanceToMiles, distanceUnitLabel, milesToDistance, normalizeDistanceUnit, paceFromMiles, paceToMiles } from "@/lib/distance-units";
import { createServerSupabaseClient } from "@/lib/supabase-server";

function nullableNumber(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function workoutTypeValue(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return null;
  const allowed = new Set(["easy", "tempo", "interval", "long", "race", "recovery", "cross"]);
  return allowed.has(value) ? value : null;
}

function nestedCoach(activity: any) {
  const runner = Array.isArray(activity?.runners) ? activity.runners[0] : activity?.runners;
  return Array.isArray(runner?.coaches) ? runner.coaches[0] : runner?.coaches;
}

async function updateActivity(activityId: string, formData: FormData) {
  "use server";

  const { userId } = await auth();
  if (!userId) redirect("/");
  const supabase = await createServerSupabaseClient();

  const { data: activity } = await supabase
    .from("activities")
    .select("id, duration_seconds, runners!inner(coach_id, coaches!inner(clerk_id, preferred_distance_unit))")
    .eq("id", activityId)
    .eq("runners.coaches.clerk_id", userId)
    .single();

  if (!activity?.id) redirect("/activities");
  const coach = nestedCoach(activity);
  const preferredDistanceUnit = normalizeDistanceUnit(coach?.preferred_distance_unit);

  const distance = parseFloat(formData.get("distance") as string);
  const paceMinutes = parseInt(formData.get("paceMinutes") as string) || 0;
  const paceSeconds = parseInt(formData.get("paceSeconds") as string) || 0;
  const inputPaceSeconds = paceMinutes * 60 + paceSeconds;
  const notes = (formData.get("notes") as string)?.trim();
  const verified = formData.get("verified") === "on";
  const rpe = nullableNumber(formData.get("rpe"));
  const manualLoad = nullableNumber(formData.get("trainingLoad"));
  const estimatedLoad = manualLoad == null && rpe != null ? (Number(activity.duration_seconds || 0) / 60) * rpe * 0.6 : null;

  const { error } = await supabase
    .from("activities")
    .update({
      distance_miles: distanceToMiles(distance, preferredDistanceUnit),
      pace_per_mile: Math.round(paceToMiles(inputPaceSeconds, preferredDistanceUnit)),
      notes: notes || null,
      verified,
      workout_type: workoutTypeValue(formData.get("workoutType")),
      avg_hr: nullableNumber(formData.get("avgHr")),
      max_hr: nullableNumber(formData.get("maxHr")),
      rpe,
      soreness: nullableNumber(formData.get("soreness")),
      illness: formData.get("illness") === "on",
      training_load: manualLoad ?? estimatedLoad,
      training_load_source: manualLoad != null ? "manual" : estimatedLoad != null ? "estimated_rpe" : "manual",
      elevation_gain_m: nullableNumber(formData.get("elevationGainM")),
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
  const supabase = await createServerSupabaseClient();

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
        coaches!inner(clerk_id, preferred_distance_unit)
      )
    `)
    .eq("id", activityId)
    .eq("runners.coaches.clerk_id", userId)
    .single();

  if (!activity) redirect("/activities");

  const coach = nestedCoach(activity);
  const preferredDistanceUnit = normalizeDistanceUnit(coach?.preferred_distance_unit);
  const unitLabel = distanceUnitLabel(preferredDistanceUnit);
  const distanceDisplay = milesToDistance(Number(activity.distance_miles || 0), preferredDistanceUnit);
  const paceDisplaySeconds = paceFromMiles(Number(activity.pace_per_mile || 0), preferredDistanceUnit);
  const paceMinutes = Math.floor(paceDisplaySeconds / 60);
  const paceSeconds = Math.round(paceDisplaySeconds % 60);

  return (
    <div className="min-h-screen hersemita-page-bg text-white">
      <CoachHeader active="activities" />

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
            <span>Current: {distanceDisplay.toFixed(2)} {unitLabel} / {formatPace(paceDisplaySeconds)}/{unitLabel}</span>
          </div>
        </div>

        <form action={updateActivity.bind(null, activity.id)} className="space-y-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Distance ({unitLabel})</label>
            <input
              name="distance"
              type="number"
              step="0.01"
              required
              defaultValue={distanceDisplay.toFixed(2)}
              className="w-full rounded-lg border-2 border-slate-200 px-4 py-3 transition-colors focus:border-[#00a7ff] focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Pace (min:sec per {unitLabel})</label>
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

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Workout Type</label>
              <select
                name="workoutType"
                defaultValue={activity.workout_type || "easy"}
                className="w-full rounded-lg border-2 border-slate-200 px-4 py-3 transition-colors focus:border-[#00a7ff] focus:outline-none"
              >
                <option value="easy">Easy</option>
                <option value="tempo">Tempo</option>
                <option value="interval">Interval</option>
                <option value="long">Long Run</option>
                <option value="race">Race</option>
                <option value="recovery">Recovery</option>
                <option value="cross">Cross Training</option>
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Effort (RPE 1-10)</label>
              <input
                name="rpe"
                type="number"
                min="1"
                max="10"
                defaultValue={activity.rpe || ""}
                className="w-full rounded-lg border-2 border-slate-200 px-4 py-3 transition-colors focus:border-[#00a7ff] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Soreness (1-10)</label>
              <input
                name="soreness"
                type="number"
                min="1"
                max="10"
                defaultValue={activity.soreness || ""}
                className="w-full rounded-lg border-2 border-slate-200 px-4 py-3 transition-colors focus:border-[#00a7ff] focus:outline-none"
              />
            </div>
            <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-slate-700">
              <input name="illness" type="checkbox" defaultChecked={activity.illness} className="h-5 w-5" />
              <span className="font-bold">Sick today</span>
            </label>
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Avg HR</label>
              <input
                name="avgHr"
                type="number"
                min="1"
                max="250"
                defaultValue={activity.avg_hr || ""}
                className="w-full rounded-lg border-2 border-slate-200 px-4 py-3 transition-colors focus:border-[#00a7ff] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Max HR</label>
              <input
                name="maxHr"
                type="number"
                min="1"
                max="250"
                defaultValue={activity.max_hr || ""}
                className="w-full rounded-lg border-2 border-slate-200 px-4 py-3 transition-colors focus:border-[#00a7ff] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Garmin Load</label>
              <input
                name="trainingLoad"
                type="number"
                min="0"
                step="0.01"
                defaultValue={activity.training_load || ""}
                className="w-full rounded-lg border-2 border-slate-200 px-4 py-3 transition-colors focus:border-[#00a7ff] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Elevation Gain (m)</label>
              <input
                name="elevationGainM"
                type="number"
                min="0"
                defaultValue={activity.elevation_gain_m || ""}
                className="w-full rounded-lg border-2 border-slate-200 px-4 py-3 transition-colors focus:border-[#00a7ff] focus:outline-none"
              />
            </div>
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
