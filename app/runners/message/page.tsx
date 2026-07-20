import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import Link from "next/link";
import { sendMassSMS } from "@/lib/twilio";
import CoachHeader from "@/components/CoachHeader";
import MessageParentsForm from "@/components/MessageParentsForm";
import { logAuditEvent } from "@/lib/audit-log";
import { logParentMessage } from "@/lib/parent-message-log";
import { getCurrentTeamContext } from "@/lib/team-context";

type RunnerMessageRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  grade: number | null;
  parent_phone: string | null;
};

type GuardianPhoneLink = {
  runner_id: string | null;
  guardian_contacts:
    | {
        phone: string | null;
      }
    | {
        phone: string | null;
      }[]
    | null;
};

function phoneKey(phone: string | null | undefined) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return digits;
  return digits.length >= 7 ? digits : null;
}

function guardianPhone(link: GuardianPhoneLink) {
  const contact = Array.isArray(link.guardian_contacts) ? link.guardian_contacts[0] : link.guardian_contacts;
  return contact?.phone || null;
}

function phonesForRunner(runner: RunnerMessageRow, guardianLinks: GuardianPhoneLink[]) {
  const phones = [runner.parent_phone, ...guardianLinks.filter((link) => link.runner_id === runner.id).map(guardianPhone)];
  const seen = new Set<string>();
  return phones.filter((phone): phone is string => {
    const key = phoneKey(phone);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function hasDisallowedSmsContent(message: string) {
  const hasLink = /(https?:\/\/|www\.|[a-z0-9.-]+\.[a-z]{2,}(?:\/|\b))/i.test(message);
  const hasPhoneNumber = /(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}\b/.test(message);
  return hasLink || hasPhoneNumber;
}

async function sendMessage(formData: FormData) {
  "use server";
  
  const { userId } = await auth();
  if (!userId) redirect("/");
  const supabase = await createServerSupabaseClient();
  const teamContext = await getCurrentTeamContext(userId);
  const teamId = teamContext?.team.id;
  
  const { data: coach } = await supabase
    .from("coaches")
    .select("id, name")
    .eq("clerk_id", userId)
    .maybeSingle();

  if (!coach?.id) {
    redirect("/settings?error=Coach%20profile%20not%20found.");
  }
  
  const message = formData.get("message") as string;
  const messageType = formData.get("type") as string;
  const selectedRunners = formData.getAll("runners") as string[];

  if (hasDisallowedSmsContent(message)) {
    redirect("/runners/message?status=invalid_content");
  }

  if (selectedRunners.length === 0) {
    redirect("/runners/message?status=none");
  }
  
  const { data: runners } = await supabase
    .from("runners")
    .select("id, first_name, last_name, parent_phone")
    .eq("team_id", teamId)
    .in("id", selectedRunners);

  const safeRunners = (runners || []) as RunnerMessageRow[];
  const runnerIds = safeRunners.map((runner) => runner.id);
  const { data: guardianLinks } = runnerIds.length
    ? await supabase
        .from("runner_guardians")
        .select("runner_id, guardian_contacts(phone)")
        .eq("relationship", "parent_guardian")
        .in("runner_id", runnerIds)
    : { data: [] };
  const safeGuardianLinks = (guardianLinks || []) as GuardianPhoneLink[];
  const recipients = safeRunners.flatMap((runner) =>
    phonesForRunner(runner, safeGuardianLinks).map((phone) => ({
      runnerId: runner.id,
      runnerName: `${runner.first_name || ""} ${runner.last_name || ""}`.trim(),
      parentPhone: phone,
    }))
  );
  const phoneMap = new Map<string, string>();
  recipients.forEach((recipient) => {
    const key = phoneKey(recipient.parentPhone);
    if (key && !phoneMap.has(key)) phoneMap.set(key, recipient.parentPhone || "");
  });
  const phones = Array.from(phoneMap.values()).filter(Boolean);

  if (phones.length === 0) {
    redirect("/runners/message?status=none");
  }

  const result = await sendMassSMS(
    phones,
    `${teamContext?.team.school_name || teamContext?.team.name ? `${teamContext?.team.school_name || teamContext?.team.name} - ` : ""}Coach ${coach?.name || ""}: ${message}`.trim()
  );
  const status = result.success ? "sent" : result.mock ? "mock" : "error";

  await logParentMessage({
    teamId,
    coachId: teamContext?.coach.id || coach.id,
    messageType,
    body: message,
    status,
    mock: Boolean(result.mock),
    errorMessage: result.success ? null : result.error || null,
    runnerCount: selectedRunners.length,
    recipientCount: phones.length,
    recipients,
  });

  await logAuditEvent({
    teamId,
    actorCoachId: teamContext?.coach.id || coach.id,
    actorClerkId: userId,
    action: "parent_message.sent",
    entityType: "parent_message",
    metadata: {
      messageType,
      runnerCount: selectedRunners.length,
      phoneCount: phones.length,
      success: result.success,
      mock: result.mock,
    },
  });
  
  redirect(`/runners/message?status=${status}&count=${phones.length}&type=${messageType}`);
}

export default async function MessageParentsPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string; count?: string; type?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/");
  const supabase = await createServerSupabaseClient();
  const params = await searchParams;
  const teamContext = await getCurrentTeamContext(userId);
  const teamId = teamContext?.team.id;

  const { data: coach } = await supabase
    .from("coaches")
    .select("id, name")
    .eq("clerk_id", userId)
    .maybeSingle();

  const { data: runners } = coach?.id
    ? await supabase
        .from("runners")
        .select("id, first_name, last_name, grade, parent_phone")
        .eq("team_id", teamId)
        .order("last_name", { ascending: true })
    : { data: [] };

  const safeRunners = (runners || []) as RunnerMessageRow[];
  const runnerIds = safeRunners.map((runner) => runner.id);
  const { data: guardianLinks } = runnerIds.length
    ? await supabase
        .from("runner_guardians")
        .select("runner_id, guardian_contacts(phone)")
        .eq("relationship", "parent_guardian")
        .in("runner_id", runnerIds)
    : { data: [] };
  const safeGuardianLinks = (guardianLinks || []) as GuardianPhoneLink[];
  const runnersForMessaging = safeRunners.map((runner) => ({
    ...runner,
    recipient_count: phonesForRunner(runner, safeGuardianLinks).length,
  }));
  const runnersWithPhone = runnersForMessaging.filter((runner) => runner.recipient_count > 0);
  const runnersWithoutPhone = runnersForMessaging.filter((runner) => runner.recipient_count === 0);
  const runnerCount = safeRunners.length;
  const recipientCount = runnersWithPhone.reduce((sum, runner) => sum + runner.recipient_count, 0);

  return (
    <div className="min-h-screen hersemita-page-bg">
      <CoachHeader active="message" />

      <main className="p-4 sm:p-6 lg:p-8">
        <div className="max-w-3xl mx-auto">
          <div className="bg-white p-5 sm:p-6 rounded-xl shadow-sm border border-slate-200">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-[#00a7ff]/10 flex items-center justify-center">
                <svg className="w-4 h-4 text-[#00a7ff]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-slate-900">Message Parents</h1>
            </div>
            <p className="text-slate-600 mb-6 sm:ml-11">
              {runnersWithPhone.length} of {runnerCount} runners have parent contacts ({recipientCount} SMS recipient{recipientCount === 1 ? "" : "s"})
            </p>
            <Link
              href="/runners/message/history"
              className="mb-6 inline-flex rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
            >
              View message history
            </Link>

            {params?.status && (
              <div className={`mb-6 rounded-lg border p-4 text-sm ${
                params.status === "sent"
                  ? "border-[#00ff67]/30 bg-[#00ff67]/10 text-green-800"
                  : params.status === "mock"
                    ? "border-orange-200 bg-orange-50 text-orange-800"
                    : "border-red-200 bg-red-50 text-red-700"
              }`}>
                {params.status === "sent" && `Sent ${params.count || 0} parent message${params.count === "1" ? "" : "s"}.`}
                {params.status === "mock" && `Twilio is not fully configured yet. Hersemita prepared ${params.count || 0} message${params.count === "1" ? "" : "s"} but did not send live SMS.`}
                {params.status === "error" && "Message sending failed. Check Twilio credentials, verification, and phone-number formatting."}
                {params.status === "none" && "Choose at least one runner with a parent phone number before sending."}
                {params.status === "invalid_content" && "Messages cannot include links or phone numbers under the approved SMS campaign."}
              </div>
            )}

            {!coach?.id ? (
              <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 text-sm text-orange-800">
                Coach profile was not found. Visit settings once, save your profile, then return here.
              </div>
            ) : runnerCount === 0 ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-5 text-center">
                <p className="font-semibold text-slate-900">Add runners before messaging parents.</p>
                <Link href="/runners/new" className="primary-action mt-4 inline-flex px-5 py-3">
                  Add Runner
                </Link>
              </div>
            ) : (
              <MessageParentsForm
                action={sendMessage}
                runnersWithPhone={runnersWithPhone}
                runnersWithoutPhone={runnersWithoutPhone}
              />
            )}
            
            <div className="mt-6 p-4 bg-orange-50 border border-orange-200 rounded-lg">
              <p className="text-sm text-orange-800 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <b>Note:</b> Parent texting requires Twilio credentials, account approval, and <code className="rounded bg-orange-100 px-1 font-mono">TWILIO_SMS_ENABLED=true</code> before Hersemita sends live SMS.
              </p>
            </div>
          </div>
        </div>
      </main>
      
    </div>
  );
}
