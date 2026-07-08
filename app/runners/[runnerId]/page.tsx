import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { CSSProperties } from "react";
import ActivityAppBadge from "@/components/ActivityAppBadge";
import CoachHeader from "@/components/CoachHeader";
import { formatPace } from "@/lib/activity-format";
import { distanceUnitLabel, milesToDistance, normalizeDistanceUnit, paceFromMiles } from "@/lib/distance-units";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getCurrentTeamContext } from "@/lib/team-context";

type RunnerRecord = {
  id: string;
  first_name: string;
  last_name: string;
  grade: number | null;
  parent_phone: string | null;
  username: string | null;
  access_code: string | null;
};

type ActivityRecord = {
  id: string;
  distance_miles: number | string | null;
  duration_seconds: number | null;
  pace_per_mile: number | null;
  start_time: string;
  verified: boolean | null;
  detected_app: string | null;
  workout_type: string | null;
  training_load: number | string | null;
  rpe: number | null;
  soreness: number | null;
  illness: boolean | null;
  notes: string | null;
};

type WeeklyLoadRecord = {
  id: string;
  week_start: string;
  acute_load: number | string | null;
  chronic_load: number | string | null;
  acwr_ratio: number | string | null;
  monotony: number | string | null;
  strain: number | string | null;
  status: string | null;
};

type RecoveryLogRecord = {
  id: string;
  log_date: string;
  hrv_ms: number | string | null;
  hrv_status: string | null;
  resting_hr: number | null;
  sleep_score: number | null;
  sleep_duration_min: number | null;
  body_battery: number | null;
  soreness: number | null;
  illness: boolean | null;
  notes: string | null;
};

type InjuryRecord = {
  id: string;
  injury_type: string | null;
  body_part: string | null;
  severity: number | null;
  onset_date: string | null;
  status: string | null;
  notes: string | null;
};

type AlertRecord = {
  id: string;
  alert_type: string;
  message: string | null;
  severity: string;
  dismissed: boolean | null;
  created_at: string | null;
};

async function getTeamAccess(userId: string) {
  const context = await getCurrentTeamContext(userId);
  return {
    coachId: context?.team.owner_coach_id || context?.coach.id,
    teamId: context?.team.id,
    distanceUnit: context?.team.default_distance_unit || context?.coach.id,
  };
}

async function addInjury(runnerId: string, formData: FormData) {
  "use server";

  const { userId } = await auth();
  if (!userId) redirect("/");
  const supabase = await createServerSupabaseClient();
  const { teamId } = await getTeamAccess(userId);
  if (!teamId) redirect("/runners");

  const { data: runner } = await supabase
    .from("runners")
    .select("id")
    .eq("id", runnerId)
    .eq("team_id", teamId)
    .single();

  if (!runner?.id) redirect("/runners");

  const severity = Number(formData.get("severity") || 1);
  const injuryType = String(formData.get("injuryType") || "").trim();
  const bodyPart = String(formData.get("bodyPart") || "").trim();
  const onsetDate = String(formData.get("onsetDate") || "").trim();
  const status = String(formData.get("status") || "active");
  const notes = String(formData.get("notes") || "").trim();

  if (!injuryType && !bodyPart) redirect(`/runners/${runner.id}`);

  const { error } = await supabase.from("injuries").insert({
    runner_id: runner.id,
    injury_type: injuryType || null,
    body_part: bodyPart || null,
    severity: Number.isFinite(severity) ? Math.min(10, Math.max(1, Math.round(severity))) : 1,
    onset_date: onsetDate || null,
    status,
    notes: notes || null,
  });

  if (error) throw new Error(error.message);

  redirect(`/runners/${runner.id}`);
}

async function dismissAlert(alertId: string, runnerId: string) {
  "use server";

  const { userId } = await auth();
  if (!userId) redirect("/");
  const supabase = await createServerSupabaseClient();
  const { teamId } = await getTeamAccess(userId);
  if (!teamId) redirect("/runners");

  const { error } = await supabase
    .from("coach_alerts")
    .update({ dismissed: true })
    .eq("id", alertId)
    .eq("team_id", teamId)
    .eq("runner_id", runnerId);

  if (error) throw new Error(error.message);

  redirect(`/runners/${runnerId}`);
}

