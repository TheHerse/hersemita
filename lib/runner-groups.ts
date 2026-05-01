import { supabase } from "@/lib/supabase";

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

export async function ensureDefaultRunnerGroups(coachId: string) {
  return supabase.from("runner_groups").upsert(
    DEFAULT_RUNNER_GROUPS.map((group) => ({
      coach_id: coachId,
      name: group.name,
      color: group.color,
    })),
    { onConflict: "coach_id,name" }
  );
}

export function gradeGroupName(grade: number) {
  return `${grade}th`;
}

export async function syncRunnerAutomaticGroups({
  coachId,
  runnerId,
  grade,
  division,
}: {
  coachId: string;
  runnerId: string;
  grade: number;
  division: "Boys" | "Girls";
}) {
  await ensureDefaultRunnerGroups(coachId);

  const automaticNames = DEFAULT_RUNNER_GROUP_NAMES;
  const { data: automaticGroups } = await supabase
    .from("runner_groups")
    .select("id, name")
    .eq("coach_id", coachId)
    .in("name", automaticNames);

  const automaticGroupIds = automaticGroups?.map((group) => group.id) || [];
  const desiredGroupIds =
    automaticGroups
      ?.filter((group) => group.name === gradeGroupName(grade) || group.name === division)
      .map((group) => group.id) || [];

  if (automaticGroupIds.length > 0) {
    await supabase
      .from("runner_group_members")
      .delete()
      .eq("runner_id", runnerId)
      .in("group_id", automaticGroupIds);
  }

  if (desiredGroupIds.length > 0) {
    await supabase.from("runner_group_members").insert(
      desiredGroupIds.map((groupId) => ({
        group_id: groupId,
        runner_id: runnerId,
      }))
    );
  }
}
