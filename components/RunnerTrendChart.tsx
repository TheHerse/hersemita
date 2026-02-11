"use client";

import { useMemo } from "react";

interface Activity {
  id: string;
  runner_id: string;
  pace_per_mile: number;
  distance_miles: number;
  start_time: string;
  verified: boolean;
}

export default function RunnerTrendChart({ activities }: { activities: Activity[] }) {
  const chartData = useMemo(() => {
    const last7Days = activities.filter(a => {
      const daysAgo = (Date.now() - new Date(a.start_time).getTime()) / (1000 * 60 * 60 * 24);
      return daysAgo <= 7 && a.verified;
    });

    const dailyData = last7Days.reduce((acc, activity) => {
      const date = new Date(activity.start_time).toLocaleDateString('en-US', { weekday: 'short' });
      if (!acc[date]) acc[date] = { distance: 0, count: 0 };
      acc[date].distance += activity.distance_miles;
      acc[date].count += 1;
      return acc;
    }, {} as Record<string, { distance: number; count: number }>);

    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const today = new Date().getDay();
    const orderedDays = [...days.slice(today + 1), ...days.slice(0, today + 1)].slice(-7);

    return orderedDays.map(day => ({
      day,
      distance: dailyData[day]?.distance || 0,
      count: dailyData[day]?.count || 0
    }));
  }, [activities]);

  const maxDistance = Math.max(...chartData.map(d => d.distance), 1);

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-8 h-8 rounded-lg bg-[#00ff67]/10 flex items-center justify-center">
          <svg className="w-4 h-4 text-[#00ff67]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        </div>
        <h3 className="text-xl font-semibold text-slate-900">7-Day Activity Trend</h3>
      </div>

      <div className="flex items-end justify-between h-48 gap-2">
        {chartData.map((data, index) => (
          <div key={data.day} className="flex-1 flex flex-col items-center gap-2">
            <div className="w-full bg-slate-100 rounded-t-lg relative overflow-hidden" style={{ height: '100%' }}>
              <div 
                className="absolute bottom-0 w-full bg-gradient-to-t from-[#00a7ff] to-[#00ff67] transition-all duration-500 rounded-t-lg"
                style={{ height: `${(data.distance / maxDistance) * 100}%` }}
              />
            </div>
            <div className="text-xs font-medium text-slate-600">{data.day}</div>
            <div className="text-xs text-slate-400">{data.distance.toFixed(1)} mi</div>
          </div>
        ))}
      </div>
    </div>
  );
}