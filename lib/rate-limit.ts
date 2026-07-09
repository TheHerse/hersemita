import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";

type RateLimitOptions = {
  key: string;
  windowMs: number;
  max: number;
};

type RateLimitResult = {
  limited: boolean;
  remaining: number;
  resetAt: string | null;
};

function hashedRateKey(key: string) {
  const secret = process.env.RATE_LIMIT_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "hersemita-dev-rate-limit";
  return crypto.createHmac("sha256", secret).update(key).digest("hex");
}

export async function checkRateLimit({ key, windowMs, max }: RateLimitOptions): Promise<RateLimitResult> {
  const windowSeconds = Math.max(1, Math.ceil(windowMs / 1000));
  const { data, error } = await supabaseAdmin.rpc("check_rate_limit", {
    p_rate_key: hashedRateKey(key),
    p_window_seconds: windowSeconds,
    p_max_attempts: max,
  });

  if (error) {
    throw new Error(error.message);
  }

  const result = Array.isArray(data) ? data[0] : data;

  return {
    limited: Boolean(result?.limited),
    remaining: Number(result?.remaining || 0),
    resetAt: result?.reset_at || null,
  };
}

export function rateLimitKey(parts: Array<string | null | undefined>) {
  return parts.map((part) => (part || "unknown").replace(/[^a-zA-Z0-9_.:-]/g, "_")).join(":");
}

export function clientIpFromHeaders(headers: Headers) {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    "unknown"
  );
}
