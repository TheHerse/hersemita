import type { CSSProperties } from "react";

export type LoadRecoveryRow = {
  runnerId: string;
  runnerName: string;
  acuteLoad: number | null;
  chronicLoad: number | null;
  acwrRatio: number | null;
  loadStatus: string | null;
  monotony: number | null;
  strain: number | null;
  latestRecoveryDate: string | null;
  hrvStatus: string | null;
  hrvMs: number | null;
  sleepScore: number | null;
  soreness: number | null;
  illness: boolean;
  alertCount: number;
  highestAlertSeverity: string | null;
};

function formatNumber(value: number | null, digits = 1) {
  if (value == null || !Number.isFinite(value)) return "--";
  return value.toFixed(digits);
}

function formatDate(value: string | null) {
  if (!value) return "No check-in";
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function loadTone(status: string | null, ratio: number | null) {
  if (status === "high_load" || (ratio != null && ratio > 1.5)) return { label: "High load", color: "#ef4444" };
  if (status === "elevated_load" || (ratio != null && ratio > 1.3)) return { label: "Elevated", color: "#f59e0b" };
  if (status === "detraining" || (ratio != null && ratio < 0.8)) return { label: "Detraining", color: "#7dd3fc" };
  if (ratio == null) return { label: "No load", color: "#94a3b8" };
  return { label: "Optimal", color: "#00ff67" };
}

function recoveryTone(row: LoadRecoveryRow) {
  if (row.illness || row.hrvStatus === "poor" || row.hrvStatus === "low") {
    return { label: row.illness ? "Illness" : "Recovery risk", color: "#ef4444" };
  }
  if (row.hrvStatus === "unbalanced" || (row.soreness != null && row.soreness >= 7)) {
    return { label: "Watch", color: "#f59e0b" };
  }
  if (!row.latestRecoveryDate) return { label: "Missing", color: "#94a3b8" };
  return { label: "Logged", color: "#00ff67" };
}

function combinedRiskTone(row: LoadRecoveryRow) {
  const severeAlert = row.highestAlertSeverity === "critical" || row.highestAlertSeverity === "high";
  const recoveryRisk = row.illness || row.hrvStatus === "poor" || row.hrvStatus === "low" || (row.soreness != null && row.soreness >= 8);
  const highTrainingStress = (row.acwrRatio != null && row.acwrRatio >= 1.3) || (row.strain != null && row.strain >= 900);

  if (severeAlert || (recoveryRisk && highTrainingStress)) {
    return { label: "Review today", color: "#ef4444" };
  }
  if (recoveryRisk || highTrainingStress || row.hrvStatus === "unbalanced") {
    return { label: "Watch", color: "#f59e0b" };
  }
  if (!row.latestRecoveryDate && row.acwrRatio != null) {
    return { label: "Need check-in", color: "#7dd3fc" };
  }
  return { label: "Clear", color: "#00ff67" };
}

export default function TrainingLoadRecoveryPanel({ rows }: { rows: LoadRecoveryRow[] }) {
  const sortedRows = [...rows].sort((a, b) => {
    const aCombined = combinedRiskTone(a).label === "Review today" ? 200 : combinedRiskTone(a).label === "Watch" ? 100 : 0;
    const bCombined = combinedRiskTone(b).label === "Review today" ? 200 : combinedRiskTone(b).label === "Watch" ? 100 : 0;
    const aRisk = aCombined + (a.alertCount > 0 ? 100 : 0) + (a.acwrRatio || 0) * 10 + (a.illness ? 50 : 0);
    const bRisk = bCombined + (b.alertCount > 0 ? 100 : 0) + (b.acwrRatio || 0) * 10 + (b.illness ? 50 : 0);
    return bRisk - aRisk;
  });

  const reviewTodayCount = rows.filter((row) => combinedRiskTone(row).label === "Review today").length;
  const recoveryWatchCount = rows.filter((row) => {
    return row.illness || row.hrvStatus === "low" || row.hrvStatus === "poor" || row.hrvStatus === "unbalanced";
  }).length;
  const openAlerts = rows.reduce((sum, row) => sum + row.alertCount, 0);

  return (
    <section className="section-card overflow-hidden p-4 sm:p-6">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="section-icon" style={{ "--icon-color": "#f59e0b" } as CSSProperties}>
            <svg className="h-4 w-4 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <h3 className="text-xl font-semibold text-slate-900">Training Load & Recovery</h3>
            <p className="text-sm text-slate-500">ACWR, latest morning check-in, and active coach alerts.</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center sm:min-w-[360px]">
          <MiniStat label="Review" value={String(reviewTodayCount)} color="#ef4444" />
          <MiniStat label="Recovery" value={String(recoveryWatchCount)} color="#ef4444" />
          <MiniStat label="Alerts" value={String(openAlerts)} color="#00a7ff" />
        </div>
      </div>

      <div className="space-y-3 md:hidden">
        {sortedRows.map((row) => {
          const load = loadTone(row.loadStatus, row.acwrRatio);
          const recovery = recoveryTone(row);
          const risk = combinedRiskTone(row);
          return (
            <article key={row.runnerId} className="rounded-xl border border-slate-700 bg-slate-900/40 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="font-bold text-white">{row.runnerName}</h4>
                  <p className="mt-1 text-sm text-slate-400">{formatDate(row.latestRecoveryDate)}</p>
                </div>
                <StatusPill label={risk.label} color={risk.color} />
              </div>
              <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
                <CompactStat label="ACWR" value={formatNumber(row.acwrRatio, 2)} />
                <CompactStat label="HRV" value={row.hrvMs == null ? "--" : `${formatNumber(row.hrvMs, 0)} ms`} />
                <CompactStat label="Sleep" value={row.sleepScore == null ? "--" : String(row.sleepScore)} />
              </dl>
              <div className="mt-4 flex flex-wrap gap-2">
                <StatusPill label={recovery.label} color={recovery.color} />
                <StatusPill label={load.label} color={load.color} />
                {row.alertCount > 0 && <StatusPill label={`${row.alertCount} alert${row.alertCount === 1 ? "" : "s"}`} color="#00a7ff" />}
              </div>
            </article>
          );
        })}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[980px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/60">
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Runner</th>
              <th className="px-4 py-3 text-center font-semibold text-slate-700">ACWR</th>
              <th className="px-4 py-3 text-center font-semibold text-slate-700">Risk</th>
              <th className="px-4 py-3 text-center font-semibold text-slate-700">Load</th>
              <th className="px-4 py-3 text-center font-semibold text-slate-700">Acute</th>
              <th className="px-4 py-3 text-center font-semibold text-slate-700">Chronic</th>
              <th className="px-4 py-3 text-center font-semibold text-slate-700">Recovery</th>
              <th className="px-4 py-3 text-center font-semibold text-slate-700">HRV</th>
              <th className="px-4 py-3 text-center font-semibold text-slate-700">Sleep</th>
              <th className="px-4 py-3 text-center font-semibold text-slate-700">Alerts</th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row) => {
              const load = loadTone(row.loadStatus, row.acwrRatio);
              const recovery = recoveryTone(row);
              const risk = combinedRiskTone(row);
              return (
                <tr key={row.runnerId} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{row.runnerName}</div>
                    <div className="mt-1 text-xs text-slate-500">{formatDate(row.latestRecoveryDate)}</div>
                  </td>
                  <td className="px-4 py-3 text-center font-bold text-slate-900">{formatNumber(row.acwrRatio, 2)}</td>
                  <td className="px-4 py-3 text-center"><StatusPill label={risk.label} color={risk.color} /></td>
                  <td className="px-4 py-3 text-center"><StatusPill label={load.label} color={load.color} /></td>
                  <td className="px-4 py-3 text-center text-slate-700">{formatNumber(row.acuteLoad)}</td>
                  <td className="px-4 py-3 text-center text-slate-700">{formatNumber(row.chronicLoad)}</td>
                  <td className="px-4 py-3 text-center"><StatusPill label={recovery.label} color={recovery.color} /></td>
                  <td className="px-4 py-3 text-center text-slate-700">
                    {row.hrvMs == null ? "--" : `${formatNumber(row.hrvMs, 0)} ms`}
                    {row.hrvStatus && <div className="mt-1 text-xs text-slate-500">{row.hrvStatus}</div>}
                  </td>
                  <td className="px-4 py-3 text-center text-slate-700">{row.sleepScore ?? "--"}</td>
                  <td className="px-4 py-3 text-center">
                    {row.alertCount > 0 ? (
                      <StatusPill label={`${row.alertCount} ${row.highestAlertSeverity || "open"}`} color="#00a7ff" />
                    ) : (
                      <span className="text-slate-500">None</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2" style={{ borderColor: `${color}55` }}>
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold" style={{ color }}>{value}</p>
    </div>
  );
}

function StatusPill({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="inline-flex items-center justify-center rounded-full border px-2.5 py-1 text-xs font-bold"
      style={{ borderColor: `${color}55`, backgroundColor: `${color}18`, color }}
    >
      {label}
    </span>
  );
}

function CompactStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-slate-400">{label}</dt>
      <dd className="mt-1 font-bold text-white">{value}</dd>
    </div>
  );
}
