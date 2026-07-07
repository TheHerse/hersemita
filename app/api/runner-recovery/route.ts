import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getRunnerSession } from "@/lib/runner-session";

function parseNumber(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function parseIntegerInRange(value: unknown, min: number, max: number) {
  const parsed = parseNumber(value);
  if (parsed == null) return null;
  const rounded = Math.round(parsed);
  return rounded >= min && rounded <= max ? rounded : null;
}

function parseBoolean(value: unknown) {
  return value === true || value === "true" || value === "on";
}

function parseHrvStatus(value: unknown) {
  const parsed = parseString(value);
  const allowed = new Set(["balanced", "unbalanced", "low", "poor"]);
  return allowed.has(parsed) ? parsed : null;
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export async function GET() {
  const session = await getRunnerSession();
  if (!session) {
    return NextResponse.json({ error: "Runner session required" }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("recovery_logs")
    .select("id, log_date, hrv_ms, hrv_status, resting_hr, sleep_score, sleep_duration_min, body_battery, soreness, illness, notes")
    .eq("runner_id", session.runnerId)
    .order("log_date", { ascending: false })
    .limit(14);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    today: todayIsoDate(),
    logs: data || [],
  });
}

export async function POST(request: Request) {
  const session = await getRunnerSession();
  if (!session) {
    return NextResponse.json({ error: "Runner session required" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const logDate = parseString(body?.logDate) || todayIsoDate();
  const hrvMs = parseNumber(body?.hrvMs);
  const hrvStatus = parseHrvStatus(body?.hrvStatus);
  const restingHr = parseIntegerInRange(body?.restingHr, 20, 240);
  const sleepScore = parseIntegerInRange(body?.sleepScore, 0, 100);
  const sleepDurationMin = parseIntegerInRange(body?.sleepDurationMin, 0, 1440);
  const bodyBattery = parseIntegerInRange(body?.bodyBattery, 0, 100);
  const soreness = parseIntegerInRange(body?.soreness, 1, 10);
  const illness = parseBoolean(body?.illness);
  const notes = parseString(body?.notes);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(logDate)) {
    return NextResponse.json({ error: "Invalid check-in date" }, { status: 400 });
  }

  if (
    hrvMs == null &&
    hrvStatus == null &&
    restingHr == null &&
    sleepScore == null &&
    sleepDurationMin == null &&
    bodyBattery == null &&
    soreness == null &&
    !illness &&
    !notes
  ) {
    return NextResponse.json({ error: "Add at least one recovery detail" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("recovery_logs")
    .upsert(
      {
        runner_id: session.runnerId,
        log_date: logDate,
        hrv_ms: hrvMs,
        hrv_status: hrvStatus,
        resting_hr: restingHr,
        sleep_score: sleepScore,
        sleep_duration_min: sleepDurationMin,
        body_battery: bodyBattery,
        soreness,
        illness,
        notes: notes || null,
      },
      { onConflict: "runner_id,log_date" }
    )
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: data.id });
}
