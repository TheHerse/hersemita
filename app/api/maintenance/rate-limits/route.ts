import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

function isAuthorized(request: Request) {
  const secret = process.env.RATE_LIMIT_CLEANUP_SECRET || process.env.CRON_SECRET;
  if (!secret && process.env.NODE_ENV !== "production") return true;
  if (!secret) return false;

  const authorization = request.headers.get("authorization") || "";
  const headerSecret = request.headers.get("x-cron-secret") || "";
  return authorization === `Bearer ${secret}` || headerSecret === secret;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin.rpc("cleanup_rate_limits", {
    p_older_than_hours: 48,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(
    { ok: true, deleted: Number(data || 0) },
    { headers: { "Cache-Control": "no-store" } }
  );
}
