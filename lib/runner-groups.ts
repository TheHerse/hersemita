import { supabase } from "@/lib/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

export type RunnerDivision = "Boys" | "Girls" | "None / Other";

export const DEFAULT_RUNNER_GROUPS = [
  { name: "9th", color: "#00a7ff" },
  { name: "10th", color: "#00ff67" },
  { name: "11th", color: "#f97316" },
  { name: "12th", color: "#7c3aed" },
  { name: "Boys", color: "#ef4444" },
  { name: "Girls", color: "#14b8a6" },
];

export const DEFAULT_RUNNER_GROUP_NAMES = DEFAULT_RUNNER_GROUPS.map((group) => group.name);

export function getStripedGroupStyle(color: string) {
  return {
    borderColor: color,
    backgroundImage: `repeating-linear-gradient(135deg, ${color}55 0, ${color}55 6px, ${color}26 6px, ${color}26 12px)`,
    backgroundColor: `${color}22`,
  };
}

export function getSolidGroupStyle(color: string) {
  return {
    borderColor: color,
    backgroundColor: color,
  };
}

export async function ensureDefaultRunnerGroups(coachId: string, client: SupabaseClient = supabase, teamId?: string | null) {
  return client.from("runner_groups").upsert(
    DEFAULT_RUNNER_GROUPS.map((group) => ({
      coach_id: coachId,
      team_id: teamId || null,
      name: group.name,
      color: group.color,
    })),
    { onConflict: teamId ? "team_id,name" : "coach_id,name" }
  );
}

export function gradeGroupName(grade: number) {
  return `${grade}th`;
}

export async function syncRunnerAutomaticGroups({
  coachId,
  teamId,
  runnerId,
  grade,
  division,
  client = supabase,
}: {
  coachId: string;
  teamId?: string | null;
  runnerId: string;
  grade: number;
  division: RunnerDivision;
  client?: SupabaseClient;
}) {
  await ensureDefaultRunnerGroups(coachId, client, teamId);

  const automaticNames = DEFAULT_RUNNER_GROUP_NAMES;
  let automaticGroupsQuery = client
    .from("runner_groups")
    .select("id, name")
    .in("name", automaticNames);

  automaticGroupsQuery = teamId ? automaticGroupsQuery.eq("team_id", teamId) : automaticGroupsQuery.eq("coach_id", coachId);

  const { data: automaticGroups } = await automaticGroupsQuery;

  const automaticGroupIds = automaticGroups?.map((group) => group.id) || [];
  const desiredGroupIds =
    automaticGroups
      ?.filter((group) => group.name === gradeGroupName(grade) || (division !== "None / Other" && group.name === division))
      .map((group) => group.id) || [];

  if (automaticGroupIds.length > 0) {
    await client
      .from("runner_group_members")
      .delete()
      .eq("runner_id", runnerId)
      .in("group_id", automaticGroupIds);
  }

  if (desiredGroupIds.length > 0) {
    await client.from("runner_group_members").insert(
      desiredGroupIds.map((groupId) => ({
        group_id: groupId,
        runner_id: runnerId,
      }))
    );
  }
}
