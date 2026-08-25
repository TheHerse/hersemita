import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

function authorized(request: Request) {
  const secret = process.env.SECURITY_MONITOR_SECRET || process.env.CRON_SECRET;
  if (!secret && process.env.NODE_ENV !== "production") return true;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}` || request.headers.get("x-cron-secret") === secret;
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data, error } = await supabaseAdmin.rpc("generate_security_alerts", { p_window_minutes: 15 });
  if (error) return NextResponse.json({ error: "Security monitor unavailable" }, { status: 500 });
  return NextResponse.json({ ok: true, alertsCreated: Number(data || 0) }, { headers: { "Cache-Control": "no-store" } });
}
