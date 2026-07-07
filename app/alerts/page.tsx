import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { CSSProperties } from "react";
import CoachHeader from "@/components/CoachHeader";
import { createServerSupabaseClient } from "@/lib/supabase-server";

type AlertRecord = {
  id: string;
  runner_id: string;
  alert_type: string;
  message: string | null;
  severity: string;
  dismissed: boolean | null;
  created_at: string | null;
  runners: {
    first_name: string;
    last_name: string;
  } | null;
};

type AlertQueryRecord = Omit<AlertRecord, "runners"> & {
  runners:
    | {
        first_name: string;
        last_name: string;
      }
    | {
        first_name: string;
        last_name: string;
      }[]
    | null;
};

async function getCoachId(userId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: coach } = await supabase
    .from("coaches")
    .select("id")
    .eq("clerk_id", userId)
    .single();

  return coach?.id as string | undefined;
}

async function dismissAlert(alertId: string) {
  "use server";

  const { userId } = await auth();
  if (!userId) redirect("/");
  const supabase = await createServerSupabaseClient();
  const coachId = await getCoachId(userId);
  if (!coachId) redirect("/alerts");

  const { error } = await supabase
    .from("coach_alerts")
    .update({ dismissed: true })
    .eq("id", alertId)
    .eq("coach_id", coachId);

  if (error) throw new Error(error.message);

  redirect("/alerts");
}

async function dismissAllAlerts() {
  "use server";

  const { userId } = await auth();
  if (!userId) redirect("/");
  const supabase = await createServerSupabaseClient();
  const coachId = await getCoachId(userId);
  if (!coachId) redirect("/alerts");

  const { error } = await supabase
    .from("coach_alerts")
    .update({ dismissed: true })
    .eq("coach_id", coachId)
    .eq("dismissed", false);

  if (error) throw new Error(error.message);

  redirect("/alerts");
}

function formatDate(value: string | null) {
  if (!value) return "--";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function alertTitle(type: string) {
  return type.replaceAll("_", " ");
}

function severityColor(severity: string) {
  if (severity === "critical") return "#ef4444";
  if (severity === "high") return "#f59e0b";
  return "#00a7ff";
}

export default async function AlertsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/");

  const supabase = await createServerSupabaseClient();
  const coachId = await getCoachId(userId);
  if (!coachId) redirect("/dashboard");

  const { data: alerts } = await supabase
    .from("coach_alerts")
    .select("id, runner_id, alert_type, message, severity, dismissed, created_at, runners(first_name, last_name)")
    .eq("coach_id", coachId)
    .order("dismissed", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(100);

  const safeAlerts = ((alerts || []) as AlertQueryRecord[]).map((alert) => ({
    ...alert,
    runners: Array.isArray(alert.runners) ? alert.runners[0] || null : alert.runners,
  }));
  const openAlerts = safeAlerts.filter((alert) => !alert.dismissed);
  const criticalCount = openAlerts.filter((alert) => alert.severity === "critical").length;
  const highCount = openAlerts.filter((alert) => alert.severity === "high").length;

  return (
    <div className="min-h-screen hersemita-page-bg text-white">
      <CoachHeader active="alerts" />

      <main className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
        <section className="mb-6 rounded-2xl border border-white/10 bg-white/10 p-5 shadow-2xl shadow-black/10 backdrop-blur sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#00a7ff]">Coach Alert Center</p>
              <h2 className="mt-2 text-3xl font-bold text-white sm:text-4xl">Alerts</h2>
              <p className="mt-2 max-w-2xl text-[#cbd5e1]">
                Recovery risk, missed workouts, load spikes, and athlete notes that deserve coach attention.
              </p>
            </div>
            {openAlerts.length > 0 && (
              <form action={dismissAllAlerts}>
                <button type="submit" className="rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/15">
                  Dismiss All Open
                </button>
              </form>
            )}
          </div>
        </section>

        <section className="mb-6 grid gap-4 sm:grid-cols-3">
          <Metric label="Open" value={String(openAlerts.length)} color="#00a7ff" />
          <Metric label="Critical" value={String(criticalCount)} color="#ef4444" />
          <Metric label="High" value={String(highCount)} color="#f59e0b" />
        </section>

        <section className="section-card p-4 sm:p-6">
          {safeAlerts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
              No alerts yet.
            </div>
          ) : (
            <div className="space-y-3">
              {safeAlerts.map((alert) => {
                const runnerName = alert.runners ? `${alert.runners.first_name} ${alert.runners.last_name}` : "Runner";
                return (
                  <article key={alert.id} className={`rounded-xl border p-4 ${alert.dismissed ? "border-slate-200 bg-slate-50/40 opacity-70" : "border-slate-200 bg-slate-50/80"}`}>
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusPill label={alert.severity} color={severityColor(alert.severity)} />
                          <StatusPill label={alertTitle(alert.alert_type)} color="#00a7ff" />
                          {alert.dismissed && <StatusPill label="dismissed" color="#94a3b8" />}
                        </div>
                        <h3 className="mt-3 text-lg font-bold text-slate-900">{runnerName}</h3>
                        <p className="mt-1 text-sm text-slate-600">{alert.message || "Coach alert"}</p>
                        <p className="mt-2 text-xs font-semibold text-slate-500">{formatDate(alert.created_at)}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Link href={`/runners/${alert.runner_id}`} className="rounded-lg border border-[#00a7ff]/40 bg-[#00a7ff]/10 px-4 py-2 text-sm font-bold text-[#007ab8] transition hover:bg-[#00a7ff]/20">
                          View Runner
                        </Link>
                        {!alert.dismissed && (
                          <form action={dismissAlert.bind(null, alert.id)}>
                            <button type="submit" className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100">
                              Dismiss
                            </button>
                          </form>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function Metric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="metric-card p-5" style={{ "--metric-color": color } as CSSProperties}>
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold" style={{ color }}>{value}</p>
    </div>
  );
}

function StatusPill({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="inline-flex rounded-full border px-2.5 py-1 text-xs font-bold capitalize"
      style={{ borderColor: `${color}55`, backgroundColor: `${color}18`, color }}
    >
      {label}
    </span>
  );
}
