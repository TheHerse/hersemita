import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import ParentHeader from "@/components/ParentHeader";
import { getParentPortalContext } from "@/lib/parent-context";
import { displayTrainingNote } from "@/lib/display-text";
import { supabaseAdmin } from "@/lib/supabase-admin";

type Activity = {
  id: string;
  runner_id: string;
  distance_miles: number | null;
  pace_per_mile: number | null;
  duration_seconds: number | null;
  start_time: string;
  verified: boolean | null;
  training_load: number | null;
};

type Team = {
  id: string;
  name: string;
  school_name: string | null;
  default_distance_unit: string;
};

type Alert = {
  id: string;
  runner_id: string | null;
  message: string | null;
  severity: string | null;
  created_at: string;
};

function runnerName(runner: { first_name: string; last_name: string }) {
  return `${runner.first_name} ${runner.last_name}`.trim();
}

function runnerPortalPath(runner: { id: string; username?: string | null }) {
  return `/parent/runners/${encodeURIComponent(runner.username || runner.id)}`;
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

function effortLabel(load: number | null) {
  if (load == null) return "Not logged";
  if (load >= 300) return "Very hard";
  if (load >= 180) return "Hard";
  if (load >= 90) return "Steady";
  return "Easy";
}

function effortClass(load: number | null) {
  if (load == null) return "text-slate-500";
  if (load >= 300) return "text-red-600";
  if (load >= 180) return "text-orange-600";
  if (load >= 90) return "text-[#007ab8]";
  return "text-[#0f8f45]";
}

function sumDistance(activities: Activity[]) {
  return activities.reduce((total, activity) => total + Number(activity.distance_miles || 0), 0);
}

function activitiesForRunner(activities: Activity[], runnerId: string) {
  return activities.filter((activity) => activity.runner_id === runnerId);
}

function latestActivity(activities: Activity[]) {
  return [...activities].sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())[0] || null;
}

