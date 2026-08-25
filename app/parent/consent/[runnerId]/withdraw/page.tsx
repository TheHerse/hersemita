import { auth } from "@clerk/nextjs/server";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import ParentHeader from "@/components/ParentHeader";
import { getParentPortalContext, type ParentPortalContext } from "@/lib/parent-context";
import { clientIpFromHeaders, rateLimitKey } from "@/lib/rate-limit";
import { supabaseAdmin } from "@/lib/supabase-admin";

async function linkedGuardian(context: ParentPortalContext, runnerId: string) {
  const guardianIds = context.guardians.map((guardian) => guardian.id);
  if (guardianIds.length === 0) return null;

  const { data: link } = await supabaseAdmin
    .from("runner_guardians")
    .select("guardian_id")
    .eq("runner_id", runnerId)
    .in("guardian_id", guardianIds)
    .limit(1)
    .maybeSingle();

  return context.guardians.find((guardian) => guardian.id === link?.guardian_id) || null;
}

async function withdrawConsent(runnerId: string, formData: FormData) {
  "use server";

  const { userId } = await auth();
  if (!userId) redirect("/parent/sign-in");
  if (formData.get("confirm") !== "on") {
    redirect(`/parent/consent/${runnerId}/withdraw?error=confirm`);
  }

  const context = await getParentPortalContext(userId);
  if (!context) redirect("/parent/dashboard");
  const runner = context.runners.find((item) => item.id === runnerId);
  if (!runner) redirect("/parent/dashboard");
  const guardian = await linkedGuardian(context, runner.id);
  if (!guardian) redirect("/parent/dashboard");
  const verifiedEmail = context.emails.find((email) => email === String(guardian.email || "").trim().toLowerCase());
  if (!verifiedEmail) redirect(`/parent/consent/${runnerId}/withdraw?error=email`);

  const requestHeaders = await headers();
  const { error } = await supabaseAdmin.rpc("withdraw_runner_parent_consent", {
    p_runner_id: runner.id,
    p_guardian_id: guardian.id,
    p_clerk_user_id: userId,
    p_verified_email: verifiedEmail,
    p_user_agent: requestHeaders.get("user-agent")?.slice(0, 500) || null,
    p_ip_evidence_hash: rateLimitKey(["parent-consent-withdrawal", clientIpFromHeaders(requestHeaders)]),
  });

  if (error) redirect(`/parent/consent/${runnerId}/withdraw?error=save`);
  redirect("/parent/dashboard?consent=withdrawn");
}

export default async function WithdrawParentConsentPage({
  params,
  searchParams,
}: {
  params: Promise<{ runnerId: string }>;
  searchParams?: Promise<{ error?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/parent/sign-in");
  const { runnerId } = await params;
  const query = await searchParams;
  const context = await getParentPortalContext(userId);
  if (!context) redirect("/parent/dashboard");
  const runner = context.runners.find((item) => item.id === runnerId);
  if (!runner || !(await linkedGuardian(context, runner.id))) redirect("/parent/dashboard");

  return (
    <div className="min-h-screen hersemita-page-bg">
      <ParentHeader />
      <main className="mx-auto max-w-2xl p-4 sm:p-6 lg:p-8">
        <section className="rounded-2xl bg-white p-6 text-slate-900 shadow-xl">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-red-600">Withdraw authorization</p>
          <h1 className="mt-2 text-3xl font-bold">Disable {runner.first_name} {runner.last_name}&apos;s runner portal?</h1>
          <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
            This immediately revokes every runner session, erases the current passcode hash, and prevents new runner logins. Existing records are not silently deleted; deletion and legally required retention are handled through the privacy-request process.
          </div>

          {query?.error && (
            <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
              {query.error === "confirm" ? "You must check the confirmation box." : "Authorization could not be withdrawn. Please try again or contact support."}
            </p>
          )}

          <form action={withdrawConsent.bind(null, runner.id)} className="mt-6 space-y-5">
            <label className="flex items-start gap-3 rounded-lg border border-slate-300 p-4">
              <input name="confirm" type="checkbox" required className="mt-1 h-5 w-5" />
              <span className="text-sm leading-relaxed">I understand that withdrawal immediately disables this runner&apos;s portal access and credentials.</span>
            </label>
            <div className="flex flex-col gap-3 sm:flex-row">
              <button type="submit" className="rounded-lg bg-red-600 px-5 py-3 font-bold text-white transition hover:bg-red-700">
                Withdraw and disable access
              </button>
              <Link href={`/parent/runners/${runner.username || runner.id}`} className="rounded-lg border border-slate-300 px-5 py-3 text-center font-bold text-slate-700 transition hover:bg-slate-50">
                Cancel
              </Link>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}
