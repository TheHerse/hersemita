// components/RunnerPerformanceTable.tsx
"use client";

import { useState } from 'react';

interface RunnerPerformance {
  runner_id: string;
  runner_name: string;
  total_activities: number;
  total_distance: number;
  avg_pace: number;
  best_pace: number;
  worst_pace: number;
  pace_trend: 'improving' | 'declining' | 'stable';
  last_7_days_distance: number;
  previous_7_days_distance: number;
  distance_change_percent: number;
  last_activity_date: string;
}

interface RunnerPerformanceTableProps {
  performances: RunnerPerformance[];
}

export default function RunnerPerformanceTable({ performances }: RunnerPerformanceTableProps) {
  const [sortField, setSortField] = useState<keyof RunnerPerformance>('pace_trend');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const sortedPerformances = [...performances].sort((a, b) => {
    const aVal = a[sortField];
    const bVal = b[sortField];
    
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    }
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortDirection === 'asc' 
        ? aVal.localeCompare(bVal) 
        : bVal.localeCompare(aVal);
    }
    return 0;
  });

  const handleSort = (field: keyof RunnerPerformance) => {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'improving': return 'text-green-600 bg-green-50';
      case 'declining': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getChangeColor = (percent: number) => {
    if (percent > 10) return 'text-green-600';
    if (percent < -10) return 'text-red-600';
    return 'text-gray-600';
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Runner Performance Analysis</h3>
        <div className="text-sm text-gray-500">
          Click headers to sort • Shows 7-day trends
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left">Runner</th>
              <th 
                className="px-3 py-2 text-left cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('pace_trend')}
              >
                Pace Trend {sortField === 'pace_trend' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th 
                className="px-3 py-2 text-left cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('avg_pace')}
              >
                Avg Pace {sortField === 'avg_pace' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th 
                className="px-3 py-2 text-left cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('distance_change_percent')}
              >
                Weekly Change {sortField === 'distance_change_percent' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th 
                className="px-3 py-2 text-left cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('total_distance')}
              >
                Total Mi {sortField === 'total_distance' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th className="px-3 py-2 text-left">Best/Worst Pace</th>
              <th className="px-3 py-2 text-left">Last Run</th>
            </tr>
          </thead>
          <tbody>
            {sortedPerformances.map((runner) => (
              <tr key={runner.runner_id} className="border-t hover:bg-gray-50">
                <td className="px-3 py-2 font-medium">{runner.runner_name}</td>
                <td className="px-3 py-2">
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${getTrendColor(runner.pace_trend)}`}>
                    {runner.pace_trend === 'improving' ? '↗ Improving' : 
                     runner.pace_trend === 'declining' ? '↘ Declining' : '→ Stable'}
                  </span>
                </td>
                <td className="px-3 py-2">
                  {Math.floor(runner.avg_pace)}:
                  {Math.round((runner.avg_pace % 1) * 60).toString().padStart(2, '0')} /mi
                </td>
                <td className={`px-3 py-2 font-semibold ${getChangeColor(runner.distance_change_percent)}`}>
                  {runner.distance_change_percent > 0 ? '+' : ''}
                  {runner.distance_change_percent.toFixed(1)}%
                </td>
                <td className="px-3 py-2">{runner.total_distance.toFixed(1)} mi</td>
                <td className="px-3 py-2 text-xs">
                  <span className="text-green-600">
                    {Math.floor(runner.best_pace)}:
                    {Math.round((runner.best_pace % 1) * 60).toString().padStart(2, '0')}
                  </span>
                  {' / '}
                  <span className="text-red-600">
                    {Math.floor(runner.worst_pace)}:
                    {Math.round((runner.worst_pace % 1) * 60).toString().padStart(2, '0')}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs text-gray-500">
                  {runner.last_activity_date ? 
                    new Date(runner.last_activity_date).toLocaleDateString() : 'Never'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}