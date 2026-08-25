import { currentUser } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export type PendingAdultRunner = {
  id: string;
  team_id: string;
  first_name: string;
  last_name: string;
  grade: number | null;
  username: string;
  runner_email: string;
};

function verifiedEmails(user: Awaited<ReturnType<typeof currentUser>>) {
  return Array.from(new Set((user?.emailAddresses || [])
    .filter((email) => (email.verification as { status?: string } | null)?.status === "verified")
    .map((email) => email.emailAddress.trim().toLowerCase())
    .filter(Boolean)));
}

export async function getPendingAdultRunners(userId: string) {
  const user = await currentUser();
  if (!user || user.id !== userId) return { emails: [], runners: [] as PendingAdultRunner[] };
  const emails = verifiedEmails(user);
  if (emails.length === 0) return { emails, runners: [] as PendingAdultRunner[] };

  const { data } = await supabaseAdmin
    .from("runners")
    .select("id, team_id, first_name, last_name, grade, username, runner_email")
    .eq("age_status", "adult_18_plus")
    .eq("portal_status", "pending_adult_consent")
    .in("runner_email", emails);

  return { emails, runners: (data || []) as PendingAdultRunner[] };
}
