"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import RunnerPortalHeader from "@/components/RunnerPortalHeader";
import { distanceUnitLabel, normalizeDistanceUnit, type DistanceUnit } from "@/lib/distance-units";

type Runner = {
  id: string;
  name: string;
  grade: number | null;
  schoolName: string;
  coachName: string;
  preferredDistanceUnit?: DistanceUnit;
};

type Activity = {
  id: string;
  distanceMiles: number;
  distance?: number;
  pace: string;
  durationSeconds: number;
  startTime: string;
  verified: boolean;
  detectedApp: string | null;
  notes: string | null;
};

type AnalyticsResponse = {
  runner: Runner;
  summary: {
    totalRuns: number;
    totalMiles: number;
    weekMiles: number;
    totalDistance?: number;
    weekDistance?: number;
    verifiedCount: number;
    fastestPace: string;
  };
  activities: Activity[];
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDuration(seconds: number) {
  if (!seconds) return "--";
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
}

export default function RunnerDashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadAnalytics() {
      const response = await fetch("/api/runner-analytics", { cache: "no-store" });
      const result = await response.json().catch(() => null) as AnalyticsResponse & { error?: string } | null;

      if (!active) return;
      if (response.status === 401) {
        router.push("/runner/login");
        return;
      }
      if (!response.ok || !result?.runner) {
        setError(result?.error || "Could not load analytics.");
        return;
      }

      setData(result);
    }

    loadAnalytics();
    return () => {
      active = false;
    };
  }, [router]);

  if (!data && !error) {
    return <div className="flex min-h-screen items-center justify-center hersemita-page-bg text-white">Loading...</div>;
  }

  const runner = data?.runner || {
    id: "",
    name: "Runner",
    grade: null,
    schoolName: "Your school",
    coachName: "Coach",
    preferredDistanceUnit: "miles" as DistanceUnit,
  };
  const preferredDistanceUnit = normalizeDistanceUnit(runner.preferredDistanceUnit);
  const unitLabel = distanceUnitLabel(preferredDistanceUnit);
  const totalDistance = data?.summary.totalDistance ?? data?.summary.totalMiles ?? 0;
  const weekDistance = data?.summary.weekDistance ?? data?.summary.weekMiles ?? 0;

  return (
    <div className="min-h-screen hersemita-page-bg">
      <RunnerPortalHeader active="dashboard" runnerName={runner.name} schoolName={runner.schoolName} coachName={runner.coachName} />

      <main className="mx-auto max-w-5xl p-4 sm:p-6">
        <section className="mb-6 rounded-2xl border border-white/10 bg-white/10 p-5 text-white shadow-2xl shadow-black/10 backdrop-blur">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#00a7ff]">Runner Analytics</p>
          <h2 className="mt-2 text-3xl font-bold">{runner.name}</h2>
          <p className="mt-2 text-[#cbd5e1]">
            {runner.schoolName} | Coach {runner.coachName}
          </p>
        </section>

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
        ) : data ? (
          <>
            <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Total Runs" value={String(data.summary.totalRuns)} accent="#00a7ff" />
              <StatCard label={`Total ${unitLabel}`} value={totalDistance.toFixed(1)} accent="#00ff67" />
              <StatCard label="Last 7 Days" value={`${weekDistance.toFixed(1)} ${unitLabel}`} accent="#f59e0b" />
              <StatCard label="Best Pace" value={data.summary.fastestPace} accent="#14b8a6" />
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-end justify-between gap-4">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Recent Runs</h3>
                  <p className="mt-1 text-sm text-slate-500">{data.summary.verifiedCount} verified by coach</p>
                </div>
              </div>

              {data.activities.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                  No uploads yet. Use the Upload tab after your next run.
                </div>
              ) : (
                <div className="space-y-3">
                  {data.activities.map((activity) => (
                    <article key={activity.id} className="rounded-xl border border-slate-200 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-bold text-slate-900">{formatDate(activity.startTime)}</p>
                          <p className="mt-1 text-sm text-slate-500">
                            {activity.detectedApp || "Manual upload"} | {activity.verified ? "Verified" : "Waiting for coach review"}
                          </p>
                        </div>
                        <dl className="grid grid-cols-3 gap-3 text-center text-sm sm:min-w-[320px]">
                          <div>
                            <dt className="text-slate-500">{unitLabel}</dt>
                            <dd className="font-bold text-[#008cff]">{(activity.distance ?? activity.distanceMiles).toFixed(2)}</dd>
                          </div>
                          <div>
                            <dt className="text-slate-500">Pace</dt>
                            <dd className="font-bold text-[#059669]">{activity.pace}</dd>
                          </div>
                          <div>
                            <dt className="text-slate-500">Time</dt>
                            <dd className="font-bold text-[#d97706]">{formatDuration(activity.durationSeconds)}</dd>
                          </div>
                        </dl>
                      </div>
                      {activity.notes && <p className="mt-3 text-sm text-slate-600">{activity.notes}</p>}
                    </article>
                  ))}
                </div>
              )}
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm" style={{ borderColor: `${accent}55` }}>
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold" style={{ color: accent }}>{value}</p>
    </div>
  );
}
