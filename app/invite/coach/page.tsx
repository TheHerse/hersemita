import { auth, currentUser } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { logAuditEvent } from "@/lib/audit-log";
import { hashInviteToken } from "@/lib/invite-tokens";
import { supabaseAdmin } from "@/lib/supabase-admin";

type InviteSearchParams = {
  token?: string;
};

type TeamInvite = {
  id: string;
  team_id: string;
  email: string;
  role: "assistant_coach";
  invited_by_coach_id: string | null;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
};

function primaryEmailFromClerkUser(user: Awaited<ReturnType<typeof currentUser>>) {
  if (!user) return "";
  return user.emailAddresses.find((item) => item.id === user.primaryEmailAddressId)?.emailAddress || user.emailAddresses[0]?.emailAddress || "";
}

function verifiedEmailsFromClerkUser(user: Awaited<ReturnType<typeof currentUser>>) {
  return (user?.emailAddresses || [])
    .filter((email) => {
      const verification = email.verification as { status?: string } | null | undefined;
      return verification?.status === "verified" || email.id === user?.primaryEmailAddressId;
    })
    .map((email) => email.emailAddress.trim().toLowerCase())
    .filter(Boolean);
}

function ErrorPanel({ title, message }: { title: string; message: string }) {
  return (
    <div className="min-h-screen hersemita-page-bg px-4 py-12 text-white sm:px-6 lg:px-8">
      <main className="mx-auto max-w-xl rounded-2xl border border-white/10 bg-white/10 p-6 shadow-2xl shadow-black/10 backdrop-blur">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#00a7ff]">Team Invitation</p>
        <h1 className="mt-3 text-3xl font-bold">{title}</h1>
        <p className="mt-3 text-[#cbd5e1]">{message}</p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link href="/settings" className="rounded-lg bg-white px-4 py-3 text-center text-sm font-bold text-slate-900 transition hover:bg-slate-100">
            Go to Settings
          </Link>
          <Link href="/" className="rounded-lg border border-white/15 bg-white/10 px-4 py-3 text-center text-sm font-bold text-white transition hover:bg-white/15">
            Go Home
          </Link>
        </div>
      </main>
    </div>
  );
}

export default async function CoachInvitePage({
  searchParams,
}: {
  searchParams?: Promise<InviteSearchParams>;
}) {
  const params = await searchParams;
  const token = String(params?.token || "").trim();

  if (!token) {
    return <ErrorPanel title="Invitation link is missing" message="Ask the head coach to resend the assistant coach invitation." />;
  }

  const { userId } = await auth();
  const redirectUrl = `/invite/coach?token=${encodeURIComponent(token)}`;
  if (!userId) redirect(`/sign-in?redirect_url=${encodeURIComponent(redirectUrl)}`);

  const user = await currentUser();
  const emails = verifiedEmailsFromClerkUser(user);
  const primaryEmail = primaryEmailFromClerkUser(user).trim().toLowerCase() || userId;
  const tokenHash = hashInviteToken(token);

  const { data: invite } = await supabaseAdmin
    .from("team_invitations")
    .select("id, team_id, email, role, invited_by_coach_id, expires_at, accepted_at, revoked_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  const teamInvite = invite as TeamInvite | null;

  if (!teamInvite?.id) {
    return <ErrorPanel title="Invitation was not found" message="This link may be invalid. Ask the head coach to resend the invitation." />;
  }

  if (teamInvite.revoked_at) {
    return <ErrorPanel title="Invitation was cancelled" message="Ask the head coach to send a new assistant coach invitation." />;
  }

  if (teamInvite.accepted_at) {
    return <ErrorPanel title="Invitation already accepted" message="This invitation has already been used. Sign in with the accepted coach account or ask the head coach to send a new invite." />;
  }

  if (new Date(teamInvite.expires_at).getTime() <= Date.now()) {
    return <ErrorPanel title="Invitation expired" message="Assistant coach invitations expire after 7 days. Ask the head coach to resend it." />;
  }

  if (!emails.includes(teamInvite.email)) {
    return (
      <ErrorPanel
        title="Use the invited email"
        message={`This invitation was sent to ${teamInvite.email}. Sign in or create an account with that same email to join the team.`}
      />
    );
  }

  const assistantName = `${user?.firstName || ""} ${user?.lastName || ""}`.trim() || "Assistant Coach";
  const { data: existingCoach } = await supabaseAdmin
    .from("coaches")
    .select("id")
    .eq("clerk_id", userId)
    .maybeSingle();

  const { data: coach, error: coachError } = existingCoach?.id
    ? await supabaseAdmin
        .from("coaches")
        .update({
          email: primaryEmail,
          name: assistantName,
          active_team_id: teamInvite.team_id,
        })
        .eq("id", existingCoach.id)
        .select("id")
        .single()
    : await supabaseAdmin
        .from("coaches")
        .insert({
          email: primaryEmail,
          clerk_id: userId,
          name: assistantName,
          active_team_id: teamInvite.team_id,
        })
        .select("id")
        .single();

  if (coachError || !coach?.id) {
    return <ErrorPanel title="Could not create coach access" message={coachError?.message || "Refresh and try the invite link again."} />;
  }

  const { error: membershipError } = await supabaseAdmin
    .from("team_coach_memberships")
    .upsert(
      {
        team_id: teamInvite.team_id,
        coach_id: coach.id,
        role: "assistant_coach",
        status: "active",
      },
      { onConflict: "team_id,coach_id" }
    );

  if (membershipError) {
    return <ErrorPanel title="Could not join team" message={membershipError.message} />;
  }

  await supabaseAdmin
    .from("team_invitations")
    .update({
      accepted_at: new Date().toISOString(),
      accepted_by_coach_id: coach.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", teamInvite.id);

  await logAuditEvent({
    teamId: teamInvite.team_id,
    actorCoachId: coach.id,
    actorClerkId: userId,
    action: "assistant.invite_accepted",
    entityType: "team_invitation",
    entityId: teamInvite.id,
    metadata: {
      email: teamInvite.email,
      invitedByCoachId: teamInvite.invited_by_coach_id,
    },
  });

  redirect("/settings?teamSaved=1");
}
