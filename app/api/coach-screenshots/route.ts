import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { compressScreenshot } from "@/lib/image-compression";
import { checkRateLimit, clientIpFromHeaders, rateLimitKey } from "@/lib/rate-limit";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentTeamContext } from "@/lib/team-context";
import { activityScreenshotReference } from "@/lib/activity-screenshot-storage";
import { hasTrustedRequestOrigin } from "@/lib/request-origin";
import { logSecurityEvent, securityReference } from "@/lib/security-events";

const UPLOAD_WINDOW_MS = 60 * 60 * 1000;
const MAX_UPLOAD_REQUESTS = 30;

export async function POST(request: Request) {
  if (!hasTrustedRequestOrigin(request)) {
    await logSecurityEvent({ actorType: "anonymous", actorReference: securityReference(clientIpFromHeaders(request.headers)), eventType: "origin.rejected", severity: "high", route: "/api/coach-screenshots", outcome: "blocked" });
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Coach authentication required" }, { status: 401 });
  }

  const context = await getCurrentTeamContext(userId);
  const teamId = context?.team.id;
  if (!teamId) {
    return NextResponse.json({ error: "Team access required" }, { status: 403 });
  }

  const limit = await checkRateLimit({
    key: rateLimitKey(["coach-screenshot-upload", teamId, context.coach.id, clientIpFromHeaders(request.headers)]),
    windowMs: UPLOAD_WINDOW_MS,
    max: MAX_UPLOAD_REQUESTS,
  });

  if (limit.limited) {
    await logSecurityEvent({ teamId, actorType: "coach", actorReference: securityReference(userId), eventType: "upload.rate_limited", severity: "high", route: "/api/coach-screenshots", outcome: "blocked" });
    return NextResponse.json({ error: "Too many uploads. Try again later." }, { status: 429 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const runnerId = String(formData.get("runnerId") || "");

  if (!(file instanceof File) || file.size === 0 || !runnerId) {
    return NextResponse.json({ error: "Screenshot and runner are required" }, { status: 400 });
  }

  const { data: runner } = await supabaseAdmin
    .from("runners")
    .select("id")
    .eq("id", runnerId)
    .eq("team_id", teamId)
    .eq("portal_status", "active")
    .is("archived_at", null)
    .maybeSingle();

  if (!runner?.id) {
    await logSecurityEvent({ teamId, actorType: "coach", actorReference: securityReference(userId), eventType: "authorization.denied", severity: "high", route: "/api/coach-screenshots", outcome: "runner_not_in_team" });
    return NextResponse.json({ error: "Runner not found for this team" }, { status: 404 });
  }

  let compressed: Awaited<ReturnType<typeof compressScreenshot>>;

  try {
    compressed = await compressScreenshot(file);
  } catch (error) {
    await logSecurityEvent({ teamId, actorType: "coach", actorReference: securityReference(userId), eventType: "upload.rejected", severity: "warning", route: "/api/coach-screenshots", outcome: "invalid_file" });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "This screenshot format could not be processed." },
      { status: 400 }
    );
  }

  const fileName = `${runner.id}/coach_${Date.now()}.${compressed.extension}`;

  const { error } = await supabaseAdmin.storage
    .from("activity-screenshots")
    .upload(fileName, compressed.buffer, {
      contentType: compressed.contentType,
      cacheControl: "31536000",
      upsert: false,
    });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logSecurityEvent({ teamId, actorType: "coach", actorReference: securityReference(userId), eventType: "upload.accepted", severity: "info", route: "/api/coach-screenshots", outcome: "stored" });

  return NextResponse.json({
    url: activityScreenshotReference(fileName),
    originalSize: compressed.originalSize,
    storedSize: compressed.compressedSize,
  });
}
