import { auth, currentUser } from "@clerk/nextjs/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { currentAdultConsentVersion } from "@/lib/adult-consent";
import { clientIpFromHeaders, rateLimitKey } from "@/lib/rate-limit";
import { supabaseAdmin } from "@/lib/supabase-admin";

async function adultRunnerRecords(userId: string) {
  const { data: events } = await supabaseAdmin
    .from("adult_runner_consent_events")
    .select("runner_id")
    .eq("clerk_user_id", userId)
    .eq("event_type", "granted");
  const ids = Array.from(new Set((events || []).map((event) => event.runner_id)));
  if (ids.length === 0) return [];
  const { data } = await supabaseAdmin
    .from("runners")
    .select("id, first_name, last_name, runner_email, adult_parent_access_enabled")
    .in("id", ids)
    .eq("age_status", "adult_18_plus")
    .eq("portal_status", "active");
  return data || [];
}

async function setParentAccess(runnerId: string, enabled: boolean) {
  "use server";
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const user = await currentUser();
  const emails = (user?.emailAddresses || [])
    .filter((email) => (email.verification as { status?: string } | null)?.status === "verified")
    .map((email) => email.emailAddress.trim().toLowerCase());
  const runner = (await adultRunnerRecords(userId)).find((item) => item.id === runnerId);
  const verifiedEmail = runner && emails.find((email) => email === String(runner.runner_email || "").trim().toLowerCase());
  if (!runner || !verifiedEmail) redirect("/adult/access");
  const requestHeaders = await headers();
  const { error } = await supabaseAdmin.rpc("set_adult_runner_parent_access", {
    p_runner_id: runner.id,
    p_clerk_user_id: userId,
    p_enabled: enabled,
    p_document_version: currentAdultConsentVersion(),
    p_verified_email: verifiedEmail,
    p_user_agent: requestHeaders.get("user-agent")?.slice(0, 500) || null,
    p_ip_evidence_hash: rateLimitKey(["adult-parent-access", clientIpFromHeaders(requestHeaders)]),
  });
  if (error) redirect("/adult/access?error=save");
  redirect("/adult/access?saved=1");
}

export default async function AdultParentAccessPage({ searchParams }: { searchParams?: Promise<{ error?: string; saved?: string }> }) {
  const { userId } = await auth();
  if (!userId) redirect(`/sign-in?redirect_url=${encodeURIComponent("/adult/access")}`);
  const query = await searchParams;
  const runners = await adultRunnerRecords(userId);

  return <main className="min-h-screen hersemita-page-bg p-4 sm:p-8">
    <section className="mx-auto max-w-2xl rounded-2xl bg-white p-6 text-slate-900 shadow-xl">
      <h1 className="text-3xl font-bold">Parent access controls</h1>
      <p className="mt-2 text-slate-600">As an adult runner, you control whether guardians already linked by the team may view your parent portal information.</p>
      {query?.saved && <p className="mt-4 rounded-lg bg-green-50 p-3 text-sm font-semibold text-green-700">Parent access updated.</p>}
      {query?.error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">The change could not be saved.</p>}
      <div className="mt-5 grid gap-4">
        {runners.map((runner) => <div key={runner.id} className="rounded-lg border border-slate-200 p-4">
          <p className="font-bold">{runner.first_name} {runner.last_name}</p>
          <p className="mt-1 text-sm text-slate-600">Current parent access: {runner.adult_parent_access_enabled ? "Allowed" : "Disabled"}</p>
          <form action={setParentAccess.bind(null, runner.id, !runner.adult_parent_access_enabled)} className="mt-3">
            <button className={`rounded-lg px-4 py-2 text-sm font-bold text-white ${runner.adult_parent_access_enabled ? "bg-red-600" : "bg-slate-900"}`}>
              {runner.adult_parent_access_enabled ? "Revoke parent access" : "Allow linked parent access"}
            </button>
          </form>
        </div>)}
      </div>
    </section>
  </main>;
}
