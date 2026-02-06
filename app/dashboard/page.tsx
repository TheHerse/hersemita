// app/dashboard/page.tsx
import { auth } from "@clerk/nextjs/server";
import { UserButton } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import RunnerTrendChart from "@/components/RunnerTrendChart";
import TeamOverviewChart from "@/components/TeamOverviewChart";
import RecentActivityTable from "@/components/RecentActivityTable";
import RunnerPerformanceTable from "@/components/RunnerPerformanceTable";
import DeleteActivityButton from "@/components/DeleteActivityButton";

interface ActivityWithRunner {
  id: string;
  runner_id: string;
  first_name: string;
  last_name: string;
  distance_miles: number;
  pace_per_mile: number;
  start_time: string;
  verified: boolean;
  runner_name: string;
  file_type: string;
}

type PaceTrend = 'improving' | 'declining' | 'stable';

async function verifyActivity(activityId: string) {
  "use server";
  
  const { data: activity, error } = await supabase
    .from("activities")
    .select(`
      *,
      runners!inner (
        id,
        first_name,
        last_name,
        parent_phone,
        coaches (name)
      )
    `)
    .eq("id", activityId)
    .single();
  
  if (error || !activity) throw new Error("Activity not found");
  
  const { error: updateError } = await supabase
    .from("activities")
    .update({ verified: true })
    .eq("id", activityId);
  
  if (updateError) throw updateError;
  
  redirect("/dashboard");
}

async function deleteActivity(activityId: string) {
  "use server";
  
  const { error } = await supabase
    .from("activities")
    .delete()
    .eq("id", activityId);
  
  if (error) throw error;
  
  redirect("/dashboard");
}

