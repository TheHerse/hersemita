import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { removeActivityScreenshots } from "@/lib/activity-screenshot-storage";
import { logAuditEvent } from "@/lib/audit-log";
import { checkRateLimit, rateLimitKey } from "@/lib/rate-limit";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentTeamContext } from "@/lib/team-context";

async function closeSeason(expectedConfirmation: string, formData: FormData) {
  "use server";
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const context = await getCurrentTeamContext(userId);
  if (!context || context.role !== "head_coach") redirect("/settings");
  if (String(formData.get("confirmation") || "").trim() !== expectedConfirmation) {
    redirect("/settings/season-closeout?error=Confirmation%20did%20not%20match.");
  }
  const seasonLabel = String(formData.get("seasonLabel") || "").trim();
  const retentionValue = String(formData.get("retentionUntil") || "").trim();
  const retentionUntil = retentionValue || null;
  if (seasonLabel.length < 3 || seasonLabel.length > 80 || (retentionUntil && !/^\d{4}-\d{2}-\d{2}$/.test(retentionUntil))) {
    redirect("/settings/season-closeout?error=Invalid%20season%20or%20retention%20date.");
  }
  const limit = await checkRateLimit({ key: rateLimitKey(["season-close", context.team.id, userId]), windowMs: 24 * 60 * 60 * 1000, max: 2 });
  if (limit.limited) redirect("/settings/season-closeout?error=Season%20closeout%20limit%20reached.");

  const { data: closeoutId, error } = await supabaseAdmin.rpc("close_team_season", {
    p_team_id: context.team.id,
    p_season_label: seasonLabel,
    p_retention_until: retentionUntil,
    p_actor_clerk_id: userId,
  });
  if (error || !closeoutId) redirect("/settings/season-closeout?error=Season%20could%20not%20be%20closed.");
  await logAuditEvent({
    teamId: context.team.id, actorCoachId: context.coach.id, actorClerkId: userId,
    action: "season.closed", entityType: "season_closeout", entityId: closeoutId,
    metadata: { seasonLabel, retentionUntil },
  });
  redirect("/settings/season-closeout?closed=1");
}

async function completeCleanup(closeoutId: string, expectedConfirmation: string, formData: FormData) {
  "use server";
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const context = await getCurrentTeamContext(userId);
  if (!context || context.role !== "head_coach") redirect("/settings");
  if (String(formData.get("confirmation") || "").trim() !== expectedConfirmation) {
    redirect("/settings/season-closeout?error=Cleanup%20confirmation%20did%20not%20match.");
  }
  const limit = await checkRateLimit({ key: rateLimitKey(["season-cleanup", context.team.id, userId]), windowMs: 24 * 60 * 60 * 1000, max: 2 });
  if (limit.limited) redirect("/settings/season-closeout?error=Cleanup%20limit%20reached.");

  const { data: closeout } = await supabaseAdmin.from("season_closeouts")
    .select("id, retention_until, legal_hold, status")
    .eq("id", closeoutId).eq("team_id", context.team.id).maybeSingle();
  const today = new Date().toISOString().slice(0, 10);
  if (!closeout || closeout.legal_hold || !closeout.retention_until || closeout.retention_until > today || !["closed", "cleanup_ready"].includes(closeout.status)) {
    redirect("/settings/season-closeout?error=Cleanup%20is%20blocked%20by%20retention,%20status,%20or%20a%20legal%20hold.");
  }
  const { data: snapshotRows } = await supabaseAdmin.from("season_closeout_runners")
    .select("runner_id").eq("closeout_id", closeoutId).not("runner_id", "is", null);
  const runnerIds = (snapshotRows || []).map((row) => row.runner_id).filter(Boolean);
  const { data: activities, error: activityError } = runnerIds.length
    ? await supabaseAdmin.from("activities").select("screenshot_urls").in("runner_id", runnerIds)
    : { data: [], error: null };
  if (activityError) redirect("/settings/season-closeout?error=Could%20not%20inventory%20season%20files.");
  const screenshotUrls = (activities || []).flatMap((activity) => activity.screenshot_urls || []);
  try { await removeActivityScreenshots(screenshotUrls); }
  catch { redirect("/settings/season-closeout?error=Season%20files%20could%20not%20be%20removed."); }

  const { data: deletedCount, error } = await supabaseAdmin.rpc("complete_season_cleanup", {
    p_closeout_id: closeoutId, p_team_id: context.team.id, p_actor_clerk_id: userId,
  });
  if (error) redirect("/settings/season-closeout?error=Season%20database%20cleanup%20failed.");
  await logAuditEvent({
    teamId: context.team.id, actorCoachId: context.coach.id, actorClerkId: userId,
    action: "season.cleanup_completed", entityType: "season_closeout", entityId: closeoutId,
    metadata: { deletedRunnerCount: Number(deletedCount || 0), screenshotCount: screenshotUrls.length },
  });
  redirect("/settings/season-closeout?cleaned=1");
}

