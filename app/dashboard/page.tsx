import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import Link from "next/link";
import type { CSSProperties } from "react";
import RunnerTrendChart from "@/components/RunnerTrendChart";
import TeamOverviewChart from "@/components/TeamOverviewChart";
import RunnerPerformanceTable from "@/components/RunnerPerformanceTable";
import ActivityAppBadge from "@/components/ActivityAppBadge";
import CoachHeader from "@/components/CoachHeader";
import TrainingLoadRecoveryPanel from "@/components/TrainingLoadRecoveryPanel";
import type { LoadRecoveryRow } from "@/components/TrainingLoadRecoveryPanel";

type PaceTrend = 'improving' | 'declining' | 'stable';

type WeeklyLoadRecord = {
  runner_id: string;
  week_start: string;
  acute_load: number | string | null;
  chronic_load: number | string | null;
  acwr_ratio: number | string | null;
  monotony: number | string | null;
  strain: number | string | null;
  status: string | null;
};

type RecoveryLogRecord = {
  runner_id: string;
  log_date: string;
  hrv_ms: number | string | null;
  hrv_status: string | null;
  resting_hr: number | null;
  sleep_score: number | null;
  soreness: number | null;
  illness: boolean | null;
};

type CoachAlertRecord = {
  runner_id: string;
  alert_type: string;
  severity: string;
  dismissed: boolean | null;
  created_at: string | null;
};

const ALERT_SEVERITY_RANK: Record<string, number> = {
  critical: 3,
  high: 2,
  medium: 1,
};

function latestByDate<T extends Record<string, unknown>>(rows: T[] | null | undefined, dateKey: keyof T) {
  const map = new Map<string, T>();
  rows?.forEach((row) => {
    const runnerId = String(row.runner_id || "");
    const current = map.get(runnerId);
    const rowTime = new Date(String(row[dateKey] || "")).getTime();
    const currentTime = current ? new Date(String(current[dateKey] || "")).getTime() : 0;
    if (!current || rowTime > currentTime) map.set(runnerId, row);
  });
  return map;
}

