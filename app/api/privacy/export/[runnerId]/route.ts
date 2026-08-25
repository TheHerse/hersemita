import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { logAuditEvent } from "@/lib/audit-log";
import { checkRateLimit, rateLimitKey } from "@/lib/rate-limit";
import { getPrivacyRequestSubjects } from "@/lib/privacy-request-access";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentTeamContext } from "@/lib/team-context";
import { logSecurityEvent, securityReference } from "@/lib/security-events";

export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function withoutSecrets(record: Record<string, unknown> | null) {
  if (!record) return null;
  const blocked = new Set([
    "access_code", "access_code_hash", "credential_version", "session_version",
    "invite_token", "token_hash",
  ]);
  return Object.fromEntries(Object.entries(record).filter(([key]) => !blocked.has(key)));
}

export async function GET(_request: Request, { params }: { params: Promise<{ runnerId: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { runnerId } = await params;
  if (!UUID_PATTERN.test(runnerId)) return NextResponse.json({ error: "Invalid runner" }, { status: 400 });

  const subject = (await getPrivacyRequestSubjects(userId)).find((runner) => runner.id === runnerId);
  if (!subject) {
    await logSecurityEvent({ actorType: "coach", actorReference: securityReference(userId), eventType: "authorization.denied", severity: "high", route: "/api/privacy/export", outcome: "runner_not_authorized" });
    return NextResponse.json({ error: "Runner not found" }, { status: 404 });
  }
  const limit = await checkRateLimit({
    key: rateLimitKey(["privacy-export", userId, runnerId]),
    windowMs: 24 * 60 * 60 * 1000,
    max: 5,
  });
  if (limit.limited) {
    await logSecurityEvent({ teamId: subject.teamId, actorType: subject.role === "coach" ? "coach" : subject.role === "adult_runner" ? "adult" : "parent", actorReference: securityReference(userId), eventType: "export.rate_limited", severity: "high", route: "/api/privacy/export", outcome: "blocked" });
    return NextResponse.json({ error: "Export limit reached" }, { status: 429 });
  }

  const [
    runnerResult,
    activityResult,
    recoveryResult,
    alertResult,
    guardianLinkResult,
    parentConsentResult,
    adultConsentResult,
  ] = await Promise.all([
    supabaseAdmin.from("runners").select("*").eq("id", runnerId).eq("team_id", subject.teamId).single(),
    supabaseAdmin.from("activities").select("*").eq("runner_id", runnerId).order("start_time"),
    supabaseAdmin.from("recovery_logs").select("*").eq("runner_id", runnerId).order("log_date"),
    supabaseAdmin.from("coach_alerts").select("*").eq("runner_id", runnerId).order("created_at"),
    supabaseAdmin.from("runner_guardians").select("guardian_id, relationship, is_primary, created_at").eq("runner_id", runnerId),
    supabaseAdmin.from("runner_consent_events").select("*").eq("runner_id", runnerId).order("created_at"),
    supabaseAdmin.from("adult_runner_consent_events").select("*").eq("runner_id", runnerId).order("created_at"),
  ]);
  if (runnerResult.error || !runnerResult.data) {
    return NextResponse.json({ error: "Could not create export" }, { status: 500 });
  }

  const activities = (activityResult.data || []).map((activity) => ({
    ...withoutSecrets(activity),
    screenshot_urls: undefined,
    screenshot_count: Array.isArray(activity.screenshot_urls) ? activity.screenshot_urls.length : 0,
  }));
  const exportDocument = {
    exportVersion: "2026-08-privacy-export-v1",
    generatedAt: new Date().toISOString(),
    subjectRole: subject.role,
    runner: withoutSecrets(runnerResult.data),
    activities,
    recoveryLogs: recoveryResult.data || [],
    alerts: alertResult.data || [],
    guardianLinks: guardianLinkResult.data || [],
    parentConsentEvents: parentConsentResult.data || [],
    adultConsentEvents: adultConsentResult.data || [],
    unavailableSections: [
      activityResult, recoveryResult, alertResult, guardianLinkResult, parentConsentResult, adultConsentResult,
    ].filter((result) => result.error).map((result) => result.error?.message || "Unavailable section"),
  };

  const coachContext = await getCurrentTeamContext(userId);
  await logAuditEvent({
    teamId: subject.teamId,
    actorCoachId: coachContext?.coach.id,
    actorClerkId: userId,
    action: "privacy.export_generated",
    entityType: "runner",
    entityId: runnerId,
    metadata: { requesterRole: subject.role },
  });

  return new Response(JSON.stringify(exportDocument, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="hersemita-privacy-export-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store, private",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
