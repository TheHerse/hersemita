interface Activity {
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

export default function RecentActivityTable({ activities }: { activities: Activity[] }) {
  const formatPace = (pace: number) => {
    if (!pace || pace === 0) return '--:--';
    const minutes = Math.floor(pace / 60);
    const seconds = Math.round(pace % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
  };

  const recentActivities = activities.slice(0, 10);

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
          <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="text-xl font-semibold text-slate-900">Recent Activities</h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="text-left py-3 px-4 font-semibold text-slate-700">Runner</th>
              <th className="text-center py-3 px-4 font-semibold text-slate-700">Date</th>
              <th className="text-center py-3 px-4 font-semibold text-slate-700">Distance</th>
              <th className="text-center py-3 px-4 font-semibold text-slate-700">Pace</th>
              <th className="text-center py-3 px-4 font-semibold text-slate-700">Status</th>
            </tr>
          </thead>
          <tbody>
            {recentActivities.map((activity) => (
              <tr key={activity.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                <td className="py-3 px-4">
                  <div className="font-medium text-slate-900">{activity.runner_name}</div>
                </td>
                <td className="py-3 px-4 text-center text-slate-600">
                  {new Date(activity.start_time).toLocaleDateString()}
                </td>
                <td className="py-3 px-4 text-center font-medium text-slate-700">
                  {activity.distance_miles?.toFixed(2)} mi
                </td>
                <td className="py-3 px-4 text-center font-medium text-slate-700">
                  {formatPace(activity.pace_per_mile)}/mi
                </td>
                <td className="py-3 px-4 text-center">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    activity.verified 
                      ? 'bg-[#00ff67]/10 text-[#00ff67]' 
                      : 'bg-orange-100 text-orange-600'
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