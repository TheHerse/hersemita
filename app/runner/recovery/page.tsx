"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import RunnerPortalHeader from "@/components/RunnerPortalHeader";
import { displayTrainingNote } from "@/lib/display-text";

type Runner = {
  id: string;
  name: string;
  grade: number | null;
  schoolName: string;
  coachName: string;
};

type RecoveryLog = {
  id: string;
  log_date: string;
  hrv_ms: number | null;
  hrv_status: string | null;
  resting_hr: number | null;
  sleep_score: number | null;
  sleep_duration_min: number | null;
  body_battery: number | null;
  soreness: number | null;
  illness: boolean | null;
  notes: string | null;
};

type SessionResponse = {
  runner?: Runner;
  error?: string;
};

type RecoveryResponse = {
  today: string;
  logs: RecoveryLog[];
  error?: string;
};

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatSleep(minutes: number | null) {
  if (minutes == null) return "--";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins.toString().padStart(2, "0")}m`;
}

export default function RunnerRecoveryPage() {
  const router = useRouter();
  const [runner, setRunner] = useState<Runner | null>(null);
  const [logs, setLogs] = useState<RecoveryLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [formData, setFormData] = useState({
    logDate: new Date().toISOString().slice(0, 10),
    hrvMs: "",
    hrvStatus: "",
    restingHr: "",
    sleepScore: "",
    sleepHours: "",
    sleepMinutes: "",
    bodyBattery: "",
    soreness: "",
    illness: false,
    notes: "",
  });

  const loadData = useCallback(async () => {
    const [sessionResponse, recoveryResponse] = await Promise.all([
      fetch("/api/runner-session"),
      fetch("/api/runner-recovery"),
    ]);

    const sessionResult = (await sessionResponse.json().catch(() => null)) as SessionResponse | null;
    const recoveryResult = (await recoveryResponse.json().catch(() => null)) as RecoveryResponse | null;

    if (sessionResponse.status === 401 || recoveryResponse.status === 401) {
      router.push("/runner/login");
      return;
    }

    if (!sessionResponse.ok || !sessionResult?.runner) {
      throw new Error(sessionResult?.error || "Could not load runner.");
    }
    if (!recoveryResponse.ok || !recoveryResult) {
      throw new Error(recoveryResult?.error || "Could not load recovery logs.");
    }

    setRunner(sessionResult.runner);
    setLogs(recoveryResult.logs || []);
    setFormData((current) => ({ ...current, logDate: recoveryResult.today || current.logDate }));
  }, [router]);

  useEffect(() => {
    let active = true;

    loadData()
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Could not load recovery check-in.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [loadData]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setSaved(false);
    setError("");

    const sleepHours = Number(formData.sleepHours || 0);
    const sleepMinutes = Number(formData.sleepMinutes || 0);
    const sleepDurationMin = formData.sleepHours || formData.sleepMinutes ? sleepHours * 60 + sleepMinutes : "";

    try {
      const response = await fetch("/api/runner-recovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          logDate: formData.logDate,
          hrvMs: formData.hrvMs,
          hrvStatus: formData.hrvStatus,
          restingHr: formData.restingHr,
          sleepScore: formData.sleepScore,
          sleepDurationMin,
          bodyBattery: formData.bodyBattery,
          soreness: formData.soreness,
          illness: formData.illness,
          notes: formData.notes,
        }),
      });

      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(result?.error || "Check-in failed.");
      }

      setSaved(true);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Check-in failed.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center hersemita-page-bg text-white">Loading...</div>;
  }

  const activeRunner = runner || {
    id: "",
    name: "Runner",
    grade: null,
    schoolName: "Your school",
    coachName: "Coach",
  };

  return (
    <div className="min-h-screen hersemita-page-bg">
      <RunnerPortalHeader active="recovery" runnerName={activeRunner.name} schoolName={activeRunner.schoolName} coachName={activeRunner.coachName} />

      <main className="mx-auto max-w-5xl p-4 sm:p-6">
        <section className="mb-6 rounded-2xl border border-white/10 bg-white/10 p-5 text-white shadow-2xl shadow-black/10 backdrop-blur">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#00a7ff]">Morning Check-In</p>
          <h2 className="mt-2 text-3xl font-bold">{activeRunner.name}</h2>
          <p className="mt-2 text-[#cbd5e1]">
            Recovery, sleep, soreness, and HRV for Coach {activeRunner.coachName}
          </p>
        </section>

        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Today&apos;s Recovery</h3>
                <p className="mt-1 text-sm text-slate-500">You can update the same day more than once.</p>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700">Date</label>
                <input
                  type="date"
                  value={formData.logDate}
                  onChange={(event) => setFormData({ ...formData, logDate: event.target.value })}
                  className="mt-1 w-full rounded-lg border px-3 py-2 sm:w-40"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="HRV (ms)">
                <input type="number" min="0" step="0.1" value={formData.hrvMs} onChange={(event) => setFormData({ ...formData, hrvMs: event.target.value })} className="w-full rounded-lg border px-3 py-2" placeholder="Optional" />
              </Field>
              <Field label="HRV Status">
                <select value={formData.hrvStatus} onChange={(event) => setFormData({ ...formData, hrvStatus: event.target.value })} className="w-full rounded-lg border px-3 py-2">
                  <option value="">Not sure</option>
                  <option value="balanced">Balanced</option>
                  <option value="unbalanced">Unbalanced</option>
                  <option value="low">Low</option>
                  <option value="poor">Poor</option>
                </select>
              </Field>
              <Field label="Resting HR">
                <input type="number" min="20" max="240" value={formData.restingHr} onChange={(event) => setFormData({ ...formData, restingHr: event.target.value })} className="w-full rounded-lg border px-3 py-2" placeholder="Optional" />
              </Field>
              <Field label="Body Battery">
                <input type="number" min="0" max="100" value={formData.bodyBattery} onChange={(event) => setFormData({ ...formData, bodyBattery: event.target.value })} className="w-full rounded-lg border px-3 py-2" placeholder="0-100" />
              </Field>
              <Field label="Sleep Score">
                <input type="number" min="0" max="100" value={formData.sleepScore} onChange={(event) => setFormData({ ...formData, sleepScore: event.target.value })} className="w-full rounded-lg border px-3 py-2" placeholder="0-100" />
              </Field>
              <Field label="Sleep Duration">
                <div className="grid grid-cols-2 gap-2">
                  <input type="number" min="0" max="24" value={formData.sleepHours} onChange={(event) => setFormData({ ...formData, sleepHours: event.target.value })} className="w-full rounded-lg border px-3 py-2" placeholder="Hours" />
                  <input type="number" min="0" max="59" value={formData.sleepMinutes} onChange={(event) => setFormData({ ...formData, sleepMinutes: event.target.value })} className="w-full rounded-lg border px-3 py-2" placeholder="Min" />
                </div>
              </Field>
              <Field label="Soreness">
                <input type="number" min="1" max="10" value={formData.soreness} onChange={(event) => setFormData({ ...formData, soreness: event.target.value })} className="w-full rounded-lg border px-3 py-2" placeholder="1-10" />
              </Field>
              <label className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700">
                <input type="checkbox" checked={formData.illness} onChange={(event) => setFormData({ ...formData, illness: event.target.checked })} className="h-4 w-4" />
                Sick today
              </label>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-bold text-slate-700">Notes</label>
              <textarea value={formData.notes} onChange={(event) => setFormData({ ...formData, notes: event.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2" rows={4} placeholder="Anything your coach should know?" />
            </div>

            {error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
            {saved && <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-3 text-sm font-semibold text-green-700">Recovery check-in saved.</div>}

            <button type="submit" disabled={saving} className="primary-action mt-5 w-full px-4 py-3 disabled:opacity-60">
              {saving ? "Saving..." : "Save Check-In"}
            </button>
          </form>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h3 className="text-xl font-bold text-slate-900">Recent Check-Ins</h3>
            <p className="mt-1 text-sm text-slate-500">Your coach sees these alongside training load.</p>

            {logs.length === 0 ? (
              <div className="mt-5 rounded-xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">
                No recovery logs yet.
              </div>
            ) : (
              <div className="mt-5 space-y-3">
                {logs.map((log) => (
                  <article key={log.id} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-bold text-slate-900">{formatDate(log.log_date)}</p>
                        <p className="mt-1 text-sm text-slate-500">
                          HRV {log.hrv_ms ?? "--"} ms | {log.hrv_status || "No status"}
                        </p>
                      </div>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase text-slate-600">
                        {log.illness ? "Sick" : "Logged"}
                      </span>
                    </div>
                    <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
                      <Stat label="Sleep" value={formatSleep(log.sleep_duration_min)} />
                      <Stat label="Score" value={log.sleep_score == null ? "--" : String(log.sleep_score)} />
                      <Stat label="Sore" value={log.soreness == null ? "--" : String(log.soreness)} />
                    </dl>
                    {log.notes && <p className="mt-3 text-sm text-slate-600">{displayTrainingNote(log.notes)}</p>}
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-bold text-slate-700">{label}</span>
      <span className="mt-1 block">{children}</span>
    </label>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 font-bold text-slate-900">{value}</dd>
    </div>
  );
}
