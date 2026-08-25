import crypto from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";

type SecurityEvent = {
  teamId?: string | null;
  actorType: "anonymous" | "runner" | "coach" | "parent" | "adult" | "service";
  actorReference?: string | null;
  eventType: string;
  severity: "info" | "warning" | "high" | "critical";
  route?: string | null;
  outcome: string;
  metadata?: Record<string, string | number | boolean | null>;
};

export function securityReference(value: string | null | undefined) {
  if (!value) return null;
  const secret = process.env.SECURITY_EVENT_HASH_SECRET || process.env.RUNNER_SESSION_SECRET;
  if (!secret) return process.env.NODE_ENV === "production" ? null : crypto.createHash("sha256").update(value).digest("hex");
  return crypto.createHmac("sha256", secret).update(value).digest("hex");
}

export async function logSecurityEvent(event: SecurityEvent) {
  const metadata = Object.fromEntries(Object.entries(event.metadata || {}).slice(0, 20));
  const { error } = await supabaseAdmin.from("security_events").insert({
    team_id: event.teamId || null,
    actor_type: event.actorType,
    actor_reference: event.actorReference || null,
    event_type: event.eventType.slice(0, 100),
    severity: event.severity,
    route: event.route?.slice(0, 200) || null,
    outcome: event.outcome.slice(0, 100),
    metadata,
  });
  if (error && process.env.NODE_ENV !== "production") console.error("Security event write failed:", error.message);
}
