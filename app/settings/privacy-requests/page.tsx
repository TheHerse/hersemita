import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { removeActivityScreenshots } from "@/lib/activity-screenshot-storage";
import { logAuditEvent } from "@/lib/audit-log";
import { checkRateLimit, rateLimitKey } from "@/lib/rate-limit";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentTeamContext } from "@/lib/team-context";

const STATUSES = new Set(["identity_verification", "in_review", "approved", "denied", "completed", "canceled"]);

async function transitionRequest(requestId: string, formData: FormData) {
  "use server";
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const context = await getCurrentTeamContext(userId);
  if (!context || context.role !== "head_coach") redirect("/settings");
  const status = String(formData.get("status") || "");
  const note = String(formData.get("note") || "").trim();
  if (!STATUSES.has(status) || note.length > 2000) redirect("/settings/privacy-requests?error=Invalid%20request%20update.");
  const limit = await checkRateLimit({ key: rateLimitKey(["privacy-process", userId]), windowMs: 60 * 60 * 1000, max: 30 });
  if (limit.limited) redirect("/settings/privacy-requests?error=Too%20many%20updates.%20Try%20again%20later.");

  const { error } = await supabaseAdmin.rpc("transition_privacy_request", {
    p_request_id: requestId,
    p_team_id: context.team.id,
    p_actor_clerk_id: userId,
    p_to_status: status,
    p_note: note,
  });
  if (error) redirect(`/settings/privacy-requests?error=${encodeURIComponent("Could not update this request.")}`);
  await logAuditEvent({
    teamId: context.team.id, actorCoachId: context.coach.id, actorClerkId: userId,
    action: "privacy.request_status_changed", entityType: "privacy_request", entityId: requestId,
    metadata: { status },
  });
  redirect("/settings/privacy-requests?saved=1");
}

async function completeDeletion(requestId: string, expectedConfirmation: string, formData: FormData) {
  "use server";
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const context = await getCurrentTeamContext(userId);
  if (!context || context.role !== "head_coach") redirect("/settings");
  if (String(formData.get("confirmation") || "").trim() !== expectedConfirmation) {
    redirect("/settings/privacy-requests?error=Deletion%20confirmation%20did%20not%20match.");
  }
  const note = String(formData.get("note") || "").trim();
  if (note.length > 2000) redirect("/settings/privacy-requests?error=Deletion%20note%20is%20too%20long.");
  const limit = await checkRateLimit({ key: rateLimitKey(["privacy-delete", context.team.id, userId]), windowMs: 24 * 60 * 60 * 1000, max: 5 });
  if (limit.limited) redirect("/settings/privacy-requests?error=Deletion%20limit%20reached.%20Contact%20support%20if%20urgent.");

  const { data: requestRecord } = await supabaseAdmin
    .from("privacy_requests")
    .select("id, runner_id, status")
    .eq("id", requestId)
    .eq("team_id", context.team.id)
    .eq("request_type", "deletion")
    .maybeSingle();
  if (!requestRecord?.runner_id || !["in_review", "approved"].includes(requestRecord.status)) {
    redirect("/settings/privacy-requests?error=Deletion%20request%20is%20not%20ready.");
  }

  const { data: activities, error: activityError } = await supabaseAdmin
    .from("activities").select("screenshot_urls").eq("runner_id", requestRecord.runner_id);
  if (activityError) redirect("/settings/privacy-requests?error=Could%20not%20inventory%20runner%20files.");
  const screenshotUrls = (activities || []).flatMap((activity) => activity.screenshot_urls || []);
  try {
    await removeActivityScreenshots(screenshotUrls);
  } catch {
    redirect("/settings/privacy-requests?error=Stored%20files%20could%20not%20be%20deleted.%20No%20database%20records%20were%20removed.");
  }

  const { data: deletedRunnerId, error } = await supabaseAdmin.rpc("complete_privacy_deletion", {
    p_request_id: requestId,
    p_team_id: context.team.id,
    p_actor_clerk_id: userId,
    p_note: note,
  });
  if (error || !deletedRunnerId) redirect("/settings/privacy-requests?error=Database%20deletion%20could%20not%20be%20completed.");
  await logAuditEvent({
    teamId: context.team.id, actorCoachId: context.coach.id, actorClerkId: userId,
    action: "privacy.runner_deletion_completed", entityType: "privacy_request", entityId: requestId,
    metadata: { screenshotCount: screenshotUrls.length },
  });
  redirect("/settings/privacy-requests?deleted=1");
}

