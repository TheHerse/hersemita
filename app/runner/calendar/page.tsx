"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import RunnerPortalHeader from "@/components/RunnerPortalHeader";

type Runner = {
  id: string;
  name: string;
  grade: number | null;
  schoolName: string;
  coachName: string;
};

type Assignment = {
  id: string;
  date: string;
  targetType: string;
  template: {
    title: string;
    kind: string;
    miles: string | null;
    pace: string | null;
    warmup: string | null;
    main_set: string | null;
    cooldown: string | null;
    strength: string | null;
    location: string | null;
    notes: string | null;
  } | null;
};

type CalendarResponse = {
  runner: Runner;
  assignments: Assignment[];
  setupRequired: boolean;
  error?: string;
};

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export default function RunnerCalendarPage() {
  const router = useRouter();
  const [data, setData] = useState<CalendarResponse | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadCalendar() {
      const response = await fetch("/api/runner-calendar");
      const result = await response.json().catch(() => null) as CalendarResponse | null;

      if (!active) return;
      if (response.status === 401) {
        router.push("/runner/login");
        return;
      }
      if (!response.ok || !result?.runner) {
        setError(result?.error || "Could not load calendar.");
        return;
      }

      setData(result);
    }

    loadCalendar();
    return () => {
      active = false;
    };
  }, [router]);

  const groupedAssignments = useMemo(() => {
    const groups = new Map<string, Assignment[]>();
    (data?.assignments || []).forEach((assignment) => {
      const list = groups.get(assignment.date) || [];
      list.push(assignment);
      groups.set(assignment.date, list);
    });
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [data?.assignments]);

  if (!data && !error) {
    return <div className="flex min-h-screen items-center justify-center hersemita-page-bg text-white">Loading...</div>;
  }

  const runner = data?.runner || {
    id: "",
    name: "Runner",
    grade: null,
    schoolName: "Your school",
    coachName: "Coach",
  };

  return (
    <div className="min-h-screen hersemita-page-bg">
      <RunnerPortalHeader active="calendar" runnerName={runner.name} schoolName={runner.schoolName} coachName={runner.coachName} />

      <main className="mx-auto max-w-5xl p-4 sm:p-6">
        <section className="mb-6 rounded-2xl border border-white/10 bg-white/10 p-5 text-white shadow-2xl shadow-black/10 backdrop-blur">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#00a7ff]">Workout Calendar</p>
          <h2 className="mt-2 text-3xl font-bold">{runner.name}</h2>
          <p className="mt-2 text-[#cbd5e1]">
            {runner.schoolName} | Coach {runner.coachName}
          </p>
        </section>

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
        ) : data?.setupRequired ? (
          <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-800">
            Calendar tables are not ready yet. Run `supabase/runner-portal-calendar.sql` in Supabase, then refresh this page.
          </div>
        ) : groupedAssignments.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <h3 className="text-xl font-bold text-slate-900">No workouts assigned yet</h3>
            <p className="mt-2 text-sm text-slate-500">Your coach has not published calendar items for you yet.</p>
          </div>
        ) : (
          <section className="space-y-4">
            {groupedAssignments.map(([date, assignments]) => (
              <div key={date} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-lg font-bold text-slate-900">{formatDate(date)}</h3>
                <div className="mt-4 space-y-3">
                  {assignments.map((assignment) => (
                    <article key={assignment.id} className="rounded-xl border border-slate-200 p-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wide text-[#00a7ff]">{assignment.template?.kind || "Workout"}</p>
                          <h4 className="mt-1 text-xl font-bold text-slate-900">{assignment.template?.title || "Workout"}</h4>
                          <p className="mt-1 text-sm text-slate-500">
                            {assignment.template?.miles || "--"} mi | {assignment.template?.pace || "Pace open"} | {assignment.template?.location || "Location TBD"}
                          </p>
                        </div>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase text-slate-600">
                          {assignment.targetType}
                        </span>
                      </div>
                      {assignment.template?.main_set && <p className="mt-3 text-sm text-slate-700">{assignment.template.main_set}</p>}
                      {(assignment.template?.warmup || assignment.template?.cooldown || assignment.template?.strength) && (
                        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                          <div>
                            <dt className="font-bold text-slate-900">Warmup</dt>
                            <dd className="mt-1 text-slate-600">{assignment.template.warmup || "--"}</dd>
                          </div>
                          <div>
                            <dt className="font-bold text-slate-900">Cooldown</dt>
                            <dd className="mt-1 text-slate-600">{assignment.template.cooldown || "--"}</dd>
                          </div>
                          <div>
                            <dt className="font-bold text-slate-900">Strength</dt>
                            <dd className="mt-1 text-slate-600">{assignment.template.strength || "--"}</dd>
                          </div>
                        </dl>
                      )}
                      {assignment.template?.notes && <p className="mt-3 text-sm text-slate-500">{assignment.template.notes}</p>}
                    </article>
                  ))}
                </div>
              </div>
            ))}
          </section>
        )}
      </main>
    </div>
  );
}
