import { auth, clerkClient } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { CSSProperties } from "react";
import PhoneNumberInput from "@/components/PhoneNumberInput";
import CoachHeader from "@/components/CoachHeader";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { appBaseUrl } from "@/lib/app-url";
import { logAuditEvent } from "@/lib/audit-log";
import { makeAccessCode, makeRunnerUsername } from "@/lib/runner-access";
import { hashRunnerAccessCode } from "@/lib/runner-credentials";
import { getRunnerCredentialReveal, setRunnerCredentialReveal } from "@/lib/runner-credential-reveal";
import { decryptRunnerAccessCode, encryptRunnerAccessCode } from "@/lib/runner-credential-vault";
import { linkGuardianToRunner, upsertGuardianContact } from "@/lib/guardian-contacts";
import {
  DEFAULT_RUNNER_GROUP_NAMES,
  ensureDefaultRunnerGroups,
  syncRunnerAutomaticGroups,
  type RunnerDivision,
} from "@/lib/runner-groups";
import { getCurrentTeamContext } from "@/lib/team-context";
import { checkRateLimit, rateLimitKey } from "@/lib/rate-limit";
import { logSecurityEvent, securityReference } from "@/lib/security-events";

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
    role: context?.role,
  };
}

async function verifyHeadCoachPassword(userId: string, password: string, runnerId: string, action: string) {
  const context = await getCurrentTeamContext(userId);
  if (!context || context.role !== "head_coach") return null;
  const requestHeaders = await headers();
  const limit = await checkRateLimit({
    key: rateLimitKey(["runner-credential", action, userId, requestHeaders.get("x-forwarded-for")?.split(",")[0], runnerId]),
    windowMs: 60 * 60 * 1000,
    max: 10,
  });
  if (limit.limited || !password || password.length > 256) return null;

  try {
    const client = await clerkClient();
    await client.users.verifyPassword({ userId, password });
    return context;
  } catch {
    await logSecurityEvent({
      teamId: context.team.id,
      actorType: "coach",
      actorReference: securityReference(userId),
      eventType: "credential.reverification_failed",
      severity: "high",
      route: `/runners/${runnerId}/edit`,
      outcome: action,
    });
    return null;
  }
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
  const ageStatus = String(formData.get("ageStatus") || "");
  const runnerEmail = String(formData.get("runnerEmail") || "").trim().toLowerCase();
  const customGroupIds = formData.getAll("groups") as string[];

  const { data: runner } = await supabase
    .from("runners")
    .select("id, age_status, portal_status, credential_version, session_version")
    .eq("id", runnerId)
    .eq("team_id", teamId)
    .single();

  if (!runner?.id || !firstName || !lastName || !grade || !division || !new Set(["minor_13_to_17", "adult_18_plus"]).has(ageStatus)) {
    redirect("/runners");
  }
  if (ageStatus === "adult_18_plus" && !runnerEmail) {
    throw new Error("An adult runner email is required for adult self-consent.");
  }

  const ageChanged = runner.age_status !== ageStatus;
  const portalStatus = ageChanged
    ? ageStatus === "adult_18_plus" ? "pending_adult_consent" : "pending_parent_consent"
    : runner.portal_status;

  const { error } = await supabase
    .from("runners")
    .update({
      first_name: firstName,
      last_name: lastName,
      grade,
      parent_phone: parentPhone || null,
      runner_email: runnerEmail || null,
      age_status: ageStatus,
      age_status_attested_at: new Date().toISOString(),
      age_status_attested_by: userId,
      age_status_season: new Date().getFullYear().toString(),
      portal_status: portalStatus,
      ...(ageChanged ? {
        access_code: null,
        access_code_hash: null,
        credential_version: Number(runner.credential_version || 1) + 1,
        session_version: Number(runner.session_version || 1) + 1,
      } : {}),
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

async function rotateRunnerCredentials(runnerId: string, formData: FormData) {
  "use server";

  const { userId } = await auth();
  if (!userId) redirect("/");
  const context = await verifyHeadCoachPassword(userId, String(formData.get("coachPassword") || ""), runnerId, "reset");
  if (!context) redirect(`/runners/${runnerId}/edit?credentialError=password`);
  const supabase = await createServerSupabaseClient();

  const teamId = context.team.id;
  if (!teamId) redirect("/runners");

  const { data: runner } = await supabase
    .from("runners")
    .select("first_name, last_name, credential_version, session_version, portal_status")
    .eq("id", runnerId)
    .eq("team_id", teamId)
    .single();

  if (!runner) redirect("/runners");
  if (runner.portal_status !== "active") {
    redirect(`/runners/${runnerId}/edit?credentialError=parent_consent_required`);
  }

  const accessCode = makeAccessCode();
  const accessCodeHash = await hashRunnerAccessCode(accessCode);
  const encryptedAccessCode = encryptRunnerAccessCode(runnerId, accessCode);
  const username = makeRunnerUsername(runner.first_name, runner.last_name);

  const { error } = await supabase
    .from("runners")
    .update({
      access_code: encryptedAccessCode,
      access_code_hash: accessCodeHash,
      username,
      credential_version: Number(runner.credential_version || 1) + 1,
      session_version: Number(runner.session_version || 1) + 1,
    })
    .eq("id", runnerId)
    .eq("team_id", teamId);

  if (error) {
    throw new Error(error.message);
  }

  await setRunnerCredentialReveal(runnerId, username, accessCode);

  await logAuditEvent({
    teamId,
    actorCoachId: context.coach.id,
    actorClerkId: userId,
    action: "runner_credential.reset",
    entityType: "runner",
    entityId: runnerId,
  });

  revalidatePath(`/runners/${runnerId}/edit`);
  redirect(`/runners/${runnerId}/edit`);
}

async function revealRunnerCredentials(runnerId: string, formData: FormData) {
  "use server";

  const { userId } = await auth();
  if (!userId) redirect("/");
  const context = await verifyHeadCoachPassword(userId, String(formData.get("coachPassword") || ""), runnerId, "reveal");
  if (!context) redirect(`/runners/${runnerId}/edit?credentialError=password`);

  const { data: runner } = await supabaseAdmin
    .from("runners")
    .select("id, username, access_code, portal_status")
    .eq("id", runnerId)
    .eq("team_id", context.team.id)
    .maybeSingle();

  if (!runner?.id || runner.portal_status !== "active") redirect("/runners");
  const accessCode = decryptRunnerAccessCode(runner.id, runner.access_code);
  if (!accessCode || !runner.username) {
    redirect(`/runners/${runnerId}/edit?credentialError=reset_required`);
  }

  await setRunnerCredentialReveal(runner.id, runner.username, accessCode);
  await logAuditEvent({
    teamId: context.team.id,
    actorCoachId: context.coach.id,
    actorClerkId: userId,
    action: "runner_credential.revealed",
    entityType: "runner",
    entityId: runner.id,
  });

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
  searchParams?: Promise<{ parentInvite?: string; parentInviteError?: string; guardianSaved?: string; credentialError?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/");
  const supabase = await createServerSupabaseClient();

  const { runnerId } = await params;
  const inviteParams = await searchParams;
  const { coachId, teamId, role } = await getTeamAccess(userId);
  if (!coachId || !teamId) redirect("/runners");

  await ensureDefaultRunnerGroups(coachId, supabase, teamId);

  const [{ data: runner }, { data: groups }, { data: guardianLinks }] = await Promise.all([
    supabase
      .from("runners")
      .select("id, first_name, last_name, grade, parent_phone, username, portal_status, age_status, runner_email")
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

  const credentialReveal = await getRunnerCredentialReveal(runner.id);

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
            <label className="block text-sm font-semibold text-slate-700 mb-2">Legal age status</label>
            <select name="ageStatus" required defaultValue={runner.age_status === "adult_18_plus" ? "adult_18_plus" : "minor_13_to_17"} className="w-full rounded-lg border-2 border-slate-200 bg-white px-4 py-2 transition-colors focus:border-[#00a7ff] focus:outline-none">
              <option value="minor_13_to_17">Age 13–17</option>
              <option value="adult_18_plus">Age 18 or older</option>
            </select>
            <p className="mt-1 text-xs text-slate-500">Changing this status revokes existing runner credentials and requires fresh consent.</p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Runner Email</label>
            <input name="runnerEmail" type="email" defaultValue={runner.runner_email || ""} placeholder="runner@example.com" className="w-full rounded-lg border-2 border-slate-200 px-4 py-2 transition-colors focus:border-[#00a7ff] focus:outline-none" />
            <p className="mt-1 text-xs text-slate-500">Required for adult self-consent. Do not enter a parent email.</p>
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
          <div className="flex flex-col gap-4">
            <div>
              <h3 className="font-bold text-white">Runner Upload Credentials</h3>
              <p className="mt-1 text-sm text-[#cbd5e1]">Username: <span className="font-mono font-bold text-[#7dd3fc]">{runner.username || "Run the username SQL migration"}</span></p>
              {credentialReveal ? (
                <div className="mt-3 rounded-lg border border-amber-300/40 bg-amber-300/10 p-3 text-sm text-amber-50">
                  <p className="font-bold">Access code revealed after coach verification. It will hide again in five minutes.</p>
                  <p className="mt-2">Username: <span className="font-mono font-bold">{credentialReveal.username}</span></p>
                  <p>Access code: <span className="font-mono font-bold">{credentialReveal.accessCode}</span></p>
                </div>
              ) : (
                <p className="mt-1 text-sm text-[#cbd5e1]">The access code is hidden. The head coach must enter their own account password to view or reset it.</p>
              )}
            </div>

            {inviteParams?.credentialError && (
              <p className="rounded-lg border border-red-300/40 bg-red-500/10 p-3 text-sm font-semibold text-red-100">
                {inviteParams.credentialError === "password" && "The coach password was incorrect, unavailable, or the reveal limit was reached."}
                {inviteParams.credentialError === "reset_required" && "This older credential has no encrypted vault copy. Reset it once before using View Access Code."}
                {inviteParams.credentialError === "parent_consent_required" && "Runner access remains locked until the required consent is active."}
              </p>
            )}

            {runner.portal_status === "active" && role === "head_coach" ? (
              <div className="grid gap-3 lg:grid-cols-2">
                <form action={revealRunnerCredentials.bind(null, runner.id)} className="rounded-lg border border-white/10 bg-white/5 p-4">
                  <label className="block text-sm font-bold text-white" htmlFor={`reveal-password-${runner.id}`}>Coach account password</label>
                  <input id={`reveal-password-${runner.id}`} name="coachPassword" type="password" required autoComplete="current-password" className="mt-2 w-full rounded-lg border border-white/20 bg-white px-3 py-2 text-slate-900" />
                  <button type="submit" className="mt-3 w-full rounded-lg bg-[#00a7ff] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#008ed8]">
                    View Access Code
                  </button>
                </form>
                <form action={rotateRunnerCredentials.bind(null, runner.id)} className="rounded-lg border border-red-300/20 bg-red-500/5 p-4">
                  <label className="block text-sm font-bold text-white" htmlFor={`reset-password-${runner.id}`}>Coach account password</label>
                  <input id={`reset-password-${runner.id}`} name="coachPassword" type="password" required autoComplete="current-password" className="mt-2 w-full rounded-lg border border-white/20 bg-white px-3 py-2 text-slate-900" />
                  <button type="submit" className="mt-3 w-full rounded-lg bg-red-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-600">
                    Create/Reset Access Code
                  </button>
                  <p className="mt-2 text-xs text-red-100">Resetting immediately revokes the old code and all runner sessions.</p>
                </form>
              </div>
            ) : runner.portal_status !== "active" ? (
              <span className="rounded-lg border border-amber-300/40 bg-amber-300/10 px-4 py-2 text-sm font-bold text-amber-100">
                Waiting for parent consent
              </span>
            ) : (
              <span className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-slate-200">Only the head coach can view or reset runner access codes.</span>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
