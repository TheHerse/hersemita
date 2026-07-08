"use client";

import type { CSSProperties } from "react";
import { useMemo } from "react";

interface Activity {
  id: string;
  runner_id: string;
  pace_per_mile: number;
  distance_miles: number;
  start_time: string;
  verified: boolean;
}

export default function RunnerTrendChart({ activities, unitLabel = "mi" }: { activities: Activity[]; unitLabel?: string }) {
  const chartData = useMemo(() => {
    const latestActivityTime = activities.reduce((latest, activity) => {
      return Math.max(latest, new Date(activity.start_time).getTime());
    }, 0);

    if (!latestActivityTime) {
      return [];
    }

    const start = new Date(latestActivityTime);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - 13);

    const latestEnd = new Date(latestActivityTime);
    latestEnd.setHours(23, 59, 59, 999);

    const recentActivities = activities.filter(a => {
      const time = new Date(a.start_time).getTime();
      return time >= start.getTime() && time <= latestEnd.getTime() && a.verified;
    });

    const dailyData = recentActivities.reduce((acc, activity) => {
      const date = new Date(activity.start_time);
      date.setHours(0, 0, 0, 0);
      const key = date.toISOString();
      acc[key] = acc[key] || { distance: 0, count: 0 };
      acc[key].distance += activity.distance_miles;
      acc[key].count += 1;
      return acc;
    }, {} as Record<string, { distance: number; count: number }>);

    return Array.from({ length: 14 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      const key = date.toISOString();
      return {
        day: date.toLocaleDateString('en-US', { weekday: 'short' }),
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        distance: dailyData[key]?.distance || 0,
        count: dailyData[key]?.count || 0,
      };
    });
  }, [activities]);

  const maxDistance = Math.max(...chartData.map(d => d.distance), 1);
  const totalDistance = chartData.reduce((sum, day) => sum + day.distance, 0);
  const completedDays = chartData.filter(day => day.count > 0).length;
  const totalRuns = chartData.reduce((sum, day) => sum + day.count, 0);
  const consistency = chartData.length ? Math.round((completedDays / chartData.length) * 100) : 0;

  return (
    <div className="section-card p-4 sm:p-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="section-icon" style={{ "--icon-color": "#00ff67" } as CSSProperties}>
            <svg className="w-4 h-4 text-[#00ff67]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 13h4l3-8 4 14 3-6h4" />
            </svg>
          </div>
          <div>
            <h3 className="text-xl font-semibold text-slate-900">Recent Training Volume</h3>
            <p className="text-sm text-slate-500">Verified distance and upload consistency across the latest 14 days.</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center sm:min-w-[260px]">
          <MiniStat label={unitLabel} value={totalDistance.toFixed(1)} />
          <MiniStat label="Runs" value={String(totalRuns)} />
          <MiniStat label="Days" value={`${consistency}%`} />
        </div>
      </div>

      {chartData.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
          No verified activity data yet.
        </div>
      ) : (
      <div className="flex items-end justify-between h-40 gap-1 sm:h-48 sm:gap-1.5">
        {chartData.map((data) => (
          <div key={data.date} className="flex-1 flex min-w-0 flex-col items-center gap-2">
            <div className="w-full bg-slate-100 rounded-t-lg relative overflow-hidden border border-slate-200/60" style={{ height: '100%' }}>
              <div 
                className={`absolute bottom-0 w-full rounded-t-lg transition-all duration-500 ${data.count > 0 ? "bg-gradient-to-t from-[#00a7ff] via-[#32d7d0] to-[#00ff67] shadow-lg shadow-[#00a7ff]/15" : "bg-slate-200"}`}
                style={{ height: `${data.count > 0 ? Math.max(8, (data.distance / maxDistance) * 100) : 4}%` }}
              />
            </div>
            <div className="text-xs font-medium text-slate-600">{data.day}</div>
            <div className={data.count > 0 ? "text-xs text-slate-500" : "text-xs text-orange-500"}>{data.count > 0 ? `${data.distance.toFixed(1)} ${unitLabel}` : "miss"}</div>
          </div>
        ))}
      </div>
      )}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-black text-slate-900">{value}</p>
    </div>
  );
}