function toNumber(value: number | string | null | undefined) {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function shortDate(value: string | null | undefined) {
  if (!value) return "--";
  return new Date(value.includes("T") ? value : `${value}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function loadLabel(status: string | null) {
  if (status === "high_load") return "High load";
  if (status === "elevated_load") return "Elevated";
  if (status === "detraining") return "Detraining";
  if (status === "optimal") return "Optimal";
  return "No load";
}

function statusColor(status: string | null) {
  if (status === "high_load" || status === "critical" || status === "poor" || status === "low") return "#ef4444";
  if (status === "elevated_load" || status === "high" || status === "unbalanced") return "#f59e0b";
  if (status === "detraining" || status === "medium") return "#7dd3fc";
  return "#00ff67";
}

function formatSleep(minutes: number | null) {
  if (minutes == null) return "--";
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;
}

export default async function RunnerDetailPage({
  params,
}: {
  params: Promise<{ runnerId: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/");

  const { runnerId } = await params;
  const supabase = await createServerSupabaseClient();
  const teamContext = await getCurrentTeamContext(userId);
  const teamId = teamContext?.team.id;
  if (!teamId) redirect("/runners");

  const { data: coach } = await supabase
    .from("coaches")
    .select("preferred_distance_unit")
    .eq("id", teamContext.coach.id)
    .single();
  const preferredDistanceUnit = normalizeDistanceUnit(teamContext.team.default_distance_unit || coach?.preferred_distance_unit);
  const unitLabel = distanceUnitLabel(preferredDistanceUnit);

  const [
    { data: runner },
    { data: activities },
    { data: weeklyLoads },
    { data: recoveryLogs },
    { data: injuries },
    { data: alerts },
  ] = await Promise.all([
    supabase
      .from("runners")
      .select("id, first_name, last_name, grade, parent_phone, username, access_code")
      .eq("id", runnerId)
      .eq("team_id", teamId)
      .single(),
    supabase
      .from("activities")
      .select("id, distance_miles, duration_seconds, pace_per_mile, start_time, verified, detected_app, workout_type, training_load, rpe, soreness, illness, notes")
      .eq("runner_id", runnerId)
      .order("start_time", { ascending: false })
      .limit(20),
    supabase
      .from("weekly_loads")
      .select("id, week_start, acute_load, chronic_load, acwr_ratio, monotony, strain, status")
      .eq("runner_id", runnerId)
      .order("week_start", { ascending: false })
      .limit(12),
    supabase
      .from("recovery_logs")
      .select("id, log_date, hrv_ms, hrv_status, resting_hr, sleep_score, sleep_duration_min, body_battery, soreness, illness, notes")
      .eq("runner_id", runnerId)
      .order("log_date", { ascending: false })
      .limit(14),
    supabase
      .from("injuries")
      .select("id, injury_type, body_part, severity, onset_date, status, notes")
      .eq("runner_id", runnerId)
      .order("onset_date", { ascending: false }),
    supabase
      .from("coach_alerts")
      .select("id, alert_type, message, severity, dismissed, created_at")
      .eq("runner_id", runnerId)
      .eq("team_id", teamId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  if (!runner) redirect("/runners");

  const safeRunner = runner as RunnerRecord;
  const safeActivities = (activities || []) as ActivityRecord[];
  const safeWeeklyLoads = (weeklyLoads || []) as WeeklyLoadRecord[];
  const safeRecoveryLogs = (recoveryLogs || []) as RecoveryLogRecord[];
  const safeInjuries = (injuries || []) as InjuryRecord[];
  const safeAlerts = (alerts || []) as AlertRecord[];

  const latestLoad = safeWeeklyLoads[0];
  const latestRecovery = safeRecoveryLogs[0];
  const latestActivityTime = safeActivities.reduce((latest, activity) => {
    return Math.max(latest, new Date(activity.start_time).getTime());
  }, 0);
  const totalMiles30 = safeActivities
    .filter((activity) => latestActivityTime === 0 || latestActivityTime - new Date(activity.start_time).getTime() <= 30 * 86400000)
    .reduce((sum, activity) => sum + (toNumber(activity.distance_miles) || 0), 0);
  const totalDistance30 = milesToDistance(totalMiles30, preferredDistanceUnit);
  const openAlerts = safeAlerts.filter((alert) => !alert.dismissed);
  const maxLoad = Math.max(...safeWeeklyLoads.map((row) => toNumber(row.acute_load) || 0), 1);
  const chartRows = [...safeWeeklyLoads].reverse();
  const calendarRows = safeActivities.slice(0, 14).reverse();

  return (
    <div className="min-h-screen hersemita-page-bg text-white">
      <CoachHeader active="runners" />

      <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
        <section className="mb-6 rounded-2xl border border-white/10 bg-white/10 p-5 shadow-2xl shadow-black/10 backdrop-blur sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <Link href="/runners" className="mb-4 inline-flex rounded-lg border border-white/15 bg-white/10 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/15">
                Back to roster
              </Link>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#00a7ff]">Runner Detail</p>
              <h2 className="mt-2 text-3xl font-bold text-white sm:text-4xl">
                {safeRunner.first_name} {safeRunner.last_name}
              </h2>
              <p className="mt-2 text-[#cbd5e1]">
                Grade {safeRunner.grade ?? "--"} | {safeRunner.parent_phone ? `Parent ${safeRunner.parent_phone}` : "No parent phone"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href={`/runners/upload/${safeRunner.id}`} className="rounded-lg bg-[#008cff] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#00a7ff]">
                Upload Run
              </Link>
              <Link href={`/runners/${safeRunner.id}/edit`} className="rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/15">
                Edit Runner
              </Link>
            </div>
          </div>
        </section>

        <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label={`30-Day ${unitLabel}`} value={totalDistance30.toFixed(1)} color="#00a7ff" />
          <Metric label="ACWR" value={toNumber(latestLoad?.acwr_ratio)?.toFixed(2) || "--"} color={statusColor(latestLoad?.status || null)} />
          <Metric label="Recovery" value={latestRecovery?.hrv_status || "Missing"} color={statusColor(latestRecovery?.hrv_status || null)} />
          <Metric label="Open Alerts" value={String(openAlerts.length)} color={openAlerts.length ? "#ef4444" : "#00ff67"} />
        </section>

        <section className="mb-6 section-card p-4 sm:p-6">
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="text-xl font-bold text-slate-900">Calendar Strip</h3>
              <p className="mt-1 text-sm text-slate-500">Newest runs across the recent training window.</p>
            </div>
            <p className="text-sm font-bold text-[#00a7ff]">{safeActivities.length} recent activities</p>
          </div>
          {calendarRows.length === 0 ? (
            <EmptyState text="No activities yet." />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
              {calendarRows.map((activity) => {
                const distanceDisplay = milesToDistance(toNumber(activity.distance_miles) || 0, preferredDistanceUnit);
                const paceDisplay = paceFromMiles(activity.pace_per_mile || 0, preferredDistanceUnit);

                return (
                <div key={activity.id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{shortDate(activity.start_time)}</p>
                  <p className="mt-2 text-lg font-bold text-slate-900">{distanceDisplay.toFixed(1)} {unitLabel}</p>
                  <p className="mt-1 text-xs text-slate-500">{formatPace(paceDisplay)}/{unitLabel}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {activity.workout_type && <StatusPill label={activity.workout_type} color="#00a7ff" />}
                    {!activity.verified && <StatusPill label="pending" color="#f59e0b" />}
                  </div>
                </div>
              )})}
            </div>
          )}
        </section>

        <section className="mb-6 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="section-card p-4 sm:p-6">
            <div className="mb-5">
              <h3 className="text-xl font-bold text-slate-900">Load Chart</h3>
              <p className="mt-1 text-sm text-slate-500">Weekly acute load with chronic load and ACWR status.</p>
            </div>
            {chartRows.length === 0 ? (
              <EmptyState text="No load rows yet. New runs with training load will fill this in." />
            ) : (
              <div className="space-y-4">
                <div className="flex h-56 items-end gap-2 border-b border-slate-200 pb-2">
                  {chartRows.map((row) => {
                    const acute = toNumber(row.acute_load) || 0;
                    const height = Math.max(4, (acute / maxLoad) * 100);
                    return (
                      <div key={row.id} className="flex flex-1 flex-col items-center gap-2">
                        <div className="flex w-full items-end justify-center rounded-t-lg bg-slate-100" style={{ height: "100%" }}>
                          <div
                            className="w-full rounded-t-lg"
                            style={{
                              height: `${height}%`,
                              background: `linear-gradient(180deg, ${statusColor(row.status)}, #00a7ff)`,
                            }}
                          />
                        </div>
                        <p className="text-xs font-bold text-slate-500">{shortDate(row.week_start)}</p>
                      </div>
                    );
                  })}
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <CompactMetric label="Acute" value={toNumber(latestLoad?.acute_load)?.toFixed(1) || "--"} />
                  <CompactMetric label="Chronic" value={toNumber(latestLoad?.chronic_load)?.toFixed(1) || "--"} />
                  <CompactMetric label="Status" value={loadLabel(latestLoad?.status || null)} />
                </div>
              </div>
            )}
          </div>

          <div className="section-card p-4 sm:p-6">
            <h3 className="text-xl font-bold text-slate-900">Recent Activities</h3>
            <div className="mt-4 space-y-3">
              {safeActivities.slice(0, 6).map((activity) => {
                const distanceDisplay = milesToDistance(toNumber(activity.distance_miles) || 0, preferredDistanceUnit);
                const paceDisplay = paceFromMiles(activity.pace_per_mile || 0, preferredDistanceUnit);

                return (
                <article key={activity.id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-slate-900">{shortDate(activity.start_time)}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        {distanceDisplay.toFixed(2)} {unitLabel} | {formatPace(paceDisplay)}/{unitLabel}
                      </p>
                    </div>
                    <ActivityAppBadge app={activity.detected_app} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {activity.training_load != null && <StatusPill label={`Load ${toNumber(activity.training_load)?.toFixed(0)}`} color="#00a7ff" />}
                    {activity.rpe != null && <StatusPill label={`RPE ${activity.rpe}`} color="#00ff67" />}
                    {activity.illness && <StatusPill label="Sick" color="#ef4444" />}
                  </div>
                  {activity.notes && <p className="mt-3 text-sm text-slate-600">{activity.notes}</p>}
                </article>
              )})}
              {safeActivities.length === 0 && <EmptyState text="No recent activities." />}
            </div>
          </div>
        </section>

        <section className="mb-6 grid gap-6 lg:grid-cols-2">
          <div className="section-card p-4 sm:p-6">
            <h3 className="text-xl font-bold text-slate-900">Recovery History</h3>
            <div className="mt-4 overflow-x-auto">
              {safeRecoveryLogs.length === 0 ? (
                <EmptyState text="No recovery check-ins yet." />
              ) : (
                <table className="w-full min-w-[620px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/60">
                      <th className="px-3 py-2 text-left font-bold text-slate-700">Date</th>
                      <th className="px-3 py-2 text-left font-bold text-slate-700">HRV</th>
                      <th className="px-3 py-2 text-left font-bold text-slate-700">Sleep</th>
                      <th className="px-3 py-2 text-left font-bold text-slate-700">Sore</th>
                      <th className="px-3 py-2 text-left font-bold text-slate-700">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {safeRecoveryLogs.map((log) => (
                      <tr key={log.id} className="border-b border-slate-100 last:border-0">
                        <td className="px-3 py-3 font-bold text-slate-900">{shortDate(log.log_date)}</td>
                        <td className="px-3 py-3 text-slate-700">
                          {toNumber(log.hrv_ms)?.toFixed(0) || "--"} ms
                          <div className="mt-1"><StatusPill label={log.hrv_status || "none"} color={statusColor(log.hrv_status)} /></div>
                        </td>
                        <td className="px-3 py-3 text-slate-700">
                          {log.sleep_score ?? "--"} score
                          <div className="text-xs text-slate-500">{formatSleep(log.sleep_duration_min)}</div>
                        </td>
                        <td className="px-3 py-3 text-slate-700">{log.soreness ?? "--"}</td>
                        <td className="px-3 py-3 text-slate-600">{log.notes || (log.illness ? "Sick today" : "--")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="section-card p-4 sm:p-6">
            <h3 className="text-xl font-bold text-slate-900">Injury Log</h3>
            <form action={addInjury.bind(null, safeRunner.id)} className="mt-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <input name="injuryType" placeholder="Injury type" className="rounded-lg border px-3 py-2" />
                <input name="bodyPart" placeholder="Body part" className="rounded-lg border px-3 py-2" />
                <input name="onsetDate" type="date" className="rounded-lg border px-3 py-2" />
                <select name="status" defaultValue="active" className="rounded-lg border px-3 py-2">
                  <option value="active">Active</option>
                  <option value="recovered">Recovered</option>
                  <option value="chronic">Chronic</option>
                </select>
                <input name="severity" type="number" min="1" max="10" defaultValue="3" className="rounded-lg border px-3 py-2" />
                <button type="submit" className="primary-action px-4 py-2">Add Injury</button>
              </div>
              <textarea name="notes" placeholder="Notes" rows={3} className="mt-3 w-full rounded-lg border px-3 py-2" />
            </form>
            <div className="mt-4 space-y-3">
              {safeInjuries.map((injury) => (
                <article key={injury.id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-slate-900">{injury.injury_type || "Injury"} {injury.body_part ? `- ${injury.body_part}` : ""}</p>
                      <p className="mt-1 text-sm text-slate-500">{shortDate(injury.onset_date)} | Severity {injury.severity ?? "--"}</p>
                    </div>
                    <StatusPill label={injury.status || "active"} color={injury.status === "recovered" ? "#00ff67" : "#f59e0b"} />
                  </div>
                  {injury.notes && <p className="mt-3 text-sm text-slate-600">{injury.notes}</p>}
                </article>
              ))}
              {safeInjuries.length === 0 && <EmptyState text="No injuries logged." />}
            </div>
          </div>
        </section>

        <section className="section-card p-4 sm:p-6">
          <h3 className="text-xl font-bold text-slate-900">Alert History</h3>
          <div className="mt-4 space-y-3">
            {safeAlerts.map((alert) => (
              <article key={alert.id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap gap-2">
                      <StatusPill label={alert.severity} color={statusColor(alert.severity)} />
                      <StatusPill label={alert.alert_type.replaceAll("_", " ")} color="#00a7ff" />
                      {alert.dismissed && <StatusPill label="dismissed" color="#94a3b8" />}
                    </div>
                    <p className="mt-3 font-bold text-slate-900">{alert.message || "Coach alert"}</p>
                    <p className="mt-1 text-sm text-slate-500">{shortDate(alert.created_at)}</p>
                  </div>
                  {!alert.dismissed && (
                    <form action={dismissAlert.bind(null, alert.id, safeRunner.id)}>
                      <button type="submit" className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100">
                        Dismiss
                      </button>
                    </form>
                  )}
                </div>
              </article>
            ))}
            {safeAlerts.length === 0 && <EmptyState text="No alerts yet." />}
          </div>
        </section>
      </main>
    </div>
  );
}

function Metric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="metric-card p-5" style={{ "--metric-color": color } as CSSProperties}>
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold" style={{ color }}>{value}</p>
    </div>
  );
}

function CompactMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

function StatusPill({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="inline-flex rounded-full border px-2.5 py-1 text-xs font-bold capitalize"
      style={{ borderColor: `${color}55`, backgroundColor: `${color}18`, color }}
    >
      {label}
    </span>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">{text}</div>;
}
