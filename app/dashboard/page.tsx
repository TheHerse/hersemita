import { auth } from "@clerk/nextjs/server";
import { UserButton } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import RunnerTrendChart from "@/components/RunnerTrendChart";
import TeamOverviewChart from "@/components/TeamOverviewChart";
import RunnerPerformanceTable from "@/components/RunnerPerformanceTable";
import CoachMobileMenu from "@/components/CoachMobileMenu";
import ActivityAppBadge from "@/components/ActivityAppBadge";

type PaceTrend = 'improving' | 'declining' | 'stable';

async function verifyActivity(activityId: string) {
  "use server";

  const { userId } = await auth();
  if (!userId) redirect("/");
  
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
        last_activity_date: ''
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
      last_activity_date: sortedActivities[0]?.start_time || ''
    };
  }) || [];

  return (
    <div className="min-h-screen hersemita-page-bg">
      <header className="bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-50 sm:px-6 sm:py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl overflow-hidden">
            <img 
              src="/logo.png" 
              alt="Hersemita" 
              className="w-full h-full object-contain"
            />
          </div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-[#00ff67] to-[#00a7ff] bg-clip-text text-transparent">
            Hersemita
          </h1>
        </Link>
        <div className="hidden items-center gap-3 sm:flex">
          <Link href="/runners" className="shrink-0 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-[#00a7ff]/60 hover:text-[#00a7ff]">
            Runners
          </Link>
          <Link href="/groups" className="shrink-0 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-[#00a7ff]/60 hover:text-[#00a7ff]">
            Groups
          </Link>
          <Link href="/runners/message" className="shrink-0 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-[#00a7ff]/60 hover:text-[#00a7ff]">
            Message
          </Link>
          <Link href="/activities" className="shrink-0 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-[#00a7ff]/60 hover:text-[#00a7ff]">
            Activities
          </Link>
          <Link href="/settings" className="shrink-0 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-[#00a7ff]/60 hover:text-[#00a7ff]">
            Settings
          </Link>
          <UserButton afterSignOutUrl="/" />
        </div>
        <CoachMobileMenu
          showUserButton
          links={[
            { href: "/runners", label: "Runners" },
            { href: "/groups", label: "Groups" },
            { href: "/runners/message", label: "Message Parents" },
            { href: "/activities", label: "Activities" },
            { href: "/settings", label: "Settings" },
          ]}
        />
        </div>
      </header>

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
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#00ff67] to-[#00a7ff] px-6 py-3 font-semibold text-white transition-all hover:shadow-lg hover:shadow-[#00a7ff]/20 sm:w-auto"
            >
              <span>+</span>
              <span>Add Runner</span>
            </Link>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Link href="/runners" className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:shadow-md hover:border-[#00a7ff]/30 transition-all group">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-[#00a7ff]/10 flex items-center justify-center">
                  <svg className="w-5 h-5 text-[#00a7ff]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-slate-700 group-hover:text-[#00a7ff] transition-colors">Runners</h3>
              </div>
              <p className="text-4xl font-bold text-[#00a7ff]">{runnerCount}</p>
              <p className="text-sm text-slate-500 mt-1">Total athletes</p>
            </Link>
            
            <Link href="/activities" className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 transition hover:border-[#00ff67]/30 hover:shadow-md">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-[#00ff67]/10 flex items-center justify-center">
                  <svg className="w-5 h-5 text-[#00ff67]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-slate-700">Activities</h3>
              </div>
              <p className="text-4xl font-bold text-[#00ff67]">{activityCount}</p>
              <p className="text-sm text-slate-500 mt-1">All time</p>
            </Link>
            
            <Link href="/activities" className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 transition hover:border-orange-400/40 hover:shadow-md">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <TeamOverviewChart runnerStats={runnerStats} />
            <RunnerTrendChart activities={recentActivities} />
          </div>

          <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-slate-200">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 rounded-lg bg-[#00ff67]/10 flex items-center justify-center">
                <svg className="w-4 h-4 text-[#00ff67]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-slate-900">Quick Verify</h3>
            </div>
            {activities?.filter(a => !a.verified).length === 0 ? (
              <div className="flex items-center gap-3 text-[#00ff67] bg-[#00ff67]/5 p-4 rounded-lg">
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
                    <div key={activity.id} className="flex flex-col gap-3 py-3 border-b border-slate-100 last:border-0 sm:flex-row sm:items-center sm:justify-between">
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
                          className="w-full bg-[#00ff67] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#00e55c] transition-colors sm:w-auto"
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
