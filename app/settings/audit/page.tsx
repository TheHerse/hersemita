import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import CoachHeader from "@/components/CoachHeader";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentTeamContext } from "@/lib/team-context";

type AuditLog = {
  id: string;
  team_id: string | null;
  actor_coach_id: string | null;
  actor_clerk_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

function formatAction(value: string) {
  return value.replaceAll("_", " ").replaceAll(".", " / ");
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function metadataSummary(metadata: Record<string, unknown>) {
  const entries = Object.entries(metadata || {});
  if (entries.length === 0) return "No extra details";

  return entries
    .slice(0, 5)
    .map(([key, value]) => `${key}: ${typeof value === "object" ? JSON.stringify(value) : String(value)}`)
    .join(" / ");
}

export default async function AuditLogPage() {
  const { userId } = await auth();
  if (!userId) redirect("/");

  const context = await getCurrentTeamContext(userId);
  if (!context) redirect("/settings");
  if (context.role !== "head_coach") redirect("/settings?teamError=Only%20head%20coaches%20can%20view%20audit%20logs.");

  const { data: logs } = await supabaseAdmin
    .from("audit_logs")
    .select("id, team_id, actor_coach_id, actor_clerk_id, action, entity_type, entity_id, metadata, created_at")
    .eq("team_id", context.team.id)
    .order("created_at", { ascending: false })
    .limit(100);

  const safeLogs = (logs || []) as AuditLog[];
  const actorIds = Array.from(new Set(safeLogs.map((log) => log.actor_coach_id).filter(Boolean))) as string[];
  const { data: coaches } = actorIds.length
    ? await supabaseAdmin
        .from("coaches")
        .select("id, name, email")
        .in("id", actorIds)
    : { data: [] };
  const coachesById = new Map((coaches || []).map((coach) => [coach.id, coach]));

  return (
    <div className="min-h-screen hersemita-page-bg text-white">
      <CoachHeader active="settings" />

      <main className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
        <section className="mb-6 rounded-2xl border border-white/10 bg-white/10 p-5 shadow-2xl shadow-black/10 backdrop-blur sm:p-6">
          <Link href="/settings" className="mb-4 inline-flex rounded-lg border border-white/15 bg-white/10 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/15">
            Back to settings
          </Link>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#00a7ff]">Team Security</p>
          <h2 className="mt-2 text-3xl font-bold text-white sm:text-4xl">Audit Log</h2>
          <p className="mt-2 max-w-3xl text-[#cbd5e1]">
            Review high-impact team actions like verification, deletion, assistant access changes, and parent message attempts.
          </p>
        </section>

        <section className="section-card overflow-hidden p-4 sm:p-5">
          {safeLogs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
              No audit events yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[880px] text-sm">
                <thead>
                  <tr className="border-b border-slate-700 bg-slate-900/50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-3">Time</th>
                    <th className="px-4 py-3">Action</th>
                    <th className="px-4 py-3">Actor</th>
                    <th className="px-4 py-3">Entity</th>
                    <th className="px-4 py-3">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {safeLogs.map((log) => {
                    const actor = log.actor_coach_id ? coachesById.get(log.actor_coach_id) : null;

                    return (
                      <tr key={log.id} className="border-b border-slate-800 last:border-0">
                        <td className="px-4 py-3 font-semibold text-slate-200">{formatDate(log.created_at)}</td>
                        <td className="px-4 py-3">
                          <span className="rounded-full border border-[#00a7ff]/30 bg-[#00a7ff]/10 px-3 py-1 text-xs font-bold capitalize text-[#7dd3fc]">
                            {formatAction(log.action)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-300">
                          {actor?.name || actor?.email || log.actor_clerk_id || "System"}
                        </td>
                        <td className="px-4 py-3 text-slate-300">
                          <span className="font-bold capitalize text-slate-100">{log.entity_type}</span>
                          {log.entity_id && <span className="block text-xs text-slate-500">{log.entity_id}</span>}
                        </td>
                        <td className="px-4 py-3 text-slate-400">{metadataSummary(log.metadata)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
