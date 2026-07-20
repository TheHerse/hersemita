import { auth, clerkClient } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { CSSProperties } from "react";
import PhoneNumberInput from "@/components/PhoneNumberInput";
import CoachHeader from "@/components/CoachHeader";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { appBaseUrl } from "@/lib/app-url";
import { logAuditEvent } from "@/lib/audit-log";
import { makeAccessCode, makeRunnerUsername } from "@/lib/runner-access";
import { linkGuardianToRunner, upsertGuardianContact } from "@/lib/guardian-contacts";
import {
  DEFAULT_RUNNER_GROUP_NAMES,
  ensureDefaultRunnerGroups,
  syncRunnerAutomaticGroups,
  type RunnerDivision,
} from "@/lib/runner-groups";
import { getCurrentTeamContext } from "@/lib/team-context";
import { checkRateLimit, rateLimitKey } from "@/lib/rate-limit";

type Group = {
  id: string;
  name: string;
  color: string;
};

type PrimaryGuardian = {
  id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  email?: string | null;
  clerk_id?: string | null;
  portal_enabled?: boolean | null;
};

type GuardianLink = {
  guardian_id: string;
  relationship: string | null;
  is_primary: boolean;
  guardian_contacts: PrimaryGuardian | PrimaryGuardian[] | null;
};

const PARENT_INVITE_WINDOW_MS = 60 * 60 * 1000;
const MAX_PARENT_INVITES = 10;

function groupColorVar(color: string) {
  return { "--group-color": color } as CSSProperties;
}

function relationshipLabel(value: string | null) {
  if (value === "parent_guardian") return "Parent/guardian";
  if (!value) return "Guardian";
  return value.replaceAll("_", " ");
}

function guardianPortalStatus(guardian: PrimaryGuardian | null) {
  if (!guardian?.email) return { label: "Email needed", className: "border-amber-300/50 bg-amber-400/10 text-amber-100" };
  if (guardian.portal_enabled === false) return { label: "Portal disabled", className: "border-slate-300/30 bg-white/10 text-slate-200" };
  if (guardian.clerk_id) return { label: "Linked account", className: "border-[#00ff67]/40 bg-[#00ff67]/10 text-[#bbf7d0]" };
  return { label: "Invite needed", className: "border-[#00a7ff]/40 bg-[#00a7ff]/10 text-[#bae6fd]" };
}

async function getTeamAccess(userId: string) {
  const context = await getCurrentTeamContext(userId);
  return {
    coachId: context?.team.owner_coach_id || context?.coach.id,
    teamId: context?.team.id,
  };
}

async function updateRunner(runnerId: string, formData: FormData) {
  "use server";

  const { userId } = await auth();
  if (!userId) redirect("/");
  const supabase = await createServerSupabaseClient();

  const { coachId, teamId } = await getTeamAccess(userId);
  if (!coachId || !teamId) redirect("/runners");

  const firstName = (formData.get("firstName") as string)?.trim();
  const lastName = (formData.get("lastName") as string)?.trim();
  const grade = parseInt(formData.get("grade") as string);
  const division = formData.get("division") as RunnerDivision;
  const parentPhone = (formData.get("parentPhone") as string)?.trim();
  const customGroupIds = formData.getAll("groups") as string[];

  const { data: runner } = await supabase
    .from("runners")
    .select("id")
    .eq("id", runnerId)
    .eq("team_id", teamId)
    .single();

  if (!runner?.id || !firstName || !lastName || !grade || !division) {
    redirect("/runners");
  }

  const { error } = await supabase
    .from("runners")
    .update({
      first_name: firstName,
      last_name: lastName,
      grade,
      parent_phone: parentPhone || null,
    })
    .eq("id", runner.id)
    .eq("team_id", teamId);

  if (error) {
    throw new Error(error.message);
  }

  await syncRunnerAutomaticGroups({
    coachId,
    teamId,
    runnerId: runner.id,
    grade,
    division,
    client: supabase,
  });

  const { data: allowedCustomGroups } = customGroupIds.length
    ? await supabase
        .from("runner_groups")
        .select("id")
        .eq("team_id", teamId)
        .in("id", customGroupIds)
    : { data: [] };

  const { data: allCoachGroups } = await supabase
    .from("runner_groups")
    .select("id, name")
    .eq("team_id", teamId);

  const customGroupIdsForCoach =
    allCoachGroups
      ?.filter((group) => !DEFAULT_RUNNER_GROUP_NAMES.includes(group.name))
      .map((group) => group.id) || [];
  if (customGroupIdsForCoach.length > 0) {
    await supabase
      .from("runner_group_members")
      .delete()
      .eq("runner_id", runner.id)
      .in("group_id", customGroupIdsForCoach);
  }

  const allowedIds = allowedCustomGroups?.map((group) => group.id) || [];
  if (allowedIds.length > 0) {
    await supabase.from("runner_group_members").insert(
      allowedIds.map((groupId) => ({
        group_id: groupId,
        runner_id: runner.id,
      }))
    );
  }

  revalidatePath("/runners");
  revalidatePath(`/runners/${runnerId}/edit`);
  redirect("/runners");
}

