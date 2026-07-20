import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import ParentHeader from "@/components/ParentHeader";
import { getParentPortalContext } from "@/lib/parent-context";
import { supabaseAdmin } from "@/lib/supabase-admin";

type Activity = {
  id: string;
  distance_miles: number | null;
  pace_per_mile: number | null;
  duration_seconds: number | null;
  start_time: string;
  training_load: number | null;
  rpe: number | null;
  soreness: number | null;
  notes: string | null;
};

type Alert = {
  id: string;
  message: string | null;
  severity: string | null;
  created_at: string;
};

type RecoveryLog = {
  id: string;
  log_date: string;
  hrv_ms: number | string | null;
  hrv_status: string | null;
  soreness: number | null;
  resting_hr: number | null;
  sleep_score: number | null;
  sleep_duration_min: number | null;
  body_battery: number | null;
  illness: boolean | null;
};

function runnerName(runner: { first_name: string; last_name: string }) {
  return `${runner.first_name} ${runner.last_name}`.trim();
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDistance(miles: number, unit: string) {
  if (unit === "kilometers") return `${(miles * 1.609344).toFixed(1)} km`;
  return `${miles.toFixed(1)} mi`;
}

function formatPace(seconds: number | null, unit: string) {
  if (!seconds) return "--";
  const adjusted = unit === "kilometers" ? seconds / 1.609344 : seconds;
  const minutes = Math.floor(adjusted / 60);
  const remaining = Math.round(adjusted % 60).toString().padStart(2, "0");
  return `${minutes}:${remaining}/${unit === "kilometers" ? "km" : "mi"}`;
}

function sumDistance(activities: Activity[]) {
  return activities.reduce((total, activity) => total + Number(activity.distance_miles || 0), 0);
}

function averagePace(activities: Activity[]) {
  const paceValues = activities
    .map((activity) => activity.pace_per_mile)
    .filter((pace): pace is number => Boolean(pace));
  if (paceValues.length === 0) return null;
  return Math.round(paceValues.reduce((total, pace) => total + pace, 0) / paceValues.length);
}

function longestRun(activities: Activity[]) {
  return activities.reduce((longest, activity) => Math.max(longest, Number(activity.distance_miles || 0)), 0);
}

function formatSleep(minutes: number | null) {
  if (!minutes) return "--";
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  if (remaining === 0) return `${hours}h`;
  return `${hours}h ${remaining}m`;
}

function formatHrv(value: number | string | null) {
  if (value == null) return "--";
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? `${Math.round(numberValue)} ms` : "--";
}

export default async function ParentRunnerDetailPage({
  params,
}: {
  params: Promise<{ runnerId: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/parent/sign-in");

  const { runnerId } = await params;
  const context = await getParentPortalContext(userId);
  const decodedRunnerId = decodeURIComponent(runnerId).toLowerCase();
  const runner = context?.runners.find((item) => {
    const username = String(item.username || "").toLowerCase();
    return username ? username === decodedRunnerId : item.id === runnerId;
  });
  if (!runner) redirect("/parent/dashboard");

  const [{ data: team }, { data: activities }, { data: alerts }, { data: recoveryLogs }] = await Promise.all([
    supabaseAdmin
      .from("teams")
      .select("id, name, school_name, default_distance_unit")
      .eq("id", runner.team_id)
      .single(),
    supabaseAdmin
      .from("activities")
      .select("id, distance_miles, pace_per_mile, duration_seconds, start_time, training_load, rpe, soreness, notes")
      .eq("runner_id", runner.id)
      .eq("verified", true)
      .order("start_time", { ascending: false })
      .limit(60),
    supabaseAdmin
      .from("coach_alerts")
      .select("id, message, severity, created_at")
      .eq("runner_id", runner.id)
      .eq("dismissed", false)
      .order("created_at", { ascending: false })
      .limit(8),
    supabaseAdmin
      .from("recovery_logs")
      .select("id, log_date, hrv_ms, hrv_status, resting_hr, sleep_score, sleep_duration_min, body_battery, soreness, illness")
      .eq("runner_id", runner.id)
      .order("log_date", { ascending: false })
      .limit(10),
  ]);

  const safeActivities = (activities || []) as Activity[];
  const safeAlerts = (alerts || []) as Alert[];
  const safeRecoveryLogs = (recoveryLogs || []) as RecoveryLog[];
  const distanceUnit = team?.default_distance_unit === "kilometers" ? "kilometers" : "miles";
  const now = new Date();
  const lastSevenDays = safeActivities.filter((activity) => now.getTime() - new Date(activity.start_time).getTime() <= 7 * 24 * 60 * 60 * 1000);
  const lastThirtyDays = safeActivities.filter((activity) => now.getTime() - new Date(activity.start_time).getTime() <= 30 * 24 * 60 * 60 * 1000);
  const bestPace = safeActivities
    .map((activity) => activity.pace_per_mile)
    .filter((pace): pace is number => Boolean(pace))
    .sort((a, b) => a - b)[0] || null;
  const latestRun = safeActivities[0] || null;
  const avgPace = averagePace(safeActivities);

  return (
    <div className="min-h-screen hersemita-page-bg">
      <ParentHeader />

      <main className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
        <section className="mb-6 rounded-2xl border border-white/10 bg-white/10 p-5 text-white shadow-2xl shadow-black/10 backdrop-blur sm:p-6">
          <Link href="/parent/dashboard" className="mb-4 inline-flex rounded-lg border border-white/15 bg-white/10 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/15">
            Back to dashboard
          </Link>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#00a7ff]">{team?.school_name || team?.name || "Team"}</p>
          <h1 className="mt-2 text-3xl font-bold sm:text-4xl">{runnerName(runner)}</h1>
          <p className="mt-2 text-[#cbd5e1]">Grade {runner.grade ?? "--"} / verified training updates only</p>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="section-card p-5">
            <p className="text-sm font-semibold text-slate-500">7 Days</p>
            <p className="mt-2 text-3xl font-bold text-[#00a7ff]">{formatDistance(sumDistance(lastSevenDays), distanceUnit)}</p>
          </div>
          <div className="section-card p-5">
            <p className="text-sm font-semibold text-slate-500">30 Days</p>
            <p className="mt-2 text-3xl font-bold text-[#00ff67]">{formatDistance(sumDistance(lastThirtyDays), distanceUnit)}</p>
          </div>
          <div className="section-card p-5">
            <p className="text-sm font-semibold text-slate-500">Verified Runs</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{safeActivities.length}</p>
          </div>
          <div className="section-card p-5">
            <p className="text-sm font-semibold text-slate-500">Best Pace</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{formatPace(bestPace, distanceUnit)}</p>
          </div>
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-3">
          <div className="section-card p-5">
            <p className="text-sm font-semibold text-slate-500">Latest Verified Run</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{latestRun ? formatDate(latestRun.start_time) : "--"}</p>
            <p className="mt-1 text-sm text-slate-500">{latestRun ? `${formatDistance(Number(latestRun.distance_miles || 0), distanceUnit)} at ${formatPace(latestRun.pace_per_mile, distanceUnit)}` : "No verified run yet"}</p>
          </div>
          <div className="section-card p-5">
            <p className="text-sm font-semibold text-slate-500">Average Pace</p>
            <p className="mt-2 text-2xl font-bold text-[#00a7ff]">{formatPace(avgPace, distanceUnit)}</p>
            <p className="mt-1 text-sm text-slate-500">Across verified training history</p>
          </div>
          <div className="section-card p-5">
            <p className="text-sm font-semibold text-slate-500">Longest Verified Run</p>
            <p className="mt-2 text-2xl font-bold text-[#00ff67]">{formatDistance(longestRun(safeActivities), distanceUnit)}</p>
            <p className="mt-1 text-sm text-slate-500">Shown only after coach approval</p>
          </div>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
          <div className="section-card p-5">
            <h2 className="text-xl font-bold text-slate-900">Training History</h2>
            {safeActivities.length === 0 ? (
              <div className="mt-4 rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
                No verified training has been posted yet.
              </div>
            ) : (
              <>
                <div className="mt-4 grid gap-3 md:hidden">
                  {safeActivities.map((activity) => (
                    <div key={activity.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-bold text-slate-900">{formatDate(activity.start_time)}</p>
                          <p className="mt-1 text-sm text-slate-500">{activity.notes || "Verified by coach"}</p>
                        </div>
                        <p className="font-bold text-[#00a7ff]">{formatDistance(Number(activity.distance_miles || 0), distanceUnit)}</p>
                      </div>
                      <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                        <div>
                          <p className="font-bold text-slate-900">{formatPace(activity.pace_per_mile, distanceUnit)}</p>
                          <p className="text-xs text-slate-500">Pace</p>
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{activity.training_load ?? "--"}</p>
                          <p className="text-xs text-slate-500">Load</p>
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{activity.rpe ?? "--"}</p>
                          <p className="text-xs text-slate-500">RPE</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 hidden overflow-x-auto md:block">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-3 py-3">Date</th>
                      <th className="px-3 py-3">Distance</th>
                      <th className="px-3 py-3">Pace</th>
                      <th className="px-3 py-3">Load</th>
                      <th className="px-3 py-3">RPE</th>
                      <th className="px-3 py-3">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {safeActivities.map((activity) => (
                      <tr key={activity.id} className="border-b border-slate-100 last:border-0">
                        <td className="px-3 py-3 font-semibold text-slate-900">{formatDate(activity.start_time)}</td>
                        <td className="px-3 py-3 font-bold text-[#00a7ff]">{formatDistance(Number(activity.distance_miles || 0), distanceUnit)}</td>
                        <td className="px-3 py-3 text-slate-700">{formatPace(activity.pace_per_mile, distanceUnit)}</td>
                        <td className="px-3 py-3 text-slate-700">{activity.training_load ?? "--"}</td>
                        <td className="px-3 py-3 text-slate-700">{activity.rpe ?? "--"}</td>
                        <td className="max-w-[260px] px-3 py-3 text-slate-500">{activity.notes || "--"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              </>
            )}
          </div>

          <aside className="space-y-6">
            <div className="section-card p-5">
              <h2 className="text-xl font-bold text-slate-900">Coach Notes</h2>
              {safeAlerts.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">No active coach alerts right now.</p>
              ) : (
                <div className="mt-4 space-y-3">
                  {safeAlerts.map((alert) => (
                    <div key={alert.id} className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                      <p className="text-xs font-bold uppercase tracking-wide text-amber-700">{alert.severity || "Note"}</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">{alert.message || "Coach alert"}</p>
                      <p className="mt-2 text-xs text-slate-500">{formatDate(alert.created_at)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="section-card p-5">
              <h2 className="text-xl font-bold text-slate-900">Recovery Check-ins</h2>
              {safeRecoveryLogs.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">No recovery check-ins are available.</p>
              ) : (
                <div className="mt-4 space-y-3">
                  {safeRecoveryLogs.map((log) => (
                    <div key={log.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="font-bold text-slate-900">{formatDate(log.log_date)}</p>
                      <p className="mt-2 text-sm text-slate-600">
                        Sleep {formatSleep(log.sleep_duration_min)} / Score {log.sleep_score ?? "--"} / Soreness {log.soreness ?? "--"}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        HRV {formatHrv(log.hrv_ms)} / {log.hrv_status || "No status"} / Resting HR {log.resting_hr ?? "--"}
                        {log.body_battery != null ? ` / Body battery ${log.body_battery}` : ""}
                        {log.illness ? " / Illness noted" : ""}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
}
