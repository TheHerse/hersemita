"use client";

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface Activity {
  id: string;
  start_time: string;
  pace_per_mile: number;
  distance_miles: number;
}

interface RunnerTrendChartProps {
  activities: Activity[];
}

export default function RunnerTrendChart({ activities }: RunnerTrendChartProps) {
  const data = activities.map((a: Activity) => ({
    date: new Date(a.start_time).toLocaleDateString(),
    pace: a.pace_per_mile,
    distance: a.distance_miles
  }));

  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4">Runner Progress</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <XAxis dataKey="date" />
          <YAxis yAxisId="left" />
          <YAxis yAxisId="right" orientation="right" />
          <Tooltip />
          <Line 
            yAxisId="left" 
            type="monotone" 
            dataKey="pace" 
            stroke="#8884d8" 
            name="Pace (min/mi)" 
          />
          <Line 
            yAxisId="right" 
            type="monotone" 
            dataKey="distance" 
            stroke="#82ca9d" 
            name="Distance (mi)" 
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}