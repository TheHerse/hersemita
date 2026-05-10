import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import Link from "next/link";
import { sendMassSMS } from "@/lib/twilio";
import CoachHeader from "@/components/CoachHeader";
import MessageParentsForm from "@/components/MessageParentsForm";

async function sendMessage(formData: FormData) {
  "use server";
  
  const { userId } = await auth();
  if (!userId) redirect("/");
  const supabase = await createServerSupabaseClient();
  
  const { data: coach } = await supabase
    .from("coaches")
    .select("id, name")
    .eq("email", userId)
    .maybeSingle();

  if (!coach?.id) {
    redirect("/settings?error=Coach%20profile%20not%20found.");
  }

  const { data: coachProfile } = coach?.id
    ? await supabase
        .from("coaches")
        .select("school_name")
        .eq("id", coach.id)
        .single()
    : { data: null };
  
  const message = formData.get("message") as string;
  const messageType = formData.get("type") as string;
  const selectedRunners = formData.getAll("runners") as string[];

  if (selectedRunners.length === 0) {
    redirect("/runners/message?status=none");
  }
  
  const { data: runners } = await supabase
    .from("runners")
    .select("first_name, last_name, parent_phone")
    .eq("coach_id", coach.id)
    .in("id", selectedRunners)
    .not("parent_phone", "is", null);
  
  const phones = runners?.map(r => r.parent_phone!).filter(Boolean) || [];

  if (phones.length === 0) {
    redirect("/runners/message?status=none");
  }

  const result = await sendMassSMS(
    phones,
    `${coachProfile?.school_name ? `${coachProfile.school_name} - ` : ""}Coach ${coach?.name || ""}: ${message}`.trim()
  );
  
  const status = result.success ? "sent" : result.mock ? "mock" : "error";
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

  const { data: coach } = await supabase
    .from("coaches")
    .select("id, name")
    .eq("email", userId)
    .maybeSingle();

  const { data: runners } = coach?.id
    ? await supabase
        .from("runners")
        .select("id, first_name, last_name, grade, parent_phone")
        .eq("coach_id", coach.id)
        .order("last_name", { ascending: true })
    : { data: [] };

  const runnersWithPhone = runners?.filter(r => r.parent_phone) || [];
  const runnersWithoutPhone = runners?.filter(r => !r.parent_phone) || [];
  const runnerCount = runners?.length || 0;

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
              {runnersWithPhone.length} of {runnerCount} runners have parent phone numbers
            </p>

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
                <b>Note:</b> Parent texting requires Twilio credentials and verification to be approved for live sending.
              </p>
            </div>
          </div>
        </div>
      </main>
      
    </div>
  );
}
