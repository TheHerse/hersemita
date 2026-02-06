// components/TeamOverviewChart.tsx
"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

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

export default function TeamOverviewChart({ runnerStats }: TeamOverviewChartProps) {
  const data = runnerStats.map(r => ({
    name: r.runner_name,
    distance: r.total_distance,
    pace: r.avg_pace,
    count: r.activity_count
  }));

  const getPaceColor = (pace: number) => {
    if (pace < 7) return '#22c55e'; // Fast - green
    if (pace < 9) return '#3b82f6'; // Medium - blue
    return '#ef4444'; // Slow - red
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4">Team Overview</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
          <YAxis yAxisId="left" />
          <YAxis yAxisId="right" orientation="right" />
          <Tooltip />
          <Bar yAxisId="left" dataKey="distance" name="Total Distance (mi)" fill="#8884d8" />
          <Bar yAxisId="right" dataKey="count" name="Activities" fill="#82ca9d" />
        </BarChart>
      </ResponsiveContainer>
      
      <div className="mt-4 grid grid-cols-3 gap-4 text-center text-sm">
        <div className="bg-blue-50 p-2 rounded">
          <div className="font-bold text-blue-600">
            {runnerStats.reduce((sum, r) => sum + r.total_distance, 0).toFixed(1)} mi
          </div>
          <div className="text-gray-600">Team Total</div>
        </div>
        <div className="bg-green-50 p-2 rounded">
          <div className="font-bold text-green-600">
            {runnerStats.length}
          </div>
          <div className="text-gray-600">Active Runners</div>
        </div>
        <div className="bg-purple-50 p-2 rounded">
          <div className="font-bold text-purple-600">
            {runnerStats.reduce((sum, r) => sum + r.activity_count, 0)}
          </div>
          <div className="text-gray-600">Total Activities</div>
        </div>
      </div>
    </div>
  );
}