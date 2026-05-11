import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getRunnerSession } from "@/lib/runner-session";

export async function POST(request: Request) {
  const session = await getRunnerSession();
  if (!session) {
    return NextResponse.json({ error: "Runner session required" }, { status: 401 });
  }

  const formData = await request.formData();
  const files = formData.getAll("files").filter((file): file is File => file instanceof File);

  if (files.length === 0) {
    return NextResponse.json({ error: "No files selected" }, { status: 400 });
  }

  const urls: string[] = [];

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
    const fileName = `${session.runnerId}/${Date.now()}_${index}.${extension}`;
    const bytes = Buffer.from(await file.arrayBuffer());

    const { error } = await supabaseAdmin.storage
      .from("activity-screenshots")
      .upload(fileName, bytes, {
        contentType: file.type || "application/octet-stream",
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
