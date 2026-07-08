import { supabaseAdmin } from "@/lib/supabase-admin";

export type TeamCoachRole = "head_coach" | "assistant_coach";

export type CurrentTeamContext = {
  coach: {
    id: string;
    name: string | null;
    email: string | null;
    clerk_id: string;
    active_team_id: string | null;
  };
  team: {
    id: string;
    name: string;
    school_name: string | null;
    owner_coach_id: string | null;
    default_distance_unit: string;
  };
  role: TeamCoachRole;
};

type MembershipRecord = {
  role: TeamCoachRole;
  teams:
    | CurrentTeamContext["team"]
    | CurrentTeamContext["team"][]
    | null;
};

export async function getCurrentTeamContext(userId: string): Promise<CurrentTeamContext | null> {
  const { data: coach } = await supabaseAdmin
    .from("coaches")
    .select("id, name, email, clerk_id, active_team_id")
    .eq("clerk_id", userId)
    .maybeSingle();

  if (!coach?.id) return null;

  const { data: memberships } = await supabaseAdmin
    .from("team_coach_memberships")
    .select("role, teams(id, name, school_name, owner_coach_id, default_distance_unit)")
    .eq("coach_id", coach.id)
    .eq("status", "active");

  const safeMemberships = ((memberships || []) as MembershipRecord[])
    .map((membership) => ({
      role: membership.role,
      team: Array.isArray(membership.teams) ? membership.teams[0] || null : membership.teams,
    }))
    .filter((membership): membership is { role: TeamCoachRole; team: CurrentTeamContext["team"] } => Boolean(membership.team?.id));

  const selected =
    safeMemberships.find((membership) => membership.team.id === coach.active_team_id) ||
    safeMemberships[0];

  if (!selected) return null;

  return {
    coach,
    team: selected.team,
    role: selected.role,
  };
}

export async function getTeamMembers(teamId: string) {
  const { data } = await supabaseAdmin
    .from("team_coach_memberships")
    .select("team_id, coach_id, role, status, created_at, coaches(id, name, email, clerk_id)")
    .eq("team_id", teamId)
    .order("created_at", { ascending: true });

  return (data || []).map((membership: any) => ({
    team_id: membership.team_id as string,
    coach_id: membership.coach_id as string,
    role: membership.role as TeamCoachRole,
    status: membership.status as string,
    created_at: membership.created_at as string,
    coach: Array.isArray(membership.coaches) ? membership.coaches[0] : membership.coaches,
  }));
}
