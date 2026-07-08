import { auth, clerkClient, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import CoachHeader from "@/components/CoachHeader";
import { normalizeDistanceUnit } from "@/lib/distance-units";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentTeamContext, getTeamMembers } from "@/lib/team-context";

function displayCoachEmail(email: string | null, clerkId: string | null) {
  if (!email || email === clerkId || email.startsWith("user_")) return "No email saved";
  return email;
}

function appBaseUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.NODE_ENV !== "production" && process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "https://www.hersemita.com";
}

function primaryEmailFromClerkUser(user: Awaited<ReturnType<typeof currentUser>>) {
  if (!user) return "";
  return user.emailAddresses.find((item) => item.id === user.primaryEmailAddressId)?.emailAddress || user.emailAddresses[0]?.emailAddress || "";
}

function teamInviteMetadata(teamId: string, coachId: string) {
  return {
    hersemitaTeamInvite: {
      teamId,
      role: "assistant_coach",
      invitedByCoachId: coachId,
    },
  };
}

async function createAssistantInvitation(email: string, teamId: string, coachId: string) {
  const client = await clerkClient();
  return client.invitations.createInvitation({
    emailAddress: email,
    expiresInDays: 7,
    ignoreExisting: true,
    notify: true,
    redirectUrl: `${appBaseUrl()}/settings`,
    publicMetadata: teamInviteMetadata(teamId, coachId),
  });
}

async function getPendingTeamInvitations(teamId: string) {
  const client = await clerkClient();
  const invitations = await client.invitations.getInvitationList({ status: "pending", limit: 100 });

  return invitations.data
    .filter((invitation) => {
      const metadata = invitation.publicMetadata?.hersemitaTeamInvite as { teamId?: string; role?: string } | undefined;
      return metadata?.teamId === teamId && metadata.role === "assistant_coach";
    })
    .map((invitation) => ({
      id: invitation.id,
      emailAddress: invitation.emailAddress,
      createdAt: invitation.createdAt,
      url: invitation.url || "",
    }));
}

async function applyAcceptedTeamInvite(userId: string) {
  const user = await currentUser();
  const invite = user?.publicMetadata?.hersemitaTeamInvite as
    | { teamId?: string; role?: "assistant_coach"; invitedByCoachId?: string }
    | undefined;

  if (!user || !invite?.teamId || invite.role !== "assistant_coach") return;

  const assistantName = `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Assistant Coach";
  const primaryEmail = primaryEmailFromClerkUser(user) || userId;

  const { data: existingCoach } = await supabaseAdmin
    .from("coaches")
    .select("id")
    .eq("clerk_id", userId)
    .maybeSingle();

  const { data: coach } = existingCoach?.id
    ? await supabaseAdmin
        .from("coaches")
        .update({
          email: primaryEmail,
          name: assistantName,
          active_team_id: invite.teamId,
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
          active_team_id: invite.teamId,
        })
        .select("id")
        .single();

  if (!coach?.id) return;

  await supabaseAdmin
    .from("team_coach_memberships")
    .upsert(
      {
        team_id: invite.teamId,
        coach_id: coach.id,
        role: "assistant_coach",
        status: "active",
      },
      { onConflict: "team_id,coach_id" }
    );
}

async function saveCoachProfile(formData: FormData) {
  "use server";

  const { userId } = await auth();
  if (!userId) redirect("/");
  const supabase = await createServerSupabaseClient();

  const name = (formData.get("name") as string)?.trim();
  const schoolName = (formData.get("schoolName") as string)?.trim();
  const preferredDistanceUnit = normalizeDistanceUnit(formData.get("preferredDistanceUnit"));

  if (!name) {
    redirect("/settings?error=Coach%20name%20is%20required.");
  }

  const { data: existingCoach } = await supabase
    .from("coaches")
    .select("id")
    .eq("clerk_id", userId)
    .single();

  const payload = {
    email: userId,
    clerk_id: userId,
    name,
    school_name: schoolName || null,
    preferred_distance_unit: preferredDistanceUnit,
  };

  const { error } = existingCoach?.id
    ? await supabase
        .from("coaches")
        .update(payload)
        .eq("id", existingCoach.id)
    : await supabase
        .from("coaches")
        .insert(payload);

  if (error) {
    redirect(`/settings?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/settings?saved=1");
}