async function rotateRunnerCredentials(runnerId: string) {
  "use server";

  const { userId } = await auth();
  if (!userId) redirect("/");
  const supabase = await createServerSupabaseClient();

  const { teamId } = await getTeamAccess(userId);
  if (!teamId) redirect("/runners");

  const { data: runner } = await supabase
    .from("runners")
    .select("first_name, last_name")
    .eq("id", runnerId)
    .eq("team_id", teamId)
    .single();

  if (!runner) redirect("/runners");

  const { error } = await supabase
    .from("runners")
    .update({
      access_code: makeAccessCode(),
      username: makeRunnerUsername(runner.first_name, runner.last_name),
    })
    .eq("id", runnerId)
    .eq("team_id", teamId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/runners/${runnerId}/edit`);
  redirect(`/runners/${runnerId}/edit`);
}

function parentInviteMetadata(teamId: string, runnerId: string, guardianId: string, coachId: string) {
  return {
    hersemitaParentInvite: {
      teamId,
      runnerId,
      guardianId,
      role: "parent_guardian",
      invitedByCoachId: coachId,
    },
  };
}

async function sendParentPortalInvite(runnerId: string, guardianId: string) {
  "use server";

  const { userId } = await auth();
  if (!userId) redirect("/");

  const { coachId, teamId } = await getTeamAccess(userId);
  if (!coachId || !teamId) redirect("/runners");

  const limit = await checkRateLimit({
    key: rateLimitKey(["parent-portal-invite", teamId, coachId]),
    windowMs: PARENT_INVITE_WINDOW_MS,
    max: MAX_PARENT_INVITES,
  });

  if (limit.limited) {
    redirect(`/runners/${runnerId}/edit?parentInviteError=${encodeURIComponent("Too many parent invite attempts. Try again later.")}`);
  }

  const supabase = await createServerSupabaseClient();
  const { data: runner } = await supabase
    .from("runners")
    .select("id, first_name, last_name")
    .eq("id", runnerId)
    .eq("team_id", teamId)
    .single();

  if (!runner?.id) redirect("/runners");

  const { data: guardianLink } = await supabase
    .from("runner_guardians")
    .select("guardian_contacts(id, email, clerk_id, portal_enabled)")
    .eq("runner_id", runner.id)
    .eq("guardian_id", guardianId)
    .maybeSingle();

  const guardian = guardianLink?.guardian_contacts as PrimaryGuardian | PrimaryGuardian[] | null | undefined;
  const primaryGuardian = Array.isArray(guardian) ? guardian[0] : guardian;
  const email = String(primaryGuardian?.email || "").trim().toLowerCase();

  if (!primaryGuardian?.id || !email) {
    redirect(`/runners/${runnerId}/edit?parentInviteError=${encodeURIComponent("Add a parent portal email before sending an invite.")}`);
  }

  if (primaryGuardian.portal_enabled === false) {
    redirect(`/runners/${runnerId}/edit?parentInviteError=${encodeURIComponent("Parent portal access is disabled for this guardian.")}`);
  }

  if (primaryGuardian.clerk_id) {
    revalidatePath(`/runners/${runnerId}/edit`);
    redirect(`/runners/${runnerId}/edit?parentInvite=linked`);
  }

  const client = await clerkClient();
  const users = await client.users.getUserList({ emailAddress: [email], limit: 1 });
  const existingUser = users.data[0];

  if (existingUser?.id) {
    await supabase
      .from("guardian_contacts")
      .update({
        clerk_id: existingUser.id,
        last_portal_claimed_at: new Date().toISOString(),
      })
      .eq("id", primaryGuardian.id)
      .eq("team_id", teamId);

    await logAuditEvent({
      teamId,
      actorCoachId: coachId,
      actorClerkId: userId,
      action: "parent_portal.linked_existing_account",
      entityType: "guardian_contact",
      entityId: primaryGuardian.id,
      metadata: {
        email,
        runnerId: runner.id,
      },
    });

    redirect(`/runners/${runnerId}/edit?parentInvite=linked`);
  }

  const invitation = await client.invitations.createInvitation({
    emailAddress: email,
    expiresInDays: 7,
    ignoreExisting: true,
    notify: true,
    redirectUrl: `${appBaseUrl()}/parent/dashboard`,
    publicMetadata: parentInviteMetadata(teamId, runner.id, primaryGuardian.id, coachId),
  });

  await logAuditEvent({
    teamId,
    actorCoachId: coachId,
    actorClerkId: userId,
    action: "parent_portal.invited",
    entityType: "guardian_contact",
    entityId: primaryGuardian.id,
    metadata: {
      email,
      runnerId: runner.id,
      invitationId: invitation.id,
      expiresInDays: 7,
    },
  });

  revalidatePath(`/runners/${runnerId}/edit`);
  redirect(`/runners/${runnerId}/edit?parentInvite=sent`);
}

async function addRunnerGuardian(runnerId: string, formData: FormData) {
  "use server";

  const { userId } = await auth();
  if (!userId) redirect("/");

  const supabase = await createServerSupabaseClient();
  const { coachId, teamId } = await getTeamAccess(userId);
  if (!coachId || !teamId) redirect("/runners");

  const firstName = (formData.get("guardianFirstName") as string)?.trim();
  const lastName = (formData.get("guardianLastName") as string)?.trim();
  const email = (formData.get("guardianEmail") as string)?.trim();
  const phone = (formData.get("guardianPhone") as string)?.trim();
  const relationship = ((formData.get("relationship") as string) || "parent_guardian").trim();

  const { data: runner } = await supabase
    .from("runners")
    .select("id")
    .eq("id", runnerId)
    .eq("team_id", teamId)
    .single();

  if (!runner?.id) redirect("/runners");

  try {
    const guardian = await upsertGuardianContact({
      client: supabase,
      teamId,
      firstName,
      lastName,
      email,
      phone,
    });

    await linkGuardianToRunner({
      client: supabase,
      runnerId: runner.id,
      guardianId: guardian.id,
      relationship,
      isPrimary: false,
    });

    await logAuditEvent({
      teamId,
      actorCoachId: coachId,
      actorClerkId: userId,
      action: "parent_portal.guardian_added",
      entityType: "guardian_contact",
      entityId: guardian.id,
      metadata: {
        runnerId: runner.id,
        email,
        phone,
        relationship,
      },
    });
  } catch (error) {
    redirect(`/runners/${runnerId}/edit?parentInviteError=${encodeURIComponent(error instanceof Error ? error.message : "Could not add guardian.")}`);
  }

  revalidatePath(`/runners/${runnerId}/edit`);
  redirect(`/runners/${runnerId}/edit?guardianSaved=1`);
}

async function removeRunnerGuardian(runnerId: string, guardianId: string) {
  "use server";

  const { userId } = await auth();
  if (!userId) redirect("/");

  const supabase = await createServerSupabaseClient();
  const { coachId, teamId } = await getTeamAccess(userId);
  if (!coachId || !teamId) redirect("/runners");

  const { data: runner } = await supabase
    .from("runners")
    .select("id")
    .eq("id", runnerId)
    .eq("team_id", teamId)
    .single();

  if (!runner?.id) redirect("/runners");

  await supabase
    .from("runner_guardians")
    .delete()
    .eq("runner_id", runner.id)
    .eq("guardian_id", guardianId);

  await logAuditEvent({
    teamId,
    actorCoachId: coachId,
    actorClerkId: userId,
    action: "parent_portal.guardian_removed",
    entityType: "guardian_contact",
    entityId: guardianId,
    metadata: {
      runnerId: runner.id,
    },
  });

  revalidatePath(`/runners/${runnerId}/edit`);
  redirect(`/runners/${runnerId}/edit?guardianSaved=1`);
}

export default async function EditRunnerPage({
  params,
  searchParams,
}: {
  params: Promise<{ runnerId: string }>;
  searchParams?: Promise<{ parentInvite?: string; parentInviteError?: string; guardianSaved?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/");
  const supabase = await createServerSupabaseClient();

  const { runnerId } = await params;
  const inviteParams = await searchParams;
  const { coachId, teamId } = await getTeamAccess(userId);
  if (!coachId || !teamId) redirect("/runners");

  await ensureDefaultRunnerGroups(coachId, supabase, teamId);

  const [{ data: runner }, { data: groups }, { data: guardianLinks }] = await Promise.all([
    supabase
      .from("runners")
      .select("id, first_name, last_name, grade, parent_phone, access_code, username")
      .eq("id", runnerId)
      .eq("team_id", teamId)
      .single(),
    supabase
      .from("runner_groups")
      .select("id, name, color")
      .eq("team_id", teamId)
      .order("name", { ascending: true }),
    supabase
      .from("runner_guardians")
      .select("guardian_id, relationship, is_primary, guardian_contacts(id, first_name, last_name, phone, email, clerk_id, portal_enabled)")
      .eq("runner_id", runnerId)
      .order("is_primary", { ascending: false }),
  ]);

  if (!runner) redirect("/runners");

  const safeGroups = (groups || []) as Group[];
  const customGroups = safeGroups.filter((group) => !DEFAULT_RUNNER_GROUP_NAMES.includes(group.name));

  const { data: memberships } = safeGroups.length
    ? await supabase
        .from("runner_group_members")
        .select("group_id")
        .eq("runner_id", runner.id)
        .in("group_id", safeGroups.map((group) => group.id))
    : { data: [] };

  const assigned = new Set(memberships?.map((membership) => membership.group_id) || []);
  const safeGuardianLinks = ((guardianLinks || []) as GuardianLink[]).map((link) => ({
    ...link,
    guardian_contacts: Array.isArray(link.guardian_contacts) ? link.guardian_contacts[0] || null : link.guardian_contacts,
  }));
  const division =
    (safeGroups.find((group) => ["Boys", "Girls"].includes(group.name) && assigned.has(group.id))?.name as RunnerDivision | undefined) ||
    "None / Other";

  return (
    <div className="min-h-screen hersemita-page-bg">
      <CoachHeader active="runners" />

      <main className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto">
        <div className="mb-8 rounded-2xl border border-white/10 bg-white/10 p-5 sm:p-6 shadow-2xl shadow-black/10 backdrop-blur">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#00a7ff]">Runner Profile</p>
          <h2 className="mt-2 text-3xl font-bold text-white">
            Edit {runner.first_name} {runner.last_name}
          </h2>
          <p className="mt-2 text-[#cbd5e1]">Grade changes update the automatic grade group so the roster stays consistent.</p>
        </div>

        <form action={updateRunner.bind(null, runner.id)} className="bg-white p-5 sm:p-6 rounded-xl shadow-sm border border-slate-200 space-y-6">
          {inviteParams?.parentInvite && (
            <div className="rounded-lg border border-[#00ff67]/30 bg-[#00ff67]/10 p-4 text-sm font-semibold text-green-800">
              {inviteParams.parentInvite === "sent" && "Parent portal invitation sent. It expires in 7 days."}
              {inviteParams.parentInvite === "linked" && "Parent portal access is already linked to an existing Hersemita account."}
            </div>
          )}

          {inviteParams?.parentInviteError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
              {inviteParams.parentInviteError}
            </div>
          )}

          {inviteParams?.guardianSaved && (
            <div className="rounded-lg border border-[#00ff67]/30 bg-[#00ff67]/10 p-4 text-sm font-semibold text-green-800">
              Guardian access updated.
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">First Name</label>
              <input name="firstName" type="text" required defaultValue={runner.first_name} className="w-full px-4 py-2 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-[#00a7ff] transition-colors" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Last Name</label>
              <input name="lastName" type="text" required defaultValue={runner.last_name} className="w-full px-4 py-2 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-[#00a7ff] transition-colors" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Grade</label>
            <select name="grade" required defaultValue={runner.grade} className="w-full px-4 py-2 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-[#00a7ff] transition-colors bg-white">
              <option value="9">9th</option>
              <option value="10">10th</option>
              <option value="11">11th</option>
              <option value="12">12th</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Division</label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label className="cursor-pointer">
                <input type="radio" name="division" value="Boys" required defaultChecked={division === "Boys"} className="sr-only peer" />
                <span className="group-chip group-chip-striped flex items-center justify-center rounded-full border px-4 py-3 text-sm font-bold transition" style={groupColorVar("#ef4444")}>
                  Boys
                </span>
              </label>
              <label className="cursor-pointer">
                <input type="radio" name="division" value="Girls" required defaultChecked={division === "Girls"} className="sr-only peer" />
                <span className="group-chip group-chip-striped flex items-center justify-center rounded-full border px-4 py-3 text-sm font-bold transition" style={groupColorVar("#14b8a6")}>
                  Girls
                </span>
              </label>
              <label className="cursor-pointer">
                <input type="radio" name="division" value="None / Other" required defaultChecked={division === "None / Other"} className="sr-only peer" />
                <span className="group-chip group-chip-solid flex items-center justify-center rounded-full border px-4 py-3 text-sm font-bold transition" style={groupColorVar("#64748b")}>
                  None / Other
                </span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Parent Phone Number</label>
            <PhoneNumberInput name="parentPhone" placeholder="5551234567" defaultValue={runner.parent_phone} />
          </div>

          {customGroups.length > 0 && (
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Custom Groups</label>
              <div className="flex flex-wrap gap-2">
                {customGroups.map((group) => (
                  <label key={group.id} className="cursor-pointer">
                    <input type="checkbox" name="groups" value={group.id} defaultChecked={assigned.has(group.id)} className="sr-only peer" />
                    <span
                      className="group-chip group-chip-solid inline-flex rounded-full border px-3 py-1 text-sm font-semibold transition"
                      style={groupColorVar(group.color)}
                    >
                      {group.name}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <button type="submit" className="w-full bg-gradient-to-r from-[#00ff67] to-[#00a7ff] text-white py-3 rounded-lg hover:shadow-lg hover:shadow-[#00a7ff]/25 transition-all font-bold text-lg">
            Save Runner
          </button>
        </form>

        <section className="mt-6 rounded-xl border border-white/10 bg-white/10 p-5 shadow-2xl shadow-black/10">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
            <h3 className="font-bold text-white">Parent Portal Access</h3>
            <p className="mt-1 text-sm text-[#cbd5e1]">
                Add each parent or guardian who should have separate access. Each invite expires in 7 days.
            </p>
            </div>
            <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-[#cbd5e1]">
              {safeGuardianLinks.length} linked
            </span>
          </div>

          <div className="mt-4 grid gap-3">
            {safeGuardianLinks.length === 0 ? (
              <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-sm text-[#cbd5e1]">
                No guardians are linked yet. Add at least one guardian email to enable parent portal access.
              </div>
            ) : (
              safeGuardianLinks.map((link) => {
                const guardian = link.guardian_contacts as PrimaryGuardian | null;
                const guardianName = `${guardian?.first_name || ""} ${guardian?.last_name || ""}`.trim();
                const guardianEmail = String(guardian?.email || "").trim().toLowerCase();
                const status = guardianPortalStatus(guardian);

                return (
                  <div key={link.guardian_id} className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-bold text-white">{guardianName || guardianEmail || guardian?.phone || "Guardian"}</p>
                          {link.is_primary && <span className="rounded-full bg-[#00a7ff]/20 px-2 py-1 text-xs font-bold text-[#7dd3fc]">Primary</span>}
                          <span className={`rounded-full border px-2 py-1 text-xs font-bold ${status.className}`}>{status.label}</span>
                        </div>
                        <p className="mt-1 break-all text-sm text-[#cbd5e1]">
                          {guardianEmail || "No portal email"} {guardian?.phone ? `/ ${guardian.phone}` : ""}
                        </p>
                        <p className="mt-1 text-xs font-semibold capitalize text-slate-400">{relationshipLabel(link.relationship)}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <form action={sendParentPortalInvite.bind(null, runner.id, link.guardian_id)}>
                          <button
                            type="submit"
                            disabled={!guardianEmail || Boolean(guardian?.clerk_id)}
                            className="rounded-lg bg-white px-4 py-2 text-sm font-bold text-slate-900 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Send Invite
                          </button>
                        </form>
                        {!link.is_primary && (
                          <form action={removeRunnerGuardian.bind(null, runner.id, link.guardian_id)}>
                            <button type="submit" className="rounded-lg border border-red-300/40 bg-red-500/10 px-4 py-2 text-sm font-bold text-red-100 transition hover:bg-red-500/20">
                              Remove
                            </button>
                          </form>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <form action={addRunnerGuardian.bind(null, runner.id)} className="mt-5 rounded-lg border border-[#00a7ff]/20 bg-[#00a7ff]/10 p-4">
            <h4 className="font-bold text-white">Add Another Guardian</h4>
            <p className="mt-1 text-sm text-[#cbd5e1]">Use a separate email for each guardian who needs their own account.</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <input name="guardianFirstName" type="text" placeholder="First name" className="rounded-lg border border-white/20 bg-white px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00a7ff]" />
              <input name="guardianLastName" type="text" placeholder="Last name" className="rounded-lg border border-white/20 bg-white px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00a7ff]" />
              <input name="guardianEmail" type="email" placeholder="guardian@example.com" className="rounded-lg border border-white/20 bg-white px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00a7ff]" />
              <PhoneNumberInput name="guardianPhone" placeholder="5551234567" />
            </div>
            <input type="hidden" name="relationship" value="parent_guardian" />
            <button type="submit" className="mt-3 rounded-lg bg-white px-4 py-2 text-sm font-bold text-slate-900 transition hover:bg-slate-100">
              Add Guardian
            </button>
          </form>
        </section>

        <div className="mt-6 rounded-xl border border-white/10 bg-white/10 p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-bold text-white">Runner Upload Credentials</h3>
              <p className="mt-1 text-sm text-[#cbd5e1]">Username: <span className="font-mono font-bold text-[#7dd3fc]">{runner.username || "Run the username SQL migration"}</span></p>
              <p className="mt-1 text-sm text-[#cbd5e1]">Passcode: <span className="font-mono font-bold text-[#7dd3fc]">{runner.access_code}</span></p>
            </div>
            <form action={rotateRunnerCredentials.bind(null, runner.id)}>
              <button type="submit" className="rounded-lg bg-red-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-600">
                Rotate Credentials
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