async function verifyActivity(activityId: string) {
  "use server";

  const { userId } = await auth();
  if (!userId) redirect("/");
  const supabase = await createServerSupabaseClient();
  
  const { data: activity } = await supabase
    .from("activities")
    .select("id, runners!inner(coach_id, coaches!inner(email))")
    .eq("id", activityId)
    .eq("runners.coaches.email", userId)
    .single();
  
  if (!activity?.id) redirect("/dashboard");
  
  const { error: updateError } = await supabase
    .from("activities")
    .update({ verified: true })
    .eq("id", activityId);
  
  if (updateError) throw updateError;
  
  redirect("/dashboard");
}

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect("/");
  const supabase = await createServerSupabaseClient();

  const { data: coach } = await supabase
    .from("coaches")
    .select("id, name")
    .eq("email", userId)
    .single();

  const { data: coachProfile } = coach?.id
    ? await supabase
        .from("coaches")
        .select("school_name")
        .eq("id", coach.id)
        .single()
    : { data: null };

  const { data: runners } = await supabase
    .from("runners")
    .select("*")
    .eq("coach_id", coach?.id);

  // Make sure to select the new columns from Supabase
  const { data: activities } = await supabase
    .from("activities")
    .select(`
      *,
      runners!inner (
        id,
        first_name,
        last_name,
        parent_phone
      )
    `)
    .eq("runners.coach_id", coach?.id)
    .order("start_time", { ascending: false });

  const [{ data: weeklyLoads }, { data: recoveryLogs }, { data: coachAlerts }] = coach?.id
    ? await Promise.all([
        supabase
          .from("weekly_loads")
          .select("runner_id, week_start, acute_load, chronic_load, acwr_ratio, monotony, strain, status, runners!inner(coach_id)")
          .eq("runners.coach_id", coach.id)
          .order("week_start", { ascending: false }),
        supabase
          .from("recovery_logs")
          .select("runner_id, log_date, hrv_ms, hrv_status, resting_hr, sleep_score, soreness, illness, runners!inner(coach_id)")
          .eq("runners.coach_id", coach.id)
          .order("log_date", { ascending: false }),
        supabase
          .from("coach_alerts")
          .select("runner_id, alert_type, severity, dismissed, created_at")
          .eq("coach_id", coach.id)
          .eq("dismissed", false)
          .order("created_at", { ascending: false }),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];

  const weeklyLoadRows = (weeklyLoads || []) as WeeklyLoadRecord[];
  const recoveryLogRows = (recoveryLogs || []) as RecoveryLogRecord[];
  const coachAlertRows = (coachAlerts || []) as CoachAlertRecord[];

  const latestWeeklyLoadByRunner = latestByDate(weeklyLoadRows, "week_start");
  const latestRecoveryByRunner = latestByDate(recoveryLogRows, "log_date");
  const alertsByRunner = new Map<string, { count: number; highestSeverity: string | null }>();
  coachAlertRows.forEach((alert) => {
    const current = alertsByRunner.get(alert.runner_id) || { count: 0, highestSeverity: null };
    const currentRank = current.highestSeverity ? ALERT_SEVERITY_RANK[current.highestSeverity] || 0 : 0;
    const nextRank = ALERT_SEVERITY_RANK[alert.severity] || 0;
    alertsByRunner.set(alert.runner_id, {
      count: current.count + 1,
      highestSeverity: nextRank > currentRank ? alert.severity : current.highestSeverity,
    });
  });

  const runnerCount = runners?.length || 0;
  const activityCount = activities?.length || 0;
  const pendingCount = activities?.filter(a => !a.verified).length || 0;

  const runnerStats = runners?.map(runner => {
    const runnerActivities = activities?.filter(a => a.runner_id === runner.id) || [];
    const totalDistance = runnerActivities.reduce((sum, a) => sum + (a.distance_miles || 0), 0);
    const avgPace = runnerActivities.length > 0 
      ? runnerActivities.reduce((sum, a) => sum + (a.pace_per_mile || 0), 0) / runnerActivities.length 
      : 0;
    
    return {
      runner_id: runner.id,
      runner_name: `${runner.first_name} ${runner.last_name}`,
      total_distance: totalDistance,
      avg_pace: avgPace,
      activity_count: runnerActivities.length,
      last_activity_date: runnerActivities[0]?.start_time || ''
    };
  }) || [];

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const recentActivities = activities?.filter(a => 
    new Date(a.start_time) >= thirtyDaysAgo
  ).map(a => ({
    id: a.id,
    runner_id: a.runner_id,
    pace_per_mile: a.pace_per_mile,
    distance_miles: a.distance_miles,
    start_time: a.start_time,
    verified: a.verified
  })) || [];

  const runnerPerformances = runners?.map(runner => {
    const runnerActivities = activities?.filter(a => a.runner_id === runner.id) || [];
    const latestLoad = latestWeeklyLoadByRunner.get(runner.id);
    const latestRecovery = latestRecoveryByRunner.get(runner.id);
    const alerts = alertsByRunner.get(runner.id);
    
    if (runnerActivities.length === 0) {
      return {
        runner_id: runner.id,
        runner_name: `${runner.first_name} ${runner.last_name}`,
        total_activities: 0,
        total_distance: 0,
        avg_pace: 0,
        best_pace: 0,
        worst_pace: 0,
        pace_trend: 'stable' as PaceTrend,
        last_7_days_distance: 0,
        previous_7_days_distance: 0,
        distance_change_percent: 0,
        last_activity_date: '',
        acwr_ratio: latestLoad?.acwr_ratio == null ? null : Number(latestLoad.acwr_ratio),
        load_status: latestLoad?.status || null,
        hrv_status: latestRecovery?.hrv_status || null,
        recovery_date: latestRecovery?.log_date || null,
        alert_count: alerts?.count || 0,
        highest_alert_severity: alerts?.highestSeverity || null
      };
    }

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const last7Days = runnerActivities.filter(a => new Date(a.start_time) >= sevenDaysAgo);
    const previous7Days = runnerActivities.filter(a => {
      const date = new Date(a.start_time);
      return date >= fourteenDaysAgo && date < sevenDaysAgo;
    });

    const last7Distance = last7Days.reduce((sum, a) => sum + (a.distance_miles || 0), 0);
    const prev7Distance = previous7Days.reduce((sum, a) => sum + (a.distance_miles || 0), 0);
    
    const paces = runnerActivities.map(a => a.pace_per_mile).filter(p => p > 0);
    const avgPace = paces.reduce((sum, p) => sum + p, 0) / paces.length;
    const bestPace = Math.min(...paces);
    const worstPace = Math.max(...paces);

    const sortedActivities = [...runnerActivities].sort((a, b) => 
      new Date(b.start_time).getTime() - new Date(a.start_time).getTime()
    );
    
    const recent3 = sortedActivities.slice(0, 3);
    const previous3 = sortedActivities.slice(3, 6);
    
    const recentAvgPace = recent3.length > 0 
      ? recent3.reduce((sum, a) => sum + a.pace_per_mile, 0) / recent3.length 
      : avgPace;
    const previousAvgPace = previous3.length > 0 
      ? previous3.reduce((sum, a) => sum + a.pace_per_mile, 0) / previous3.length 
      : avgPace;

    let paceTrend: PaceTrend = 'stable';
    if (recentAvgPace < previousAvgPace * 0.95) paceTrend = 'improving';
    else if (recentAvgPace > previousAvgPace * 1.05) paceTrend = 'declining';

    const distanceChange = prev7Distance > 0 
      ? ((last7Distance - prev7Distance) / prev7Distance) * 100 
      : 0;

    return {
      runner_id: runner.id,
      runner_name: `${runner.first_name} ${runner.last_name}`,
      total_activities: runnerActivities.length,
      total_distance: runnerActivities.reduce((sum, a) => sum + (a.distance_miles || 0), 0),
      avg_pace: avgPace,
      best_pace: bestPace,
      worst_pace: worstPace,
      pace_trend: paceTrend,
      last_7_days_distance: last7Distance,
      previous_7_days_distance: prev7Distance,
      distance_change_percent: distanceChange,
      last_activity_date: sortedActivities[0]?.start_time || '',
      acwr_ratio: latestLoad?.acwr_ratio == null ? null : Number(latestLoad.acwr_ratio),
      load_status: latestLoad?.status || null,
      hrv_status: latestRecovery?.hrv_status || null,
      recovery_date: latestRecovery?.log_date || null,
      alert_count: alerts?.count || 0,
      highest_alert_severity: alerts?.highestSeverity || null
    };
  }) || [];

  const loadRecoveryRows: LoadRecoveryRow[] = runners?.map((runner) => {
    const latestLoad = latestWeeklyLoadByRunner.get(runner.id);
    const latestRecovery = latestRecoveryByRunner.get(runner.id);
    const alerts = alertsByRunner.get(runner.id);

    return {
      runnerId: runner.id,
      runnerName: `${runner.first_name} ${runner.last_name}`,
      acuteLoad: latestLoad?.acute_load == null ? null : Number(latestLoad.acute_load),
      chronicLoad: latestLoad?.chronic_load == null ? null : Number(latestLoad.chronic_load),
      acwrRatio: latestLoad?.acwr_ratio == null ? null : Number(latestLoad.acwr_ratio),
      loadStatus: latestLoad?.status || null,
      monotony: latestLoad?.monotony == null ? null : Number(latestLoad.monotony),
      strain: latestLoad?.strain == null ? null : Number(latestLoad.strain),
      latestRecoveryDate: latestRecovery?.log_date || null,
      hrvStatus: latestRecovery?.hrv_status || null,
      hrvMs: latestRecovery?.hrv_ms == null ? null : Number(latestRecovery.hrv_ms),
      sleepScore: latestRecovery?.sleep_score == null ? null : Number(latestRecovery.sleep_score),
      soreness: latestRecovery?.soreness == null ? null : Number(latestRecovery.soreness),
      illness: Boolean(latestRecovery?.illness),
      alertCount: alerts?.count || 0,
      highestAlertSeverity: alerts?.highestSeverity || null,
    };
  }) || [];

  return (
    <div className="min-h-screen hersemita-page-bg">
      <CoachHeader active="dashboard" />

      <main className="p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">
                {coachProfile?.school_name || "Coach Dashboard"}
              </h2>
              <p className="text-slate-500 mt-1">
                {coach?.name ? `${coach.name} / ` : ""}Track, verify, and analyze your team&apos;s performance
              </p>
            </div>
            <Link 
              href="/runners/new" 
              className="primary-action flex w-full items-center justify-center gap-2 px-6 py-3 sm:w-auto"
            >
              <span>+</span>
              <span>Add Runner</span>
            </Link>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Link href="/runners" className="metric-card group p-6" style={{ "--metric-color": "#00a7ff" } as CSSProperties}>
              <div className="flex items-center gap-3 mb-3">
                <div className="metric-icon">
                  <svg className="w-5 h-5 text-[#00a7ff]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-slate-700 group-hover:text-[#00a7ff] transition-colors">Runners</h3>
              </div>
              <p className="text-4xl font-bold text-[#00a7ff]">{runnerCount}</p>
              <p className="text-sm text-slate-500 mt-1">Total athletes</p>
            </Link>
            
            <Link href="/activities" className="metric-card p-6" style={{ "--metric-color": "#00ff67" } as CSSProperties}>
              <div className="flex items-center gap-3 mb-3">
                <div className="metric-icon">
                  <svg className="w-5 h-5 text-[#00ff67]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-slate-700">Activities</h3>
              </div>
              <p className="text-4xl font-bold text-[#00ff67]">{activityCount}</p>
              <p className="text-sm text-slate-500 mt-1">All time</p>
            </Link>
            
            <Link href="/activities" className="metric-card p-6" style={{ "--metric-color": "#f59e0b" } as CSSProperties}>
              <div className="flex items-center gap-3 mb-3">
                <div className="metric-icon">
                  <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-slate-700">Pending</h3>
              </div>
              <p className="text-4xl font-bold text-orange-500">{pendingCount}</p>
              <p className="text-sm text-slate-500 mt-1">Unverified runs</p>
            </Link>
          </div>

          <div className="mb-8">
            <RunnerPerformanceTable performances={runnerPerformances} />
          </div>

          <div className="mb-8">
            <TrainingLoadRecoveryPanel rows={loadRecoveryRows} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <TeamOverviewChart runnerStats={runnerStats} />
            <RunnerTrendChart activities={recentActivities} />
          </div>

          <div className="section-card p-4 sm:p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="section-icon" style={{ "--icon-color": "#00ff67" } as CSSProperties}>
                <svg className="w-4 h-4 text-[#00ff67]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-slate-900">Quick Verify</h3>
                <p className="text-sm text-slate-500">Review the newest unverified activity uploads.</p>
              </div>
            </div>
            {activities?.filter(a => !a.verified).length === 0 ? (
              <div className="flex items-center gap-3 rounded-xl border border-[#00ff67]/20 bg-[#00ff67]/10 p-4 text-[#00ff67]">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="font-semibold">All activities verified!</span>
              </div>
            ) : (
              <div className="space-y-3">
                {activities?.filter(a => !a.verified).slice(0, 5).map((activity) => {
                  const paceMinutes = Math.floor(activity.pace_per_mile / 60);
                  const paceSeconds = Math.round(activity.pace_per_mile % 60).toString().padStart(2, '0');
                  const pace = `${paceMinutes}:${paceSeconds}`;
                  const runner = activity.runners;
                  
                  return (
                    <div key={activity.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex-1">
                        <div className="font-medium text-slate-900">{runner.first_name} {runner.last_name}</div>
                        <div className="text-sm text-slate-600">
                          {activity.distance_miles?.toFixed(2)} miles / {pace}/mi pace
                        </div>
                        {/* Show app info in quick verify */}
                        <div className="flex items-center gap-2 mt-1">
                          <ActivityAppBadge app={activity.detected_app} />
                          {activity.screenshot_urls && activity.screenshot_urls.length > 0 && (
                            <span className="flex items-center gap-1 text-xs text-[#00a7ff]">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              {activity.screenshot_urls.length} screenshot{activity.screenshot_urls.length > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </div>
                      <form action={verifyActivity.bind(null, activity.id)}>
                        <button 
                          type="submit" 
                          className="w-full rounded-lg bg-[#00d95a] px-4 py-2 text-sm font-bold text-white shadow-sm shadow-[#00ff67]/20 transition-colors hover:bg-[#00c851] sm:w-auto"
                        >
                          Verify
                        </button>
                      </form>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