async function reopenSeason(closeoutId: string, expectedConfirmation: string, formData: FormData) {
  "use server";
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const context = await getCurrentTeamContext(userId);
  if (!context || context.role !== "head_coach") redirect("/settings");
  if (String(formData.get("confirmation") || "").trim() !== expectedConfirmation) {
    redirect("/settings/season-closeout?error=Reopen%20confirmation%20did%20not%20match.");
  }
  const limit = await checkRateLimit({ key: rateLimitKey(["season-reopen", context.team.id, userId]), windowMs: 24 * 60 * 60 * 1000, max: 2 });
  if (limit.limited) redirect("/settings/season-closeout?error=Season%20reopen%20limit%20reached.");
  const { data: restoredCount, error } = await supabaseAdmin.rpc("reopen_team_season", {
    p_closeout_id: closeoutId,
    p_team_id: context.team.id,
    p_actor_clerk_id: userId,
  });
  if (error) redirect("/settings/season-closeout?error=Season%20could%20not%20be%20reopened.");
  await logAuditEvent({
    teamId: context.team.id, actorCoachId: context.coach.id, actorClerkId: userId,
    action: "season.reopened", entityType: "season_closeout", entityId: closeoutId,
    metadata: { restoredRunnerCount: Number(restoredCount || 0), consentRequired: true },
  });
  redirect("/settings/season-closeout?reopened=1");
}

async function updateCloseoutControls(closeoutId: string, formData: FormData) {
  "use server";
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const context = await getCurrentTeamContext(userId);
  if (!context || context.role !== "head_coach") redirect("/settings");
  const retentionValue = String(formData.get("retentionUntil") || "").trim();
  if (retentionValue && !/^\d{4}-\d{2}-\d{2}$/.test(retentionValue)) redirect("/settings/season-closeout?error=Invalid%20retention%20date.");
  const legalHold = formData.get("legalHold") === "on";
  const { error } = await supabaseAdmin.rpc("set_season_closeout_controls", {
    p_closeout_id: closeoutId, p_team_id: context.team.id,
    p_retention_until: retentionValue || null, p_legal_hold: legalHold,
  });
  if (error) redirect("/settings/season-closeout?error=Closeout%20controls%20could%20not%20be%20updated.");
  await logAuditEvent({
    teamId: context.team.id, actorCoachId: context.coach.id, actorClerkId: userId,
    action: "season.retention_controls_updated", entityType: "season_closeout", entityId: closeoutId,
    metadata: { retentionUntil: retentionValue || null, legalHold },
  });
  redirect("/settings/season-closeout?controls=1");
}

