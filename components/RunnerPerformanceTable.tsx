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

export default function RunnerPerformanceTable({ performances }: { performances: RunnerPerformance[] }) {
  const formatPace = (pace: number) => {
    if (!pace || pace === 0) return '--:--';
    const minutes = Math.floor(pace / 60);
    const seconds = Math.round(pace % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
  };

  const formatDistance = (distance: number) => {
    return distance.toFixed(1);
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving':
        return <span className="text-[#00ff67] font-semibold">↓ Improving</span>;
      case 'declining':
        return <span className="text-red-500 font-semibold">↑ Declining</span>;
      default:
        return <span className="text-slate-500 font-semibold">→ Stable</span>;
    }
  };

  const getChangeColor = (change: number) => {
    if (change > 10) return 'text-[#00ff67]';
    if (change < -10) return 'text-red-500';
    return 'text-slate-600';
  };

  return (
    <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#00ff67] to-[#00a7ff] flex items-center justify-center">
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        </div>
        <h3 className="text-xl font-semibold text-slate-900">Runner Performance</h3>
      </div>
      
      <div className="space-y-3 md:hidden">
        {performances.map((perf) => (
          <div key={perf.runner_id} className="rounded-xl border border-slate-700 bg-slate-900/40 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-bold text-white">{perf.runner_name}</div>
                <div className="mt-1 text-sm text-slate-400">{perf.total_activities} activities</div>
              </div>
              <span className="rounded-full bg-[#00a7ff]/10 px-3 py-1 text-sm font-bold text-[#7dd3fc]">
                {formatDistance(perf.total_distance)} mi
              </span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-slate-400">Avg Pace</p>
                <p className="font-bold text-white">{formatPace(perf.avg_pace)}/mi</p>
              </div>
              <div>
                <p className="text-slate-400">Best Pace</p>
                <p className="font-bold text-[#00ff67]">{formatPace(perf.best_pace)}/mi</p>
              </div>
              <div>
                <p className="text-slate-400">Trend</p>
                <div className="text-sm">{getTrendIcon(perf.pace_trend)}</div>
              </div>
              <div>
                <p className="text-slate-400">7-Day Change</p>
                <p className={`font-bold ${getChangeColor(perf.distance_change_percent)}`}>
                  {perf.distance_change_percent > 0 ? '+' : ''}
                  {perf.distance_change_percent.toFixed(1)}%
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="text-left py-3 px-4 font-semibold text-slate-700">Runner</th>
              <th className="text-center py-3 px-4 font-semibold text-slate-700">Activities</th>
              <th className="text-center py-3 px-4 font-semibold text-slate-700">Total Distance</th>
              <th className="text-center py-3 px-4 font-semibold text-slate-700">Avg Pace</th>
              <th className="text-center py-3 px-4 font-semibold text-slate-700">Best Pace</th>
              <th className="text-center py-3 px-4 font-semibold text-slate-700">Pace Trend</th>
              <th className="text-center py-3 px-4 font-semibold text-slate-700">7-Day Change</th>
            </tr>
          </thead>
          <tbody>
            {performances.map((perf) => (
              <tr key={perf.runner_id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                <td className="py-3 px-4">
                  <div className="font-medium text-slate-900">{perf.runner_name}</div>
                </td>
                <td className="py-3 px-4 text-center">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[#00a7ff]/10 text-[#00a7ff] font-semibold">
                    {perf.total_activities}
                  </span>
                </td>
                <td className="py-3 px-4 text-center font-medium text-slate-700">
                  {formatDistance(perf.total_distance)} mi
                </td>
                <td className="py-3 px-4 text-center font-medium text-slate-700">
                  {formatPace(perf.avg_pace)}/mi
                </td>
                <td className="py-3 px-4 text-center">
                  <span className="inline-flex items-center px-2 py-1 rounded bg-[#00ff67]/10 text-[#00ff67] font-semibold text-xs">
                    {formatPace(perf.best_pace)}/mi
                  </span>
                </td>
                <td className="py-3 px-4 text-center text-xs">
                  {getTrendIcon(perf.pace_trend)}
                </td>
                <td className="py-3 px-4 text-center">
                  <span className={`font-semibold ${getChangeColor(perf.distance_change_percent)}`}>
                    {perf.distance_change_percent > 0 ? '+' : ''}
                    {perf.distance_change_percent.toFixed(1)}%
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
