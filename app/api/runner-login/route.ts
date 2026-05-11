import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { setRunnerSession } from "@/lib/runner-session";

const attempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 8;

function normalizeUsername(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeCode(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isRateLimited(key: string) {
  const now = Date.now();
  const current = attempts.get(key);

  if (!current || current.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }

  current.count += 1;
  return current.count > MAX_ATTEMPTS;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const username = normalizeUsername(body?.username);
  const code = normalizeCode(body?.code);
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const rateLimitKey = `${forwardedFor || "unknown"}:${username}`;

  if (!username || !/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: "Invalid username or access code" }, { status: 401 });
  }

  if (isRateLimited(rateLimitKey)) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }

  const { data: runner, error } = await supabaseAdmin
    .from("runners")
    .select("id, first_name, last_name")
    .eq("username", username)
    .eq("access_code", code)
    .maybeSingle();

  if (error || !runner) {
    return NextResponse.json({ error: "Invalid username or access code" }, { status: 401 });
  }

  const runnerName = `${runner.first_name} ${runner.last_name}`;
  await setRunnerSession(runner.id, runnerName);

  return NextResponse.json({
    runner: {
      id: runner.id,
      name: runnerName,
    },
  });
}
