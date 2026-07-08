"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { distanceUnitLabel, milesToDistance, normalizeDistanceUnit, paceFromMiles } from "@/lib/distance-units";

type Runner = {
  id: string;
  first_name: string;
  last_name: string;
  grade: number | null;
};

type Group = {
  id: string;
  name: string;
  color: string | null;
};

type Membership = {
  group_id: string;
  runner_id: string;
};

type Activity = {
  id: string;
  runner_id: string;
  distance_miles: number | null;
  pace_per_mile: number | null;
  duration_seconds: number | null;
  start_time: string;
  verified: boolean | null;
  detected_app: string | null;
};

type AthleteRow = {
  id: string;
  name: string;
  groups: string[];
  runs: number;
  miles: number;
  avgPace: number;
  bestPace: number;
  longRun: number;
  loadChange: number;
  consistency: number;
  verifiedRate: number;
  flag: string;
};

const DATE_WINDOWS = [
  { label: "14 days", days: 14 },
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
  { label: "All", days: 0 },
];

const COLORS = ["#00a7ff", "#00ff67", "#f59e0b", "#ef4444", "#14b8a6", "#a78bfa"];

function formatPace(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "--:--";
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.round(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainder}`;
}

function shortDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const midpoint = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[midpoint] : (sorted[midpoint - 1] + sorted[midpoint]) / 2;
}

function attentionClass(flag: string) {
  if (flag === "No data in view" || flag === "Needs verification") return "border-orange-400/30 bg-orange-400/10 text-orange-300";
  if (flag === "Volume spike" || flag === "Volume drop") return "border-red-400/30 bg-red-400/10 text-red-300";
  if (flag === "Pace improving") return "border-[#00ff67]/30 bg-[#00ff67]/10 text-[#86efac]";
  return "border-[#00a7ff]/30 bg-[#00a7ff]/10 text-[#7dd3fc]";
}

export default function CoachAnalyticsWorkbench({
  coachName,
  schoolName,
  runners,
  groups,
  memberships,
  activities,
  preferredDistanceUnit,
}: {
  coachName: string;
  schoolName: string;
  runners: Runner[];
  groups: Group[];
  memberships: Membership[];
  activities: Activity[];
  preferredDistanceUnit?: string;
}) {
  const [windowDays, setWindowDays] = useState(30);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [selectedRunnerIds, setSelectedRunnerIds] = useState<string[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const displayUnit = normalizeDistanceUnit(preferredDistanceUnit);
  const unitLabel = distanceUnitLabel(displayUnit);

  const runnerGroups = useMemo(() => {
    const groupsById = new Map(groups.map((group) => [group.id, group]));
    const map = new Map<string, Group[]>();
    memberships.forEach((membership) => {
      const group = groupsById.get(membership.group_id);
      if (!group) return;
      const current = map.get(membership.runner_id) || [];
      current.push(group);
      map.set(membership.runner_id, current);
    });
    return map;
  }, [groups, memberships]);

  const selectedIds = useMemo(() => {
    const ids = new Set<string>();
    selectedRunnerIds.forEach((id) => ids.add(id));
    memberships.forEach((membership) => {
      if (selectedGroupIds.includes(membership.group_id)) ids.add(membership.runner_id);
    });
    return ids.size ? ids : new Set(runners.map((runner) => runner.id));
  }, [memberships, runners, selectedGroupIds, selectedRunnerIds]);

  const latestTime = useMemo(
    () => activities.reduce((latest, activity) => Math.max(latest, new Date(activity.start_time).getTime()), 0),
    [activities]
  );

  const filteredActivities = useMemo(() => {
    return activities.filter((activity) => {
      if (!selectedIds.has(activity.runner_id)) return false;
      if (verifiedOnly && !activity.verified) return false;
      if (windowDays === 0 || latestTime === 0) return true;
      const daysAgo = (latestTime - new Date(activity.start_time).getTime()) / 86400000;
      return daysAgo <= windowDays;
    });
  }, [activities, latestTime, selectedIds, verifiedOnly, windowDays]);

  const athleteRows = useMemo<AthleteRow[]>(() => {
    return runners
      .filter((runner) => selectedIds.has(runner.id))
      .map((runner) => {
        const athleteActivities = filteredActivities.filter((activity) => activity.runner_id === runner.id);
        const distances = athleteActivities.map((activity) => activity.distance_miles || 0).filter((distance) => distance > 0);
        const paces = athleteActivities.map((activity) => activity.pace_per_mile || 0).filter((pace) => pace > 0);
        const sorted = [...athleteActivities].sort(
          (a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime()
        );
        const half = Math.max(1, Math.ceil(sorted.length / 2));
        const recentMileage = sorted.slice(0, half).reduce((sum, activity) => sum + (activity.distance_miles || 0), 0);
        const olderMileage = sorted.slice(half).reduce((sum, activity) => sum + (activity.distance_miles || 0), 0);
        const medianDistance = median(distances);
        const consistency = distances.length
          ? distances.filter((distance) => Math.abs(distance - medianDistance) <= Math.max(1, medianDistance * 0.35)).length /
            distances.length
          : 0;
        const loadChange = olderMileage > 0 ? ((recentMileage - olderMileage) / olderMileage) * 100 : recentMileage > 0 ? 100 : 0;
        const verifiedRate = athleteActivities.length
          ? athleteActivities.filter((activity) => activity.verified).length / athleteActivities.length
          : 0;
        let flag = "On track";
        if (athleteActivities.length === 0) flag = "No data in view";
        else if (verifiedRate < 0.75) flag = "Needs verification";
        else if (loadChange > 35) flag = "Volume spike";
        else if (loadChange < -35) flag = "Volume drop";
        else if (paces.length >= 3 && average(paces.slice(0, 3)) < average(paces) * 0.96) flag = "Pace improving";

        return {
          id: runner.id,
          name: `${runner.first_name} ${runner.last_name}`,
          groups: (runnerGroups.get(runner.id) || []).map((group) => group.name),
          runs: athleteActivities.length,
          miles: milesToDistance(distances.reduce((sum, distance) => sum + distance, 0), displayUnit),
          avgPace: paceFromMiles(average(paces), displayUnit),
          bestPace: paceFromMiles(paces.length ? Math.min(...paces) : 0, displayUnit),
          longRun: milesToDistance(distances.length ? Math.max(...distances) : 0, displayUnit),
          loadChange,
          consistency,
          verifiedRate,
          flag,
        };
      })
      .sort((a, b) => b.miles - a.miles);
  }, [displayUnit, filteredActivities, runnerGroups, runners, selectedIds]);

  const totals = useMemo(() => {
    const miles = filteredActivities.reduce((sum, activity) => sum + (activity.distance_miles || 0), 0);
    const paces = filteredActivities.map((activity) => activity.pace_per_mile || 0).filter((pace) => pace > 0);
    const activeRunners = athleteRows.filter((row) => row.runs > 0).length;
    const verified = filteredActivities.filter((activity) => activity.verified).length;
    return {
      miles: milesToDistance(miles, displayUnit),
      runs: filteredActivities.length,
      activeRunners,
      avgPace: paceFromMiles(average(paces), displayUnit),
      verifiedRate: filteredActivities.length ? verified / filteredActivities.length : 0,
    };
  }, [athleteRows, displayUnit, filteredActivities]);

  const dailyTrend = useMemo(() => {
    const byDay = new Map<string, { date: string; time: number; miles: number; runs: number; avgPaceValues: number[] }>();
    filteredActivities.forEach((activity) => {
      const date = shortDate(activity.start_time);
      const current = byDay.get(date) || { date, time: new Date(activity.start_time).getTime(), miles: 0, runs: 0, avgPaceValues: [] };
      current.miles += milesToDistance(activity.distance_miles || 0, displayUnit);
      current.runs += 1;
      if (activity.pace_per_mile) current.avgPaceValues.push(paceFromMiles(activity.pace_per_mile, displayUnit));
      byDay.set(date, current);
    });
    return [...byDay.values()]
      .map((day) => ({ ...day, avgPace: average(day.avgPaceValues) / 60 }))
      .sort((a, b) => a.time - b.time);
  }, [displayUnit, filteredActivities]);

  const groupRows = useMemo(() => {
    return groups.map((group) => {
      const runnerIds = memberships.filter((membership) => membership.group_id === group.id).map((membership) => membership.runner_id);
      const groupActivities = filteredActivities.filter((activity) => runnerIds.includes(activity.runner_id));
      const paces = groupActivities.map((activity) => activity.pace_per_mile || 0).filter((pace) => pace > 0);
      return {
        id: group.id,
        name: group.name,
        color: group.color || "#00a7ff",
        runners: runnerIds.length,
        miles: milesToDistance(groupActivities.reduce((sum, activity) => sum + (activity.distance_miles || 0), 0), displayUnit),
        runs: groupActivities.length,
        avgPace: paceFromMiles(average(paces), displayUnit),
      };
    });
  }, [displayUnit, filteredActivities, groups, memberships]);

  const sourceMix = useMemo(() => {
    const byApp = new Map<string, number>();
    filteredActivities.forEach((activity) => {
      const app = activity.detected_app || "Manual";
      byApp.set(app, (byApp.get(app) || 0) + 1);
    });
    return [...byApp.entries()].map(([name, value]) => ({ name, value }));
  }, [filteredActivities]);

  const selectedLabel =
    selectedRunnerIds.length || selectedGroupIds.length
      ? `${selectedIds.size} runner${selectedIds.size === 1 ? "" : "s"} selected`
      : "Entire roster";
  const attentionCount = athleteRows.filter((row) => !["On track", "Pace improving"].includes(row.flag)).length;

  const exportParams = useMemo(() => {
    const params = new URLSearchParams();
    if (windowDays > 0) params.set("days", String(windowDays));
    if (verifiedOnly) params.set("verified", "1");
    params.set("runnerIds", Array.from(selectedIds).join(","));
    return params.toString();
  }, [selectedIds, verifiedOnly, windowDays]);
  const activityExportHref = `/api/exports/activities?${exportParams}`;
  const runnerSummaryExportHref = `/api/exports/runner-summary?${exportParams}`;

  const toggle = (value: string, values: string[], setValues: (next: string[]) => void) => {
    setValues(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
  };

  return (
    <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
      <section className="mb-6 rounded-2xl border border-white/10 bg-white/10 p-5 shadow-2xl shadow-black/10 backdrop-blur sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#00a7ff]">Coach Analytics</p>
            <h2 className="mt-2 text-3xl font-bold text-white sm:text-4xl">{schoolName}</h2>
            <p className="mt-2 max-w-3xl text-[#cbd5e1]">
              {coachName} can compare runners and groups, spot verification gaps, and export clean training reports from one filtered view.
            </p>
          </div>
          <div className="rounded-xl border border-[#00ff67]/30 bg-[#00ff67]/10 px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-wide text-[#86efac]">Current View</p>
            <p className="mt-1 text-lg font-bold text-white">{selectedLabel}</p>
          </div>
        </div>
      </section>

      <section className="mb-6 grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="section-card p-4 sm:p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h3 className="text-xl font-bold text-slate-900">Filters</h3>
              <p className="mt-1 text-sm text-slate-500">Choose the time window, verification status, groups, or individual runners.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {DATE_WINDOWS.map((window) => (
                <button
                  key={window.label}
                  type="button"
                  onClick={() => setWindowDays(window.days)}
                  className={`rounded-lg border px-3 py-2 text-sm font-bold transition ${
                    windowDays === window.days
                      ? "border-[#00a7ff] bg-[#00a7ff]/20 text-[#7dd3fc]"
                      : "border-slate-700 bg-slate-900/40 text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  {window.label}
                </button>
              ))}
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/40 px-3 py-2 text-sm font-bold text-slate-300">
                <input
                  type="checkbox"
                  checked={verifiedOnly}
                  onChange={(event) => setVerifiedOnly(event.target.checked)}
                  className="h-4 w-4"
                />
              Verified only
              </label>
            </div>
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Groups</p>
              <div className="flex flex-wrap gap-2">
                {groups.map((group) => (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() => toggle(group.id, selectedGroupIds, setSelectedGroupIds)}
                    className={`rounded-full border px-3 py-1.5 text-sm font-bold transition ${
                      selectedGroupIds.includes(group.id)
                        ? "border-white text-white shadow-lg"
                        : "border-slate-700 bg-slate-900/40 text-slate-300"
                    }`}
                    style={selectedGroupIds.includes(group.id) ? { backgroundColor: group.color || "#00a7ff" } : undefined}
                  >
                    {group.name}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Individual Runners</p>
              <div className="grid max-h-36 gap-2 overflow-auto pr-2 sm:grid-cols-2">
                {runners.map((runner) => (
                  <label key={runner.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/40 px-3 py-2 text-sm text-slate-200">
                    <input
                      type="checkbox"
                      checked={selectedRunnerIds.includes(runner.id)}
                      onChange={() => toggle(runner.id, selectedRunnerIds, setSelectedRunnerIds)}
                      className="h-4 w-4"
                    />
                    <span>{runner.first_name} {runner.last_name}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setSelectedRunnerIds([]);
              setSelectedGroupIds([]);
            }}
            className="mt-5 rounded-lg border border-slate-700 bg-slate-900/40 px-4 py-2 text-sm font-bold text-slate-200 hover:bg-slate-800"
          >
            Reset to full roster
          </button>
        </div>

        <div className="section-card p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-xl font-bold text-slate-900">Selected Data</h3>
              <p className="mt-1 text-sm text-slate-500">Totals and exports match the current filters.</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <a
                href={activityExportHref}
                className="rounded-lg bg-[#008cff] px-3 py-2 text-center text-sm font-bold text-white shadow-sm shadow-[#008cff]/20 transition hover:bg-[#00a7ff]"
              >
                Activity CSV
              </a>
              <a
                href={runnerSummaryExportHref}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-center text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                Runner Summary
              </a>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-5">
            <Stat label={unitLabel} value={totals.miles.toFixed(1)} accent="#00a7ff" />
            <Stat label="Runs" value={totals.runs.toString()} accent="#00ff67" />
            <Stat label="Active" value={totals.activeRunners.toString()} accent="#f59e0b" />
            <Stat label="Needs Attention" value={attentionCount.toString()} accent="#ef4444" />
            <Stat label="Verified" value={`${Math.round(totals.verifiedRate * 100)}%`} accent="#14b8a6" />
          </div>
        </div>
      </section>

      <section className="mb-6 grid gap-6 lg:grid-cols-2">
        <ChartCard title="Daily Volume & Pace" description="Shows how much training was logged each day and whether average pace is moving.">
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={dailyTrend}>
              <CartesianGrid stroke="rgba(148,163,184,0.18)" />
              <XAxis dataKey="date" tick={{ fill: "var(--subtle)", fontSize: 12 }} />
              <YAxis yAxisId="left" tick={{ fill: "var(--subtle)", fontSize: 12 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fill: "var(--subtle)", fontSize: 12 }} />
              <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8 }} />
              <Legend />
              <Bar yAxisId="left" dataKey="miles" fill="#00a7ff" radius={[4, 4, 0, 0]} name={unitLabel} />
              <Line yAxisId="right" type="monotone" dataKey="avgPace" stroke="#00ff67" strokeWidth={3} name={`Avg pace min/${unitLabel}`} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Volume by Runner" description="Compares total training volume so outliers and missing data are easier to see.">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={athleteRows.slice(0, 12)}>
              <CartesianGrid stroke="rgba(148,163,184,0.18)" />
              <XAxis dataKey="name" tick={{ fill: "var(--subtle)", fontSize: 11 }} interval={0} angle={-28} textAnchor="end" height={80} />
              <YAxis tick={{ fill: "var(--subtle)", fontSize: 12 }} />
              <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8 }} />
              <Bar dataKey="miles" name={unitLabel} fill="#00a7ff" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </section>

      <section className="mb-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <ChartCard title="Group Coverage" description="Compares groups by roster size, logged runs, total distance, and average pace.">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-3 pr-4">Group</th>
                  <th className="py-3 pr-4">Runners</th>
                  <th className="py-3 pr-4">Runs</th>
                  <th className="py-3 pr-4">{unitLabel}</th>
                  <th className="py-3 pr-4">Avg Pace</th>
                </tr>
              </thead>
              <tbody>
                {groupRows.map((group) => (
                  <tr key={group.id} className="border-b border-slate-800 last:border-0">
                    <td className="py-3 pr-4 font-bold text-slate-100">
                      <span className="mr-2 inline-block h-3 w-3 rounded-full" style={{ backgroundColor: group.color }} />
                      {group.name}
                    </td>
                    <td className="py-3 pr-4 text-slate-300">{group.runners}</td>
                    <td className="py-3 pr-4 text-slate-300">{group.runs}</td>
                    <td className="py-3 pr-4 text-slate-300">{group.miles.toFixed(1)}</td>
                    <td className="py-3 pr-4 text-slate-300">{formatPace(group.avgPace)}/{unitLabel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>

        <ChartCard title="Submission Sources" description="Shows whether data is coming from screenshots, manual entries, or connected activity sources.">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={sourceMix} dataKey="value" nameKey="name" innerRadius={62} outerRadius={98} paddingAngle={3}>
                {sourceMix.map((entry, index) => (
                  <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8 }} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </section>

      <section className="section-card overflow-hidden p-4 sm:p-5">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-xl font-bold text-slate-900">Runner Attention Table</h3>
            <p className="mt-1 text-sm text-slate-500">Use this to find missing data, volume changes, and runners who may need a quick check-in.</p>
          </div>
          <p className="text-sm font-bold text-[#00a7ff]">{athleteRows.length} athletes</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr className="border-b border-slate-700 bg-slate-900/50 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Runner</th>
                <th className="px-4 py-3">Groups</th>
                <th className="px-4 py-3">Runs</th>
                <th className="px-4 py-3">{unitLabel}</th>
                <th className="px-4 py-3">Avg Pace</th>
                <th className="px-4 py-3">Best</th>
                <th className="px-4 py-3">Long Run</th>
                <th className="px-4 py-3">Load</th>
                <th className="px-4 py-3">Consistency</th>
                <th className="px-4 py-3">Attention</th>
              </tr>
            </thead>
            <tbody>
              {athleteRows.map((row) => (
                <tr key={row.id} className="border-b border-slate-800 last:border-0 hover:bg-slate-900/30">
                  <td className="px-4 py-3 font-bold text-slate-100">{row.name}</td>
                  <td className="px-4 py-3 text-slate-300">{row.groups.join(", ") || "Ungrouped"}</td>
                  <td className="px-4 py-3 text-slate-300">{row.runs}</td>
                  <td className="px-4 py-3 text-slate-300">{row.miles.toFixed(1)}</td>
                  <td className="px-4 py-3 text-slate-300">{formatPace(row.avgPace)}/{unitLabel}</td>
                  <td className="px-4 py-3 text-[#00ff67]">{formatPace(row.bestPace)}/{unitLabel}</td>
                  <td className="px-4 py-3 text-slate-300">{row.longRun.toFixed(1)} {unitLabel}</td>
                  <td className={`px-4 py-3 font-bold ${row.loadChange > 20 ? "text-orange-400" : row.loadChange < -20 ? "text-red-400" : "text-slate-300"}`}>
                    {row.loadChange > 0 ? "+" : ""}{row.loadChange.toFixed(0)}%
                  </td>
                  <td className="px-4 py-3 text-slate-300">{Math.round(row.consistency * 100)}%</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full border px-3 py-1 text-xs font-bold ${attentionClass(row.flag)}`}>
                      {row.flag}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/40 p-4" style={{ borderColor: `${accent}55` }}>
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold" style={{ color: accent }}>
        {value}
      </p>
    </div>
  );
}

function ChartCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="section-card p-4 sm:p-5">
      <div className="mb-4">
        <h3 className="text-xl font-bold text-slate-900">{title}</h3>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      {children}
    </div>
  );
}
