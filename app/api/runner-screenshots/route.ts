import { NextResponse } from "next/server";
import { compressScreenshot } from "@/lib/image-compression";
import { checkRateLimit, clientIpFromHeaders, rateLimitKey } from "@/lib/rate-limit";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getRunnerSession } from "@/lib/runner-session";

const UPLOAD_WINDOW_MS = 60 * 60 * 1000;
const MAX_UPLOAD_REQUESTS = 20;

export async function POST(request: Request) {
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
    return NextResponse.json({ error: "Too many uploads. Try again later." }, { status: 429 });
  }

  const formData = await request.formData();
  const files = formData.getAll("files").filter((file): file is File => file instanceof File);

  if (files.length === 0) {
    return NextResponse.json({ error: "No files selected" }, { status: 400 });
  }

  const urls: string[] = [];

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    let compressed: Awaited<ReturnType<typeof compressScreenshot>>;

    try {
      compressed = await compressScreenshot(file);
    } catch (error) {
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

    const { data } = supabaseAdmin.storage.from("activity-screenshots").getPublicUrl(fileName);
    urls.push(data.publicUrl);
  }

  return NextResponse.json({ urls });
}
