import { currentUser } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export type ParentGuardianContact = {
  id: string;
  team_id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  clerk_id: string | null;
  portal_enabled: boolean;
};

export type ParentRunner = {
  id: string;
  team_id: string;
  first_name: string;
  last_name: string;
  grade: number | null;
  username: string | null;
  portal_status: "pending_parent_consent" | "active" | "suspended" | "revoked";
  age_status: "unknown" | "under_13" | "minor_13_to_17" | "adult_18_plus";
  adult_parent_access_enabled: boolean;
};

export type ParentPortalContext = {
  clerkId: string;
  emails: string[];
  guardians: ParentGuardianContact[];
  runners: ParentRunner[];
  pendingRunners: ParentRunner[];
};

type RunnerLinkRow = {
  runners: ParentRunner | ParentRunner[] | null;
};

function normalizedEmails(user: Awaited<ReturnType<typeof currentUser>>) {
  return Array.from(
    new Set(
      (user?.emailAddresses || [])
        .filter((email) => {
          const verification = email.verification as { status?: string } | null | undefined;
          return verification?.status === "verified" || email.id === user?.primaryEmailAddressId;
        })
        .map((email) => email.emailAddress.trim().toLowerCase())
        .filter(Boolean)
    )
  );
}

export async function getParentPortalContext(userId: string): Promise<ParentPortalContext | null> {
  const user = await currentUser();
  const emails = normalizedEmails(user);

  if (emails.length > 0) {
    const { data: claimableGuardians } = await supabaseAdmin
      .from("guardian_contacts")
      .select("id, email, clerk_id")
      .is("clerk_id", null)
      .eq("portal_enabled", true)
      .not("email", "is", null);

    const claimableIds = (claimableGuardians || [])
      .filter((guardian) => emails.includes(String(guardian.email || "").trim().toLowerCase()))
      .map((guardian) => guardian.id);

    if (claimableIds.length > 0) {
      await supabaseAdmin
        .from("guardian_contacts")
        .update({
          clerk_id: userId,
          last_portal_claimed_at: new Date().toISOString(),
        })
        .in("id", claimableIds);
    }
  }

  const { data: guardians } = await supabaseAdmin
    .from("guardian_contacts")
    .select("id, team_id, first_name, last_name, phone, email, clerk_id, portal_enabled")
    .eq("clerk_id", userId)
    .eq("portal_enabled", true);

  const safeGuardians = (guardians || []) as ParentGuardianContact[];
  if (safeGuardians.length === 0) {
    return {
      clerkId: userId,
      emails,
      guardians: [],
      runners: [],
      pendingRunners: [],
    };
  }

  const guardianIds = safeGuardians.map((guardian) => guardian.id);
  const { data: runnerLinks } = await supabaseAdmin
    .from("runner_guardians")
    .select("runners!inner(id, team_id, first_name, last_name, grade, username, portal_status, age_status, adult_parent_access_enabled, archived_at)")
    .is("runners.archived_at", null)
    .in("guardian_id", guardianIds);

  const runnersById = new Map<string, ParentRunner>();

  (runnerLinks || [])
    .map((link: RunnerLinkRow) => (Array.isArray(link.runners) ? link.runners[0] : link.runners))
    .filter((runner): runner is ParentRunner => Boolean(runner?.id))
    .forEach((runner) => {
      runnersById.set(runner.id, runner);
    });

  return {
    clerkId: userId,
    emails,
    guardians: safeGuardians,
    runners: Array.from(runnersById.values()).filter((runner) =>
      runner.portal_status === "active" &&
      (runner.age_status !== "adult_18_plus" || runner.adult_parent_access_enabled)
    ),
    pendingRunners: Array.from(runnersById.values()).filter((runner) =>
      runner.portal_status === "pending_parent_consent" && runner.age_status !== "adult_18_plus"
    ),
  };
}
