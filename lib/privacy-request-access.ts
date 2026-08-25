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
  const guardianIds = (parentContext?.guardians || []).map((guardian) => guardian.id);
  if (guardianIds.length > 0) {
    const { data: guardianLinks } = await supabaseAdmin
      .from("runner_guardians")
      .select("runners!inner(id, team_id, first_name, last_name, age_status, adult_parent_access_enabled)")
      .in("guardian_id", guardianIds);

    for (const link of guardianLinks || []) {
      const linked = Array.isArray(link.runners) ? link.runners[0] : link.runners;
      if (!linked?.id) continue;
      // Withdrawal or suspension must not remove a guardian's ability to
      // request retained records. Adult-runner records remain subject to the
      // adult's explicit parent-access choice.
      if (linked.age_status === "adult_18_plus" && !linked.adult_parent_access_enabled) continue;
      if (!subjects.has(linked.id)) {
        subjects.set(linked.id, {
          id: linked.id,
          teamId: linked.team_id,
          name: `${linked.first_name} ${linked.last_name}`.trim(),
          role: "parent_guardian",
        });
      }
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
