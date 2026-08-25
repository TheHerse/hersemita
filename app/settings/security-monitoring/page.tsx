import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { logAuditEvent } from "@/lib/audit-log";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentTeamContext } from "@/lib/team-context";

async function updateAlert(alertId: string, formData: FormData) {
  "use server";
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const context = await getCurrentTeamContext(userId);
  if (!context || context.role !== "head_coach") redirect("/settings");
  const status = String(formData.get("status") || "");
  if (!new Set(["acknowledged", "resolved"]).has(status)) redirect("/settings/security-monitoring");
  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin.from("security_alerts").update({
    status,
    acknowledged_at: now,
    resolved_at: status === "resolved" ? now : null,
  }).eq("id", alertId).eq("team_id", context.team.id).select("id").maybeSingle();
  if (error || !data?.id) redirect("/settings/security-monitoring?error=Alert%20could%20not%20be%20updated.");
  await logAuditEvent({ teamId: context.team.id, actorCoachId: context.coach.id, actorClerkId: userId, action: `security.alert_${status}`, entityType: "security_alert", entityId: alertId });
  redirect("/settings/security-monitoring?saved=1");
}

export default async function SecurityMonitoringPage({ searchParams }: { searchParams?: Promise<{ saved?: string; error?: string }> }) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const context = await getCurrentTeamContext(userId);
  if (!context || context.role !== "head_coach") redirect("/settings");
  const query = await searchParams;
  const [{ data: alerts, error }, { data: events }] = await Promise.all([
    supabaseAdmin.from("security_alerts").select("id, alert_type, severity, title, event_count, status, window_started_at, created_at").eq("team_id", context.team.id).order("created_at", { ascending: false }).limit(100),
    supabaseAdmin.from("security_events").select("event_type, severity, outcome, route, created_at").eq("team_id", context.team.id).order("created_at", { ascending: false }).limit(200),
  ]);
  const counts = new Map<string, number>();
  for (const event of events || []) counts.set(event.event_type, (counts.get(event.event_type) || 0) + 1);
  return <main className="mx-auto min-h-screen max-w-5xl space-y-6 bg-slate-950 p-4 text-white sm:p-8">
    <div><Link href="/settings" className="text-sm font-bold text-sky-300">Back to settings</Link><h1 className="mt-3 text-3xl font-black">Security monitoring</h1><p className="mt-2 text-slate-300">Metadata-only events; no passcodes, messages, wellness entries, or uploaded content are recorded here.</p></div>
    {(error || query?.error) && <p className="rounded-xl border border-red-400/30 bg-red-500/10 p-4">{query?.error || "Security monitoring migration is not ready."}</p>}
    {query?.saved && <p className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-4">Alert updated and audited.</p>}
    <section className="rounded-xl border border-white/10 bg-white/5 p-5"><h2 className="font-black">Most recent 200 events</h2><div className="mt-3 flex flex-wrap gap-2">{Array.from(counts).length ? Array.from(counts).map(([type, count]) => <span key={type} className="rounded-full bg-slate-900 px-3 py-2 text-sm">{type}: {count}</span>) : <span className="text-slate-400">No team security events.</span>}</div></section>
    <section className="space-y-3"><h2 className="text-xl font-black">Alerts</h2>{(alerts || []).length === 0 ? <p className="text-slate-400">No alerts.</p> : (alerts || []).map((alert) => <article key={alert.id} className="rounded-xl border border-white/10 bg-white/5 p-4"><div className="flex flex-wrap justify-between gap-3"><div><p className="font-black">{alert.title}</p><p className="text-sm text-slate-300">{alert.severity} · {alert.event_count} events · {alert.status}</p></div>{alert.status !== "resolved" && <form action={updateAlert.bind(null, alert.id)} className="flex gap-2"><button name="status" value="acknowledged" className="rounded-lg border border-sky-400/40 px-3 py-2 text-sm font-bold">Acknowledge</button><button name="status" value="resolved" className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-bold">Resolve</button></form>}</div></article>)}</section>
  </main>;
}
