"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface RunnerStats {
  runner_id: string;
  runner_name: string;
  total_distance: number;
  avg_pace: number;
  activity_count: number;
  last_activity_date: string;
}

interface TeamOverviewChartProps {
  runnerStats: RunnerStats[];
}

interface TooltipPayload {
  value: number;
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 rounded-lg shadow-lg border border-slate-200">
        <p className="font-semibold text-slate-900 mb-1">{label}</p>
        <p className="text-[#00a7ff] text-sm">
          Distance: {payload[0].value.toFixed(1)} mi
        </p>
        <p className="text-[#00ff67] text-sm">
          Activities: {payload[1].value}
        </p>
      </div>
    );
  }
  return null;
}

export default function TeamOverviewChart({ runnerStats }: TeamOverviewChartProps) {
  const data = runnerStats.map(r => ({
    name: r.runner_name,
    distance: r.total_distance,
    pace: r.avg_pace,
    count: r.activity_count
  }));

  return (
    <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-slate-200">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-8 h-8 rounded-lg bg-[#00a7ff]/10 flex items-center justify-center">
          <svg className="w-4 h-4 text-[#00a7ff]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <h3 className="text-xl font-semibold text-slate-900">Team Overview</h3>
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 80 }}>
          <XAxis 
            dataKey="name" 
            angle={-45} 
            textAnchor="end" 
            height={80}
            tick={{ fill: '#64748b', fontSize: 12 }}
            axisLine={{ stroke: '#e2e8f0' }}
            tickLine={{ stroke: '#e2e8f0' }}
          />
          <YAxis 
            yAxisId="left"
            tick={{ fill: '#64748b', fontSize: 12 }}
            axisLine={{ stroke: '#e2e8f0' }}
            tickLine={{ stroke: '#e2e8f0' }}
          />
          <YAxis 
            yAxisId="right" 
            orientation="right"
            tick={{ fill: '#64748b', fontSize: 12 }}
            axisLine={{ stroke: '#e2e8f0' }}
            tickLine={{ stroke: '#e2e8f0' }}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f1f5f9' }} />
          <Bar 
            yAxisId="left" 
            dataKey="distance" 
            name="Total Distance (mi)" 
            fill="#00a7ff"
            radius={[4, 4, 0, 0]}
          />
          <Bar 
            yAxisId="right" 
            dataKey="count" 
            name="Activities" 
            fill="#00ff67"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
      
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        <div className="bg-gradient-to-br from-[#00a7ff]/10 to-[#00a7ff]/5 p-4 rounded-xl border border-[#00a7ff]/20">
          <div className="text-2xl font-bold text-[#00a7ff]">
            {runnerStats.reduce((sum, r) => sum + r.total_distance, 0).toFixed(1)} mi
          </div>
          <div className="text-sm text-slate-600 font-medium">Team Total</div>
        </div>
        <div className="bg-gradient-to-br from-[#00ff67]/10 to-[#00ff67]/5 p-4 rounded-xl border border-[#00ff67]/20">
          <div className="text-2xl font-bold text-[#00ff67]">
            {runnerStats.length}
          </div>
          <div className="text-sm text-slate-600 font-medium">Active Runners</div>
        </div>
        <div className="bg-gradient-to-br from-slate-100 to-slate-50 p-4 rounded-xl border border-slate-200">
          <div className="text-2xl font-bold text-slate-700">
            {runnerStats.reduce((sum, r) => sum + r.activity_count, 0)}
          </div>
          <div className="text-sm text-slate-600 font-medium">Total Activities</div>
        </div>
      </div>
    </div>
  );
}
