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

type LookupRecord = {
  id: string;
  name?: string | null;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
};

function actionLabel(value: string) {
  const labels: Record<string, string> = {
    "assistant.invited": "Assistant invite sent",
    "assistant.invite_resent": "Assistant invite resent",
    "assistant.invite_canceled": "Assistant invite canceled",
    "assistant.invite_accepted": "Assistant invite accepted",
    "assistant.added": "Assistant coach added",
    "assistant.removed": "Assistant coach removed",
    "parent_message.sent": "Parent message sent",
    "parent_portal.invited": "Parent invite sent",
    "parent_portal.linked_existing_account": "Parent account linked",
    "parent_portal.guardian_added": "Guardian added",
    "parent_portal.guardian_removed": "Guardian removed",
    "activity.verified": "Activity verified",
    "activity.rejected": "Activity rejected",
    "runner.created": "Runner added",
    "runner.updated": "Runner updated",
    "runner.deleted": "Runner deleted",
  };

  return labels[value] || value.replaceAll("_", " ").replaceAll(".", " / ");
}

function actionGroup(value: string) {
  if (value.startsWith("assistant.")) return "Team access";
  if (value.startsWith("parent_")) return "Parent access";
  if (value.startsWith("activity.")) return "Activity review";
  if (value.startsWith("runner.")) return "Roster";
  return "System";
}

function actionTone(value: string) {
  if (value.includes("canceled") || value.includes("removed") || value.includes("rejected") || value.includes("deleted")) {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }
  if (value.includes("sent") || value.includes("invited")) return "border-sky-200 bg-sky-50 text-sky-700";
  if (value.includes("accepted") || value.includes("added") || value.includes("linked") || value.includes("verified")) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  return "border-slate-200 bg-slate-50 text-slate-700";
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

function shortReference(value: string | null) {
  return value ? value.slice(0, 8) : null;
}

function getString(metadata: Record<string, unknown>, key: string) {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function displayName(record?: LookupRecord | null) {
  if (!record) return null;
  const fullName = [record.first_name, record.last_name].filter(Boolean).join(" ").trim();
  return record.name || fullName || record.email || null;
}

function detailItems(
  log: AuditLog,
  runnersById: Map<string, LookupRecord>,
  guardiansById: Map<string, LookupRecord>
) {
  const metadata = log.metadata || {};
  const items: string[] = [];

  const runnerId = getString(metadata, "runnerId") || (log.entity_type === "runner" ? log.entity_id : null);
  const guardianId = log.entity_type === "guardian_contact" ? log.entity_id : getString(metadata, "guardianId");
  const email = getString(metadata, "email") || getString(metadata, "guardianEmail") || getString(metadata, "invitedEmail");
  const messageType = getString(metadata, "messageType");
  const runnerCount = metadata.runnerCount;
  const phoneCount = metadata.phoneCount;
  const success = metadata.success;
  const mock = metadata.mock;

  if (runnerId) {
    items.push(`Runner: ${displayName(runnersById.get(runnerId)) || `reference ${shortReference(runnerId)}`}`);
  }

  if (guardianId) {
    items.push(`Guardian: ${displayName(guardiansById.get(guardianId)) || `reference ${shortReference(guardianId)}`}`);
  }

  if (email) items.push(`Email: ${email}`);
  if (messageType) items.push(`Message type: ${messageType}`);
  if (typeof runnerCount === "number") items.push(`Runners selected: ${runnerCount}`);
  if (typeof phoneCount === "number") items.push(`Phone numbers: ${phoneCount}`);
  if (typeof success === "boolean") items.push(success ? "Delivery accepted by provider" : "Delivery did not complete");
  if (mock === true) items.push("Prepared only; live SMS was not sent");

  return items.length ? items : ["No extra details recorded"];
}

function collectIds(logs: AuditLog[], key: string, entityType: string) {
  return Array.from(
    new Set(
      logs
        .map((log) => getString(log.metadata || {}, key) || (log.entity_type === entityType ? log.entity_id : null))
        .filter(Boolean)
    )
  ) as string[];
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
  const runnerIds = collectIds(safeLogs, "runnerId", "runner");
  const guardianIds = collectIds(safeLogs, "guardianId", "guardian_contact");

  const { data: coaches } = actorIds.length
    ? await supabaseAdmin
        .from("coaches")
        .select("id, name, email")
        .in("id", actorIds)
    : { data: [] };
  const coachesById = new Map((coaches || []).map((coach) => [coach.id, coach]));
  const { data: runners } = runnerIds.length
    ? await supabaseAdmin
        .from("runners")
        .select("id, first_name, last_name")
        .eq("team_id", context.team.id)
        .in("id", runnerIds)
    : { data: [] };
  const runnersById = new Map(((runners || []) as LookupRecord[]).map((runner) => [runner.id, runner]));
  const { data: guardians } = guardianIds.length
    ? await supabaseAdmin
        .from("guardian_contacts")
        .select("id, first_name, last_name, email")
        .eq("team_id", context.team.id)
        .in("id", guardianIds)
    : { data: [] };
  const guardiansById = new Map(((guardians || []) as LookupRecord[]).map((guardian) => [guardian.id, guardian]));

  const summaryCounts = safeLogs.reduce<Record<string, number>>((counts, log) => {
    const group = actionGroup(log.action);
    counts[group] = (counts[group] || 0) + 1;
    return counts;
  }, {});

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

        {safeLogs.length > 0 && (
          <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(summaryCounts).map(([group, count]) => (
              <div key={group} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{group}</p>
                <p className="mt-2 text-2xl font-black text-slate-950">{count}</p>
              </div>
            ))}
          </section>
        )}

        <section className="section-card p-4 sm:p-5">
          {safeLogs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
              No audit events yet.
            </div>
          ) : (
            <div className="space-y-3">
              {safeLogs.map((log) => {
                const actor = log.actor_coach_id ? coachesById.get(log.actor_coach_id) : null;
                const actorName = actor?.name || actor?.email || log.actor_clerk_id || "System";
                const details = detailItems(log, runnersById, guardiansById);

                return (
                  <article key={log.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full border px-3 py-1 text-xs font-black ${actionTone(log.action)}`}>
                            {actionGroup(log.action)}
                          </span>
                          <span className="text-xs font-semibold text-slate-500">{formatDate(log.created_at)}</span>
                        </div>
                        <h3 className="mt-3 text-lg font-black text-slate-950">{actionLabel(log.action)}</h3>
                        <p className="mt-1 text-sm text-slate-600">By {actorName}</p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">
                        {log.entity_type.replaceAll("_", " ")}
                        {log.entity_id && <span className="ml-1 text-slate-400">#{shortReference(log.entity_id)}</span>}
                      </div>
                    </div>

                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      {details.map((detail) => (
                        <p key={detail} className="rounded-xl bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
                          {detail}
                        </p>
                      ))}
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