type RunnerJoin = { first_name?: string; last_name?: string; username?: string };

export default async function PrivacyRequestAdminPage({ searchParams }: { searchParams?: Promise<{ saved?: string; deleted?: string; error?: string }> }) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const context = await getCurrentTeamContext(userId);
  if (!context || context.role !== "head_coach") redirect("/settings");
  const query = await searchParams;
  const { data: requests, error } = await supabaseAdmin
    .from("privacy_requests")
    .select("id, runner_id, requester_role, request_type, details, status, submitted_at, due_at, runners(first_name,last_name,username)")
    .eq("team_id", context.team.id)
    .order("submitted_at", { ascending: true })
    .limit(200);

  return (
    <main className="mx-auto min-h-screen max-w-5xl space-y-6 bg-slate-950 p-4 text-white sm:p-8">
      <div><Link href="/settings" className="text-sm font-bold text-sky-300">Back to settings</Link>
        <h1 className="mt-3 text-3xl font-black">Privacy request processing</h1>
        <p className="mt-2 text-slate-300">Verify identity and authority before approving. Complete correction or access work before marking it completed.</p>
      </div>
      {(error || query?.error) && <p className="rounded-xl border border-red-400/30 bg-red-500/10 p-4">{query?.error || "Privacy request migration is not ready."}</p>}
      {(query?.saved || query?.deleted) && <p className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-4">{query.deleted ? "Deletion completed and recorded." : "Request updated."}</p>}

      <section className="space-y-4">
        {(requests || []).length === 0 ? <p className="text-slate-400">No privacy requests.</p> : (requests || []).map((request) => {
          const joined = (Array.isArray(request.runners) ? request.runners[0] : request.runners) as RunnerJoin | null;
          const name = joined ? `${joined.first_name || ""} ${joined.last_name || ""}`.trim() : "Deleted runner";
          const deletionConfirmation = `DELETE REQUEST ${request.id.slice(0, 8)}`;
          const terminal = ["completed", "denied", "canceled"].includes(request.status);
          return <article key={request.id} className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="flex flex-wrap justify-between gap-3"><div><h2 className="text-lg font-black">{name} — {request.request_type}</h2>
              <p className="text-sm text-slate-300">Requester: {request.requester_role} · Status: {request.status}</p></div>
              {request.runner_id && <a href={`/api/privacy/export/${request.runner_id}`} className="text-sm font-bold text-sky-300 underline">Download authorized export</a>}
            </div>
            {request.details && <p className="mt-4 whitespace-pre-wrap rounded-lg bg-slate-900 p-3 text-sm">{request.details}</p>}
            {!terminal && <form action={transitionRequest.bind(null, request.id)} className="mt-4 grid gap-3 sm:grid-cols-[180px_1fr_auto]">
              <select name="status" className="rounded-lg bg-slate-900 p-3"><option value="in_review">In review</option><option value="identity_verification">Verify identity</option><option value="approved">Approved</option>{request.request_type !== "deletion" && <option value="completed">Completed</option>}<option value="denied">Denied</option><option value="canceled">Canceled</option></select>
              <input name="note" maxLength={2000} className="rounded-lg bg-slate-900 p-3" placeholder="Internal processing note" />
              <button className="rounded-lg bg-sky-500 px-4 py-3 font-black text-slate-950">Update</button>
            </form>}
            {request.request_type === "deletion" && request.runner_id && ["in_review", "approved"].includes(request.status) && <form action={completeDeletion.bind(null, request.id, deletionConfirmation)} className="mt-4 space-y-3 rounded-xl border border-red-400/30 bg-red-500/10 p-4">
              <p className="text-sm">After confirming identity, authority, school requirements, and any legal hold, type <strong>{deletionConfirmation}</strong>.</p>
              <input name="confirmation" required autoComplete="off" className="w-full rounded-lg bg-slate-950 p-3" placeholder={deletionConfirmation} />
              <input name="note" maxLength={2000} className="w-full rounded-lg bg-slate-950 p-3" placeholder="Completion evidence or reason" />
              <button className="rounded-lg bg-red-600 px-4 py-3 font-black">Permanently delete runner data</button>
            </form>}
          </article>;
        })}
      </section>
    </main>
  );
}
