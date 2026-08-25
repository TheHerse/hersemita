import { NextResponse } from "next/server";
import { compressScreenshot } from "@/lib/image-compression";
import { checkRateLimit, clientIpFromHeaders, rateLimitKey } from "@/lib/rate-limit";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getRunnerSession } from "@/lib/runner-session";
import { activityScreenshotReference } from "@/lib/activity-screenshot-storage";
import { hasTrustedRequestOrigin } from "@/lib/request-origin";
import { logSecurityEvent, securityReference } from "@/lib/security-events";

const UPLOAD_WINDOW_MS = 60 * 60 * 1000;
const MAX_UPLOAD_REQUESTS = 20;
const MAX_FILES_PER_REQUEST = 3;

export async function POST(request: Request) {
  if (!hasTrustedRequestOrigin(request)) {
    await logSecurityEvent({ actorType: "anonymous", actorReference: securityReference(clientIpFromHeaders(request.headers)), eventType: "origin.rejected", severity: "high", route: "/api/runner-screenshots", outcome: "blocked" });
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }
  const session = await getRunnerSession();
  if (!session) {
    return NextResponse.json({ error: "Runner session required" }, { status: 401 });
  }

  const limit = await checkRateLimit({
    key: rateLimitKey(["runner-upload", session.runnerId, clientIpFromHeaders(request.headers)]),
    windowMs: UPLOAD_WINDOW_MS,
    max: MAX_UPLOAD_REQUESTS,
  });

  if (limit.limited) {
    await logSecurityEvent({ actorType: "runner", actorReference: securityReference(session.runnerId), eventType: "upload.rate_limited", severity: "high", route: "/api/runner-screenshots", outcome: "blocked" });
    return NextResponse.json({ error: "Too many uploads. Try again later." }, { status: 429 });
  }

  const formData = await request.formData();
  const files = formData.getAll("files").filter((file): file is File => file instanceof File);

  if (files.length === 0) {
    return NextResponse.json({ error: "No files selected" }, { status: 400 });
  }
  if (files.length > MAX_FILES_PER_REQUEST) {
    return NextResponse.json({ error: `Upload no more than ${MAX_FILES_PER_REQUEST} screenshots at a time` }, { status: 400 });
  }

  const urls: string[] = [];

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    let compressed: Awaited<ReturnType<typeof compressScreenshot>>;

    try {
      compressed = await compressScreenshot(file);
    } catch (error) {
      await logSecurityEvent({ actorType: "runner", actorReference: securityReference(session.runnerId), eventType: "upload.rejected", severity: "warning", route: "/api/runner-screenshots", outcome: "invalid_file", metadata: { fileCount: files.length } });
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "This screenshot format could not be processed." },
        { status: 400 }
      );
    }

    const fileName = `${session.runnerId}/${Date.now()}_${index}.${compressed.extension}`;

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

    urls.push(activityScreenshotReference(fileName));
  }

  await logSecurityEvent({ actorType: "runner", actorReference: securityReference(session.runnerId), eventType: "upload.accepted", severity: "info", route: "/api/runner-screenshots", outcome: "stored", metadata: { fileCount: files.length } });

  return NextResponse.json({ urls });
}