async function updateActivity(formData: FormData) {
  "use server";
  
  const activityId = formData.get("activityId") as string;
  const distance = parseFloat(formData.get("distance") as string);
  const paceMinutes = parseInt(formData.get("paceMinutes") as string) || 0;
  const paceSeconds = parseInt(formData.get("paceSeconds") as string) || 0;
  
  // Convert minutes:seconds to total seconds
  const pace = (paceMinutes * 60) + paceSeconds;
  
  const { error } = await supabase
    .from("activities")
    .update({ 
      distance_miles: distance,
      pace_per_mile: pace
    })
    .eq("id", activityId);
  
  if (error) throw error;
  
  redirect("/dashboard");
}

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect("/");

  const { data: coach } = await supabase
    .from("coaches")
    .select("id")
    .eq("email", userId)
    .single();

  const { data: runners } = await supabase
    .from("runners")
    .select("*")
    .eq("coach_id", coach?.id);

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

  const formattedActivities: ActivityWithRunner[] = activities?.map(activity => ({
    id: activity.id,
    runner_id: activity.runner_id,
    first_name: activity.runners.first_name,
    last_name: activity.runners.last_name,
    runner_name: `${activity.runners.first_name} ${activity.runners.last_name}`,
    distance_miles: activity.distance_miles,
    pace_per_mile: activity.pace_per_mile,
    start_time: activity.start_time,
    verified: activity.verified,
    file_type: activity.file_type || 'gpx'
  })) || [];

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
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b px-8 py-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-900">Hersemita</h1>
        <div className="flex gap-4 items-center">
          <Link href="/runners" className="text-blue-600 hover:underline">Runners</Link>
          <Link href="/runners/message" className="text-blue-600 hover:underline">Message Parents</Link>
          <UserButton afterSignOutUrl="/" />
        </div>
      </header>

      <main className="p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-3xl font-bold text-slate-900">Coach Dashboard</h2>
            <Link href="/runners/new" className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 font-semibold">
              + Add Runner
            </Link>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Link href="/runners" className="bg-white p-6 rounded-lg shadow-sm border hover:shadow-md transition-shadow">
              <h3 className="text-lg font-semibold mb-2 text-slate-700">Runners</h3>
              <p className="text-3xl font-bold text-blue-600">{runnerCount}</p>
              <p className="text-sm text-slate-500 mt-1">Total athletes</p>
            </Link>
            
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <h3 className="text-lg font-semibold mb-2 text-slate-700">Activities</h3>
              <p className="text-3xl font-bold text-green-600">{activityCount}</p>
              <p className="text-sm text-slate-500 mt-1">All time</p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <h3 className="text-lg font-semibold mb-2 text-slate-700">Pending</h3>
              <p className="text-3xl font-bold text-orange-600">{pendingCount}</p>
              <p className="text-sm text-slate-500 mt-1">Unverified runs</p>
            </div>
          </div>

          <div className="mb-8">
            <RunnerPerformanceTable performances={runnerPerformances} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <TeamOverviewChart runnerStats={runnerStats} />
            <RunnerTrendChart activities={recentActivities} />
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border mb-8">
            <h3 className="text-xl font-semibold mb-4">Activity Management</h3>
            <div className="space-y-4">
              {activities?.map((activity) => {
                const paceMinutes = Math.floor(activity.pace_per_mile / 60);
                const paceSeconds = Math.round(activity.pace_per_mile % 60).toString().padStart(2, '0');
                const paceDisplay = `${paceMinutes}:${paceSeconds}`;
                const runner = activity.runners;
                
                return (
                  <div key={activity.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="font-medium text-lg">{runner.first_name} {runner.last_name}</div>
                        <div className="text-sm text-slate-600">
                          {new Date(activity.start_time).toLocaleDateString()} • {activity.file_type?.toUpperCase() || 'GPX'}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          activity.verified ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {activity.verified ? 'Verified' : 'Pending'}
                        </span>
                      </div>
                    </div>
                    
                    <form action={updateActivity} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end mb-3">
                      <input type="hidden" name="activityId" value={activity.id} />
                      
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Distance (miles)</label>
                        <input 
                          type="number" 
                          name="distance" 
                          defaultValue={activity.distance_miles?.toFixed(2)}
                          step="0.01"
                          className="border rounded px-2 py-1 w-full text-sm"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Pace (min:sec/mi)</label>
                        <div className="flex gap-1">
                          <input 
                            type="number" 
                            name="paceMinutes" 
                            defaultValue={paceMinutes}
                            min="0"
                            className="border rounded px-2 py-1 w-full text-sm"
                            placeholder="min"
                          />
                          <span className="self-center">:</span>
                          <input 
                            type="number" 
                            name="paceSeconds" 
                            defaultValue={paceSeconds}
                            min="0"
                            max="59"
                            className="border rounded px-2 py-1 w-full text-sm"
                            placeholder="sec"
                          />
                        </div>
                      </div>
                      
                      <div>
                        <button 
                          type="submit" 
                          className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 w-full"
                        >
                          Update
                        </button>
                      </div>
                      
                      <div className="text-right text-sm text-gray-600">
                        Current: {activity.distance_miles?.toFixed(2)} mi • {paceDisplay}/mi
                      </div>
                    </form>
                    
                    <div className="flex justify-end gap-2 pt-2 border-t">
                      {!activity.verified && (
                        <form action={verifyActivity.bind(null, activity.id)} className="inline">
                          <button 
                            type="submit" 
                            className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                          >
                            Verify
                          </button>
                        </form>
                      )}
                      <form action={deleteActivity.bind(null, activity.id)} className="inline">
                        <DeleteActivityButton activityId={activity.id} />
                      </form>
                    </div>
                  </div>
                );
              })}
              {activities?.length === 0 && (
                <p className="text-slate-500">No activities yet. Upload runs to start tracking.</p>
              )}
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <h3 className="text-xl font-semibold mb-4">Quick Verify</h3>
            {activities?.filter(a => !a.verified).length === 0 ? (
              <p className="text-green-600">All activities verified! 🎉</p>
            ) : (
              <div className="space-y-3">
                {activities?.filter(a => !a.verified).slice(0, 5).map((activity) => {
                  const paceMinutes = Math.floor(activity.pace_per_mile / 60);
                  const paceSeconds = Math.round(activity.pace_per_mile % 60).toString().padStart(2, '0');
                  const pace = `${paceMinutes}:${paceSeconds}`;
                  const runner = activity.runners;
                  
                  return (
                    <div key={activity.id} className="flex justify-between items-center py-3 border-b">
                      <div className="flex-1">
                        <div className="font-medium">{runner.first_name} {runner.last_name}</div>
                        <div className="text-sm text-slate-600">
                          {activity.distance_miles?.toFixed(2)} miles • {pace}/mi pace
                        </div>
                      </div>
                      <form action={verifyActivity.bind(null, activity.id)}>
                        <button 
                          type="submit" 
                          className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
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