async function addAssistantCoach(formData: FormData) {
  "use server";

  const { userId } = await auth();
  if (!userId) redirect("/");

  const context = await getCurrentTeamContext(userId);
  if (!context || context.role !== "head_coach") {
    redirect("/settings?teamError=Only%20head%20coaches%20can%20add%20assistant%20coaches.");
  }

  const email = ((formData.get("assistantEmail") as string) || "").trim().toLowerCase();
  if (!email) redirect("/settings?teamError=Assistant%20email%20is%20required.");

  const client = await clerkClient();
  const users = await client.users.getUserList({ emailAddress: [email], limit: 1 });
  const user = users.data[0];

  if (!user?.id) {
    const invitation = await createAssistantInvitation(email, context.team.id, context.coach.id);

    if (!invitation?.id) {
      redirect(`/settings?teamError=${encodeURIComponent("Could not send the assistant coach invitation.")}`);
    }

    redirect("/settings?teamInvited=1");
  }

  if (user.id === userId) {
    redirect("/settings?teamError=You%20are%20already%20the%20head%20coach%20for%20this%20team.");
  }

  const assistantName = `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Assistant Coach";
  const primaryEmail = user.emailAddresses.find((item) => item.id === user.primaryEmailAddressId)?.emailAddress || email;

  const { data: existingCoach } = await supabaseAdmin
    .from("coaches")
    .select("id")
    .eq("clerk_id", user.id)
    .maybeSingle();

  const { data: assistantCoach, error: coachError } = existingCoach?.id
    ? await supabaseAdmin
        .from("coaches")
        .update({
          email: primaryEmail,
          name: assistantName,
          active_team_id: context.team.id,
        })
        .eq("id", existingCoach.id)
        .select("id")
        .single()
    : await supabaseAdmin
        .from("coaches")
        .insert({
          email: primaryEmail,
          clerk_id: user.id,
          name: assistantName,
          active_team_id: context.team.id,
        })
        .select("id")
        .single();

  if (coachError || !assistantCoach?.id) {
    redirect(`/settings?teamError=${encodeURIComponent(coachError?.message || "Could not create assistant coach profile.")}`);
  }

  const { error: membershipError } = await supabaseAdmin
    .from("team_coach_memberships")
    .upsert(
      {
        team_id: context.team.id,
        coach_id: assistantCoach.id,
        role: "assistant_coach",
        status: "active",
      },
      { onConflict: "team_id,coach_id" }
    );

  if (membershipError) {
    redirect(`/settings?teamError=${encodeURIComponent(membershipError.message)}`);
  }

  redirect("/settings?teamSaved=1");
}

async function resendAssistantInvitation(formData: FormData) {
  "use server";

  const { userId } = await auth();
  if (!userId) redirect("/");

  const context = await getCurrentTeamContext(userId);
  if (!context || context.role !== "head_coach") {
    redirect("/settings?teamError=Only%20head%20coaches%20can%20resend%20assistant%20coach%20invitations.");
  }

  const invitationId = formData.get("invitationId") as string;
  const email = ((formData.get("email") as string) || "").trim().toLowerCase();
  if (!invitationId || !email) redirect("/settings?teamError=Invitation%20could%20not%20be%20resent.");

  const client = await clerkClient();
  await client.invitations.revokeInvitation(invitationId);
  await createAssistantInvitation(email, context.team.id, context.coach.id);

  redirect("/settings?teamInvited=1");
}

async function cancelAssistantInvitation(formData: FormData) {
  "use server";

  const { userId } = await auth();
  if (!userId) redirect("/");

  const context = await getCurrentTeamContext(userId);
  if (!context || context.role !== "head_coach") {
    redirect("/settings?teamError=Only%20head%20coaches%20can%20cancel%20assistant%20coach%20invitations.");
  }

  const invitationId = formData.get("invitationId") as string;
  if (!invitationId) redirect("/settings?teamError=Invitation%20could%20not%20be%20cancelled.");

  const client = await clerkClient();
  await client.invitations.revokeInvitation(invitationId);

  redirect("/settings?teamSaved=1");
}

async function removeAssistantCoach(formData: FormData) {
  "use server";

  const { userId } = await auth();
  if (!userId) redirect("/");

  const context = await getCurrentTeamContext(userId);
  if (!context || context.role !== "head_coach") {
    redirect("/settings?teamError=Only%20head%20coaches%20can%20remove%20assistant%20coaches.");
  }

  const coachId = formData.get("coachId") as string;
  if (!coachId || coachId === context.coach.id) redirect("/settings");

  await supabaseAdmin
    .from("team_coach_memberships")
    .delete()
    .eq("team_id", context.team.id)
    .eq("coach_id", coachId)
    .eq("role", "assistant_coach");

  redirect("/settings?teamSaved=1");
}

export default async function CoachSettingsPage({
  searchParams,
}: {
  searchParams?: Promise<{ saved?: string; error?: string; teamSaved?: string; teamInvited?: string; teamError?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/");
  const supabase = await createServerSupabaseClient();

  const params = await searchParams;
  await applyAcceptedTeamInvite(userId);

  const { data: coach, error } = await supabase
    .from("coaches")
    .select("id, name, school_name, preferred_distance_unit")
    .eq("clerk_id", userId)
    .single();
  const teamContext = await getCurrentTeamContext(userId);
  const teamMembers = teamContext ? await getTeamMembers(teamContext.team.id) : [];
  const pendingInvitations = teamContext?.role === "head_coach" ? await getPendingTeamInvitations(teamContext.team.id) : [];

  return (
    <div className="min-h-screen hersemita-page-bg text-white">
      <CoachHeader />

      <main className="mx-auto max-w-2xl p-4 sm:p-6 lg:p-8">
        <div className="mb-8 rounded-2xl border border-white/10 bg-white/10 p-5 shadow-2xl shadow-black/10 backdrop-blur sm:p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#00a7ff]">Coach Settings</p>
          <h2 className="mt-2 text-3xl font-bold text-white">Team Identity</h2>
          <p className="mt-2 text-[#cbd5e1]">
            Add your coach name and school or team name so the dashboard and parent messages feel official.
          </p>
        </div>

        {(error || params?.error) && (
          <div className="mb-6 rounded-xl border border-orange-400/30 bg-orange-400/10 p-4 text-sm text-orange-100">
            {params?.error || "Coach profile fields are not set up yet. Run supabase/coach-profile-fields.sql in Supabase SQL Editor, then refresh."}
          </div>
        )}

        {params?.saved && (
          <div className="mb-6 rounded-xl border border-[#00ff67]/30 bg-[#00ff67]/10 p-4 text-sm text-green-100">
            Coach profile saved.
          </div>
        )}

        {params?.teamSaved && (
          <div className="mb-6 rounded-xl border border-[#00ff67]/30 bg-[#00ff67]/10 p-4 text-sm text-green-100">
            Team access updated.
          </div>
        )}

        {params?.teamInvited && (
          <div className="mb-6 rounded-xl border border-[#00ff67]/30 bg-[#00ff67]/10 p-4 text-sm text-green-100">
            Assistant coach invitation sent. It expires in 7 days. If they do not see it, ask them to check spam or use the invite link below.
          </div>
        )}

        {params?.teamError && (
          <div className="mb-6 rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-100">
            {params.teamError}
          </div>
        )}

        <form action={saveCoachProfile} className="space-y-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Coach Display Name</label>
            <input
              name="name"
              type="text"
              required
              defaultValue={coach?.name || ""}
              placeholder="Coach Martinez"
              className="w-full rounded-lg border-2 border-slate-200 px-4 py-3 transition-colors focus:border-[#00a7ff] focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">School or Team Name</label>
            <input
              name="schoolName"
              type="text"
              defaultValue={coach?.school_name || ""}
              placeholder="Central High Cross Country"
              className="w-full rounded-lg border-2 border-slate-200 px-4 py-3 transition-colors focus:border-[#00a7ff] focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Default Distance Unit</label>
            <select
              name="preferredDistanceUnit"
              defaultValue={normalizeDistanceUnit(coach?.preferred_distance_unit)}
              className="w-full rounded-lg border-2 border-slate-200 bg-white px-4 py-3 text-slate-900 transition-colors focus:border-[#00a7ff] focus:outline-none"
            >
              <option value="miles">Miles</option>
              <option value="kilometers">Kilometers</option>
            </select>
            <p className="mt-1 text-sm text-slate-500">
              Runs are stored in miles for now. Runner entry and summaries can display your preferred unit.
            </p>
          </div>

          <button type="submit" className="w-full rounded-lg bg-gradient-to-r from-[#00ff67] to-[#00a7ff] px-4 py-3 text-lg font-bold text-white transition hover:shadow-lg hover:shadow-[#00a7ff]/25">
            Save Profile
          </button>
        </form>

        <section className="mt-8 rounded-xl border border-slate-200 bg-white p-5 text-slate-900 shadow-sm sm:p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-xl font-bold">Team Access</h3>
              <p className="mt-1 text-sm text-slate-600">
                {teamContext
                  ? `${teamContext.team.name} / ${teamContext.role === "head_coach" ? "Head coach" : "Assistant coach"}`
                  : "Team access is not set up for this account yet."}
              </p>
            </div>
          </div>

          {teamContext && (
            <div className="mt-5 space-y-3">
              {teamMembers.map((member) => (
                <div key={member.coach_id} className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-bold text-slate-900">{member.coach?.name || "Coach"}</p>
                    <p className="mt-1 text-sm text-slate-500">{displayCoachEmail(member.coach?.email || null, member.coach?.clerk_id || null)}</p>
                    <p className="mt-1 text-xs font-bold uppercase tracking-wide text-[#007ab8]">
                      {member.role === "head_coach" ? "Head Coach" : "Assistant Coach"}
                    </p>
                  </div>
                  {teamContext.role === "head_coach" && member.role === "assistant_coach" && (
                    <form action={removeAssistantCoach}>
                      <input type="hidden" name="coachId" value={member.coach_id} />
                      <button type="submit" className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-bold text-red-700 transition hover:bg-red-100">
                        Remove
                      </button>
                    </form>
                  )}
                </div>
              ))}
            </div>
          )}

          {teamContext?.role === "head_coach" && (
            <>
              {pendingInvitations.length > 0 && (
                <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
                  <h4 className="font-bold text-slate-900">Pending Invitations</h4>
                  <div className="mt-3 space-y-3">
                    {pendingInvitations.map((invitation) => (
                      <div key={invitation.id} className="rounded-lg border border-amber-200 bg-white p-3">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900">{invitation.emailAddress}</p>
                            <p className="mt-1 text-xs text-slate-500">
                              Sent {new Date(invitation.createdAt).toLocaleDateString()}
                            </p>
                            {invitation.url && (
                              <a href={invitation.url} className="mt-2 block break-all text-sm font-semibold text-[#007ab8] underline">
                                {invitation.url}
                              </a>
                            )}
                          </div>
                          <div className="flex shrink-0 gap-2">
                            <form action={resendAssistantInvitation}>
                              <input type="hidden" name="invitationId" value={invitation.id} />
                              <input type="hidden" name="email" value={invitation.emailAddress} />
                              <button type="submit" className="rounded-lg border border-[#00a7ff]/30 bg-[#00a7ff]/10 px-3 py-2 text-sm font-bold text-[#007ab8] transition hover:bg-[#00a7ff]/20">
                                Resend
                              </button>
                            </form>
                            <form action={cancelAssistantInvitation}>
                              <input type="hidden" name="invitationId" value={invitation.id} />
                              <button type="submit" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700 transition hover:bg-red-100">
                                Cancel
                              </button>
                            </form>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <form action={addAssistantCoach} className="mt-6 rounded-lg border border-[#00a7ff]/20 bg-[#00a7ff]/5 p-4">
                <label className="mb-2 block text-sm font-semibold text-slate-700">Add Assistant Coach</label>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <input
                    name="assistantEmail"
                    type="email"
                    required
                    placeholder="assistant@example.com"
                    className="min-w-0 flex-1 rounded-lg border-2 border-slate-200 px-4 py-3 transition-colors focus:border-[#00a7ff] focus:outline-none"
                  />
                  <button type="submit" className="rounded-lg bg-slate-900 px-5 py-3 font-bold text-white transition hover:bg-slate-800">
                    Add
                  </button>
                </div>
                <p className="mt-2 text-sm text-slate-500">
                  If they do not have a Hersemita account yet, they will receive an email invitation that expires in 7 days.
                </p>
              </form>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
