import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import CoachHeader from "@/components/CoachHeader";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getCurrentTeamContext } from "@/lib/team-context";

type MessageRecipient = {
  id: string;
  runner_name: string;
  phone_last4: string | null;
  status: string;
};

type MessageBatch = {
  id: string;
  message_type: string;
  body: string;
  status: string;
  mock: boolean;
  runner_count: number;
  recipient_count: number;
  error_message: string | null;
  created_at: string;
  coaches?:
    | {
        name: string | null;
        email: string | null;
      }
    | {
        name: string | null;
        email: string | null;
      }[]
    | null;
  parent_message_recipients?: MessageRecipient[];
};

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function statusClasses(status: string) {
  if (status === "sent") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "mock") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-rose-200 bg-rose-50 text-rose-700";
}

function statusLabel(batch: MessageBatch) {
  if (batch.status === "sent") return "Sent";
  if (batch.status === "mock") return "Prepared only";
  return "Failed";
}

function coachName(batch: MessageBatch) {
  const coach = Array.isArray(batch.coaches) ? batch.coaches[0] : batch.coaches;
  return coach?.name || coach?.email || "Coach";
}

export default async function ParentMessageHistoryPage() {
  const { userId } = await auth();
  if (!userId) redirect("/");

  const context = await getCurrentTeamContext(userId);
  if (!context) redirect("/settings");

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("parent_message_batches")
    .select(
      "id, message_type, body, status, mock, runner_count, recipient_count, error_message, created_at, coaches(name, email), parent_message_recipients(id, runner_name, phone_last4, status)"
    )
    .eq("team_id", context.team.id)
    .order("created_at", { ascending: false })
    .limit(100);

  const batches = (data || []) as unknown as MessageBatch[];

  return (
    <div className="min-h-screen hersemita-page-bg">
      <CoachHeader active="message" />

      <main className="mx-auto max-w-5xl p-4 sm:p-6 lg:p-8">
        <section className="mb-6 rounded-2xl border border-white/10 bg-white/10 p-5 text-white shadow-2xl shadow-black/10 backdrop-blur sm:p-6">
          <Link href="/runners/message" className="mb-4 inline-flex rounded-lg border border-white/15 bg-white/10 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/15">
            Back to messaging
          </Link>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#00a7ff]">Parent Communication</p>
          <h2 className="mt-2 text-3xl font-bold sm:text-4xl">Message History</h2>
          <p className="mt-2 max-w-3xl text-[#cbd5e1]">
            Review parent messages prepared or sent by your coaching staff. Full phone numbers are not stored in this log.
          </p>
        </section>

        {error ? (
          <section className="section-card p-6">
            <p className="font-bold text-slate-950">Message history is not set up yet.</p>
            <p className="mt-2 text-sm text-slate-600">
              Run <span className="font-mono">supabase/parent-message-log.sql</span> in Supabase, then refresh this page.
            </p>
          </section>
        ) : batches.length === 0 ? (
          <section className="section-card p-8 text-center">
            <p className="text-lg font-black text-slate-950">No parent messages yet</p>
            <p className="mt-2 text-sm text-slate-600">Prepared and sent parent messages will appear here.</p>
          </section>
        ) : (
          <section className="space-y-4">
            {batches.map((batch) => {
              const recipients = batch.parent_message_recipients || [];
              return (
                <article key={batch.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClasses(batch.status)}`}>
                          {statusLabel(batch)}
                        </span>
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-black capitalize text-slate-600">
                          {batch.message_type.replaceAll("_", " ")}
                        </span>
                      </div>
                      <p className="mt-3 text-sm font-semibold text-slate-500">{formatDate(batch.created_at)} by {coachName(batch)}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-right">
                      <p className="text-xl font-black text-slate-950">{batch.recipient_count}</p>
                      <p className="text-xs font-semibold text-slate-500">recipients</p>
                    </div>
                  </div>

                  <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm font-semibold leading-6 text-slate-800">
                    {batch.body}
                  </p>

                  {batch.error_message && (
                    <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">
                      {batch.error_message}
                    </p>
                  )}

                  {recipients.length > 0 && (
                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      {recipients.map((recipient) => (
                        <div key={recipient.id} className="rounded-xl border border-slate-200 px-3 py-2">
                          <p className="text-sm font-black text-slate-950">{recipient.runner_name}</p>
                          <p className="text-xs font-semibold text-slate-500">
                            Parent phone ending {recipient.phone_last4 || "unknown"} · {recipient.status}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </article>
              );
            })}
          </section>
        )}
      </main>
    </div>
  );
}