export default async function ParentDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ consent?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/parent/sign-in");

  const query = await searchParams;

  const context = await getParentPortalContext(userId);
  const runners = context?.runners || [];
  const pendingRunners = context?.pendingRunners || [];
  const runnerIds = runners.map((runner) => runner.id);

  const [{ data: activities }, { data: alerts }, { data: teams }] =
    runnerIds.length > 0
      ? await Promise.all([
          supabaseAdmin
            .from("activities")
            .select("id, runner_id, distance_miles, pace_per_mile, duration_seconds, start_time, verified, training_load")
            .in("runner_id", runnerIds)
            .eq("verified", true)
            .order("start_time", { ascending: false })
            .limit(100),
          supabaseAdmin
            .from("coach_alerts")
            .select("id, runner_id, message, severity, created_at")
            .in("runner_id", runnerIds)
            .eq("dismissed", false)
            .order("created_at", { ascending: false })
            .limit(6),
          supabaseAdmin
            .from("teams")
            .select("id, name, school_name, default_distance_unit")
            .in("id", Array.from(new Set(runners.map((runner) => runner.team_id)))),
        ])
      : [{ data: [] }, { data: [] }, { data: [] }];

  const safeActivities = (activities || []) as Activity[];
  const safeAlerts = (alerts || []) as Alert[];
  const safeTeams = (teams || []) as Team[];
  const teamsById = new Map(safeTeams.map((team) => [team.id, team]));
  const runnersById = new Map(runners.map((runner) => [runner.id, runner]));
  const defaultTeam = runners[0] ? teamsById.get(runners[0].team_id) : null;
  const distanceUnit = defaultTeam?.default_distance_unit === "kilometers" ? "kilometers" : "miles";
  const now = new Date();
  const lastSevenDays = safeActivities.filter((activity) => {
    const activityDate = new Date(activity.start_time);
    return now.getTime() - activityDate.getTime() <= 7 * 24 * 60 * 60 * 1000;
  });
  const lastThirtyDays = safeActivities.filter((activity) => {
    const activityDate = new Date(activity.start_time);
    return now.getTime() - activityDate.getTime() <= 30 * 24 * 60 * 60 * 1000;
  });

  return (
    <div className="min-h-screen hersemita-page-bg">
      <ParentHeader />

      <main className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
        {query?.consent === "withdrawn" && (
          <div role="status" className="mb-6 rounded-xl border border-emerald-300/50 bg-emerald-50 px-5 py-4 text-sm font-semibold text-emerald-950 shadow-sm">
            Authorization was withdrawn successfully. The runner portal and its existing credentials have been disabled immediately.
          </div>
        )}

        <section className="mb-6 rounded-2xl border border-white/10 bg-white/10 p-5 text-white shadow-2xl shadow-black/10 backdrop-blur sm:p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#00a7ff]">Parent Portal</p>
          <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
            {runners.length > 0 ? "Runner Progress" : pendingRunners.length > 0 ? "Parent authorization required" : "No runners linked yet"}
          </h1>
          <p className="mt-2 max-w-3xl text-[#cbd5e1]">
            {runners.length > 0
              ? `Viewing verified training updates for ${runners.map(runnerName).join(", ")}.`
              : pendingRunners.length > 0
                ? "Review and approve each pending runner before the runner portal can be used."
              : "Ask your coach to add your email to your parent or guardian contact record."}
          </p>
        </section>

        {pendingRunners.length > 0 && (
          <section className="mb-6 rounded-2xl border border-amber-300/40 bg-amber-100 p-6 text-slate-900 shadow-lg">
            <h2 className="text-xl font-bold">Runner portal activation</h2>
            <p className="mt-2 text-sm text-slate-700">These runner accounts remain locked until you review and complete the required authorization.</p>
            <div className="mt-4 grid gap-3">
              {pendingRunners.map((runner) => (
                <Link key={runner.id} href={`/parent/consent/${runner.id}`} className="flex items-center justify-between rounded-lg bg-white px-4 py-3 font-bold text-slate-900 shadow-sm transition hover:bg-amber-50">
                  <span>{runnerName(runner)} · Grade {runner.grade ?? "--"}</span>
                  <span className="text-[#007ab8]">Review consent →</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {runners.length === 0 && pendingRunners.length === 0 ? (
          <section className="section-card p-6 text-center">
            <h2 className="text-xl font-bold text-slate-900">Waiting for coach approval</h2>
            <p className="mx-auto mt-2 max-w-2xl text-sm text-slate-600">
              Parent portal access is only shown after your account email matches a guardian contact connected to a runner.
            </p>
            <Link href="/parent/sign-in" className="mt-5 inline-flex rounded-lg bg-slate-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800">
              Refresh Sign In
            </Link>
          </section>
        ) : (
          <>
            <section className="grid gap-4 sm:grid-cols-4">
              <div className="section-card p-5">
                <p className="text-sm font-semibold text-slate-500">Last 7 Days</p>
                <p className="mt-2 text-3xl font-bold text-[#00a7ff]">{formatDistance(sumDistance(lastSevenDays), distanceUnit)}</p>
              </div>
              <div className="section-card p-5">
                <p className="text-sm font-semibold text-slate-500">Last 30 Days</p>
                <p className="mt-2 text-3xl font-bold text-[#00ff67]">{formatDistance(sumDistance(lastThirtyDays), distanceUnit)}</p>
              </div>
              <div className="section-card p-5">
                <p className="text-sm font-semibold text-slate-500">Verified Runs</p>
                <p className="mt-2 text-3xl font-bold text-slate-900">{safeActivities.length}</p>
              </div>
              <div className="section-card p-5">
                <p className="text-sm font-semibold text-slate-500">Linked Runners</p>
                <p className="mt-2 text-3xl font-bold text-slate-900">{runners.length}</p>
              </div>
            </section>

            <section className="mt-6 grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
              <div className="section-card p-5">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-xl font-bold text-slate-900">Recent Training</h2>
                  <span className="text-sm font-semibold text-slate-500">{defaultTeam?.school_name || defaultTeam?.name || "Team"}</span>
                </div>

                {safeActivities.length === 0 ? (
                  <div className="mt-4 rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
                    Linked runners will appear here after a coach verifies their first uploaded activity.
                  </div>
                ) : (
                  <div className="mt-4 space-y-3">
                    {safeActivities.slice(0, 12).map((activity) => {
                      const runner = runnersById.get(activity.runner_id);

                      return (
                        <div key={activity.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="font-bold text-slate-900">{runner ? runnerName(runner) : "Runner"}</p>
                              <p className="mt-1 text-sm text-slate-500">{formatDate(activity.start_time)}</p>
                            </div>
                            <div className="grid grid-cols-3 gap-3 text-right text-sm sm:min-w-[320px]">
                              <div>
                                <p className="font-bold text-[#00a7ff]">{formatDistance(Number(activity.distance_miles || 0), distanceUnit)}</p>
                                <p className="text-xs text-slate-500">Distance</p>
                              </div>
                              <div>
                                <p className="font-bold text-slate-900">{formatPace(activity.pace_per_mile, distanceUnit)}</p>
                                <p className="text-xs text-slate-500">Pace</p>
                              </div>
                              <div>
                                <p className={`font-bold ${effortClass(activity.training_load)}`}>{effortLabel(activity.training_load)}</p>
                                <p className="text-xs text-slate-500">Effort</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <aside className="space-y-6">
                <div className="section-card p-5">
                  <h2 className="text-xl font-bold text-slate-900">Linked Runners</h2>
                  <div className="mt-4 grid gap-3">
                    {runners.map((runner) => {
                      const team = teamsById.get(runner.team_id);
                      const runnerActivities = activitiesForRunner(safeActivities, runner.id);
                      const recentActivity = latestActivity(runnerActivities);

                      return (
                        <Link key={runner.id} href={runnerPortalPath(runner)} className="block rounded-xl border border-slate-200 bg-white p-4 transition hover:border-[#00a7ff]/40 hover:shadow-sm">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-bold text-slate-900">{runnerName(runner)}</p>
                              <p className="mt-1 text-sm text-slate-500">
                                Grade {runner.grade ?? "--"} / {team?.school_name || team?.name || "Team"}
                              </p>
                            </div>
                            <span className="rounded-full bg-[#00a7ff]/10 px-3 py-1 text-xs font-bold text-[#007ab8]">
                              {runnerActivities.length > 0 ? "Open" : "Waiting"}
                            </span>
                          </div>
                          <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
                            <div>
                              <p className="font-bold text-[#00a7ff]">{formatDistance(sumDistance(runnerActivities), distanceUnit)}</p>
                              <p className="text-xs text-slate-500">Total</p>
                            </div>
                            <div>
                              <p className="font-bold text-slate-900">{runnerActivities.length}</p>
                              <p className="text-xs text-slate-500">Runs</p>
                            </div>
                            <div>
                              <p className="font-bold text-slate-900">{recentActivity ? formatDate(recentActivity.start_time) : "--"}</p>
                              <p className="text-xs text-slate-500">Latest</p>
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>

                <div className="section-card p-5">
                  <h2 className="text-xl font-bold text-slate-900">Coach Notes</h2>
                  {safeAlerts.length === 0 ? (
                    <p className="mt-3 text-sm text-slate-500">No active coach alerts right now.</p>
                  ) : (
                    <div className="mt-4 space-y-3">
                      {safeAlerts.map((alert) => {
                        const runner = alert.runner_id ? runnersById.get(alert.runner_id) : null;

                        return (
                          <div key={alert.id} className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                            <p className="text-xs font-bold uppercase tracking-wide text-amber-700">{alert.severity || "Note"}</p>
                            <p className="mt-2 text-sm font-semibold text-slate-900">{displayTrainingNote(alert.message, "Coach alert")}</p>
                            <p className="mt-2 text-xs text-slate-500">
                              {runner ? runnerName(runner) : "Team"} / {formatDate(alert.created_at)}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </aside>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
