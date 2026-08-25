import { currentUser } from "@clerk/nextjs/server";
import { getParentPortalContext } from "@/lib/parent-context";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentTeamContext } from "@/lib/team-context";

export type PrivacyRequestSubject = {
  id: string;
  teamId: string;
  name: string;
  role: "coach" | "parent_guardian" | "adult_runner";
};

export async function getPrivacyRequestSubjects(userId: string): Promise<PrivacyRequestSubject[]> {
  const subjects = new Map<string, PrivacyRequestSubject>();
  const coachContext = await getCurrentTeamContext(userId);
  if (coachContext) {
    const { data } = await supabaseAdmin
      .from("runners")
      .select("id, team_id, first_name, last_name")
      .eq("team_id", coachContext.team.id)
      .order("last_name");
    for (const runner of data || []) {
      subjects.set(runner.id, {
        id: runner.id,
        teamId: runner.team_id,
        name: `${runner.first_name} ${runner.last_name}`.trim(),
        role: "coach",
      });
    }
  }

  const parentContext = await getParentPortalContext(userId);
  for (const runner of parentContext?.runners || []) {
    if (!subjects.has(runner.id)) {
      subjects.set(runner.id, {
        id: runner.id,
        teamId: runner.team_id,
        name: `${runner.first_name} ${runner.last_name}`.trim(),
        role: "parent_guardian",
      });
    }
  }

  const user = await currentUser();
  const verifiedEmails = (user?.emailAddresses || [])
    .filter((email) => email.verification?.status === "verified")
    .map((email) => email.emailAddress.trim().toLowerCase());
  if (verifiedEmails.length > 0) {
    const { data } = await supabaseAdmin
      .from("runners")
      .select("id, team_id, first_name, last_name")
      .eq("age_status", "adult_18_plus")
      .in("runner_email", verifiedEmails);
    for (const runner of data || []) {
      subjects.set(runner.id, {
        id: runner.id,
        teamId: runner.team_id,
        name: `${runner.first_name} ${runner.last_name}`.trim(),
        role: "adult_runner",
      });
    }
  }

  return Array.from(subjects.values()).sort((a, b) => a.name.localeCompare(b.name));
}
