import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getCurrentTeamContext } from "@/lib/team-context";
import { supabaseAdmin } from "@/lib/supabase-admin";

export default async function CoachRunnerUploadLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ runnerId: string }>;
}>) {
  const [{ userId }, { runnerId }] = await Promise.all([auth(), params]);
  if (!userId) redirect("/sign-in");

  const context = await getCurrentTeamContext(userId);
  if (!context?.team.id) redirect("/dashboard");

  const { data: runner } = await supabaseAdmin
    .from("runners")
    .select("id")
    .eq("id", runnerId)
    .eq("team_id", context.team.id)
    .eq("portal_status", "active")
    .is("archived_at", null)
    .maybeSingle();

  if (!runner?.id) redirect("/runners");
  return children;
}
