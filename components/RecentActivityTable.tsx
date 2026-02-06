"use client";

import { useState } from 'react';

interface Activity {
  id: string;
  runner_id: string;
  runner_name?: string;
  distance_miles: number;
  pace_per_mile: number;
  start_time: string;
  verified: boolean;
  file_type: string;
}

interface RecentActivityTableProps {
  activities: Activity[];
}

export default function RecentActivityTable({ activities }: RecentActivityTableProps) {
  const [sortField, setSortField] = useState<keyof Activity>('start_time');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [filterVerified, setFilterVerified] = useState<'all' | 'verified' | 'unverified'>('all');

  // ADD THIS FUNCTION
  const handleSort = (field: keyof Activity) => {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sortedActivities = [...activities]
    .filter(a => {
        if (filterVerified === 'verified') return a.verified;
        if (filterVerified === 'unverified') return !a.verified;
        return true;
    })
    .sort((a, b) => {
        const aVal = a[sortField];
        const bVal = b[sortField];
        
        // Handle different types safely
        if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' 
            ? aVal.localeCompare(bVal) 
            : bVal.localeCompare(aVal);
        }
        
        if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
        }
        
        if (typeof aVal === 'boolean' && typeof bVal === 'boolean') {
        return sortDirection === 'asc' 
            ? (aVal === bVal ? 0 : aVal ? 1 : -1)
            : (aVal === bVal ? 0 : aVal ? -1 : 1);
        }
    
    return 0;
    });

  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Recent Activities</h3>
        <select 
          value={filterVerified}
          onChange={(e) => setFilterVerified(e.target.value as any)}
          className="border rounded px-2 py-1 text-sm"
        >
          <option value="all">All</option>
          <option value="verified">Verified Only</option>
          <option value="unverified">Unverified Only</option>
        </select>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th 
                className="px-4 py-2 text-left cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('start_time')}
              >
                Date {sortField === 'start_time' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th className="px-4 py-2 text-left">Runner</th>
              <th 
                className="px-4 py-2 text-left cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('distance_miles')}
              >
                Distance {sortField === 'distance_miles' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th 
                className="px-4 py-2 text-left cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('pace_per_mile')}
              >
                Pace {sortField === 'pace_per_mile' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th className="px-4 py-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {sortedActivities.map((activity) => (
              <tr key={activity.id} className="border-t hover:bg-gray-50">
                <td className="px-4 py-2">
                  {new Date(activity.start_time).toLocaleDateString()}
                </td>
                <td className="px-4 py-2">{activity.runner_name || 'Unknown'}</td>
                <td className="px-4 py-2">{activity.distance_miles.toFixed(2)} mi</td>
                <td className="px-4 py-2">
                  {Math.floor(activity.pace_per_mile)}:
                  {Math.round((activity.pace_per_mile % 1) * 60).toString().padStart(2, '0')} /mi
                </td>
                <td className="px-4 py-2">
                  <span className={`px-2 py-1 rounded text-xs ${
                    activity.verified 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {activity.verified ? 'Verified' : 'Pending'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}