export default async function SeasonCloseoutPage({ searchParams }: { searchParams?: Promise<{ closed?: string; cleaned?: string; controls?: string; reopened?: string; error?: string }> }) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const context = await getCurrentTeamContext(userId);
  if (!context || context.role !== "head_coach") redirect("/settings");
  const query = await searchParams;
  const [{ count: runnerCount }, { count: activityCount }, { data: closeouts, error }] = await Promise.all([
    supabaseAdmin.from("runners").select("id", { count: "exact", head: true }).eq("team_id", context.team.id).is("archived_at", null),
    supabaseAdmin.from("activities").select("id, runners!inner(team_id, archived_at)", { count: "exact", head: true }).eq("runners.team_id", context.team.id).is("runners.archived_at", null),
    supabaseAdmin.from("season_closeouts").select("id, season_label, status, retention_until, legal_hold, inventory, closed_at, completed_at").eq("team_id", context.team.id).order("closed_at", { ascending: false }),
  ]);
  const closeConfirmation = `CLOSE ${context.team.name}`;

  return <main className="mx-auto min-h-screen max-w-4xl space-y-6 bg-slate-950 p-4 text-white sm:p-8">
    <div><Link href="/settings" className="text-sm font-bold text-sky-300">Back to settings</Link><h1 className="mt-3 text-3xl font-black">End-of-season closeout</h1>
      <p className="mt-2 text-slate-300">Closing suspends runner access and archives the current roster. It does not delete records until an approved retention date has passed.</p></div>
    {query?.error && <p className="rounded-xl border border-red-400/30 bg-red-500/10 p-4">{query.error}</p>}
    {(query?.closed || query?.cleaned || query?.controls || query?.reopened) && <p className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-4">{query.cleaned ? "Eligible archived data was cleaned up." : query.reopened ? "Season reopened. Runners require fresh consent and credentials." : query.controls ? "Retention controls updated and logged." : "Season closed and runner access revoked."}</p>}
    {error && <p className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-4">Season closeout migration is not ready.</p>}

    <section className="rounded-2xl border border-white/10 bg-white/5 p-5"><h2 className="text-xl font-black">Current inventory</h2>
      <div className="mt-3 grid grid-cols-2 gap-3"><p className="rounded-lg bg-slate-900 p-4">Active roster records: <strong>{runnerCount || 0}</strong></p><p className="rounded-lg bg-slate-900 p-4">Activity records: <strong>{activityCount || 0}</strong></p></div>
    </section>
    <form action={closeSeason.bind(null, closeConfirmation)} className="space-y-4 rounded-2xl border border-amber-400/30 bg-amber-500/10 p-5">
      <h2 className="text-xl font-black">Close current season</h2>
      <input name="seasonLabel" required maxLength={80} className="w-full rounded-lg bg-slate-950 p-3" placeholder="2026 Cross Country" />
      <label className="block text-sm"><span className="mb-2 block font-bold">Approved deletion-eligibility date (optional)</span><input name="retentionUntil" type="date" className="w-full rounded-lg bg-slate-950 p-3" /><span className="mt-2 block text-slate-300">Leave blank until the school and counsel approve the retention schedule. Blank means cleanup is blocked.</span></label>
      <input name="confirmation" required autoComplete="off" className="w-full rounded-lg bg-slate-950 p-3" placeholder={closeConfirmation} />
      <button disabled={!runnerCount} className="rounded-lg bg-amber-400 px-5 py-3 font-black text-slate-950 disabled:opacity-50">Close season and suspend runners</button>
    </form>

    <section className="space-y-4"><h2 className="text-xl font-black">Closeout history</h2>{(closeouts || []).map((closeout) => {
      const eligible = !closeout.legal_hold && closeout.retention_until && closeout.retention_until <= new Date().toISOString().slice(0, 10) && ["closed", "cleanup_ready"].includes(closeout.status);
      const cleanupConfirmation = `DELETE SEASON ${closeout.id.slice(0, 8)}`;
      const reopenConfirmation = `REOPEN SEASON ${closeout.id.slice(0, 8)}`;
      const reversible = ["closed", "cleanup_ready"].includes(closeout.status);
      return <article key={closeout.id} className="rounded-xl border border-white/10 bg-white/5 p-4"><p className="font-black">{closeout.season_label}</p><p className="mt-1 text-sm text-slate-300">Status: {closeout.status} · Retain until: {closeout.retention_until || "not approved"} · Legal hold: {closeout.legal_hold ? "yes" : "no"}</p>
        {reversible && <form action={updateCloseoutControls.bind(null, closeout.id)} className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_auto]"><input name="retentionUntil" type="date" defaultValue={closeout.retention_until || ""} className="rounded-lg bg-slate-900 p-3" /><label className="flex items-center gap-2 rounded-lg bg-slate-900 px-3"><input name="legalHold" type="checkbox" defaultChecked={closeout.legal_hold} /> Legal hold</label><button className="rounded-lg border border-sky-400/40 px-4 py-3 font-bold text-sky-200">Save controls</button></form>}
        {reversible && <form action={reopenSeason.bind(null, closeout.id, reopenConfirmation)} className="mt-4 space-y-3 rounded-lg border border-amber-300/30 bg-amber-400/10 p-4"><p className="text-sm">Reopen before permanent cleanup. Runners return in a locked state and require fresh consent and credentials. Type <strong>{reopenConfirmation}</strong>.</p><input name="confirmation" required autoComplete="off" className="w-full rounded-lg bg-slate-950 p-3" placeholder={reopenConfirmation} /><button className="rounded-lg bg-amber-400 px-4 py-3 font-black text-slate-950">Reopen season with runners locked</button></form>}
        {eligible && <form action={completeCleanup.bind(null, closeout.id, cleanupConfirmation)} className="mt-4 space-y-3 rounded-lg border border-red-400/30 bg-red-500/10 p-4"><p className="text-sm">Permanent cleanup is eligible. Type <strong>{cleanupConfirmation}</strong>.</p><input name="confirmation" required className="w-full rounded-lg bg-slate-950 p-3" placeholder={cleanupConfirmation} /><button className="rounded-lg bg-red-600 px-4 py-3 font-black">Permanently clean archived season</button></form>}
      </article>;
    })}</section>
  </main>;
}
