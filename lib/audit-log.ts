import { supabaseAdmin } from "@/lib/supabase-admin";

type AuditEvent = {
  teamId?: string | null;
  actorCoachId?: string | null;
  actorClerkId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
};

export async function logAuditEvent({
  teamId,
  actorCoachId,
  actorClerkId,
  action,
  entityType,
  entityId,
  metadata = {},
}: AuditEvent) {
  const { error } = await supabaseAdmin.from("audit_logs").insert({
    team_id: teamId || null,
    actor_coach_id: actorCoachId || null,
    actor_clerk_id: actorClerkId || null,
    action,
    entity_type: entityType,
    entity_id: entityId || null,
    metadata,
  });

  if (error) {
    console.error("Audit log write failed:", error.message);
  }
}
