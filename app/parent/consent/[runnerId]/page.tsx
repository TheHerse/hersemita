import { auth } from "@clerk/nextjs/server";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import ParentHeader from "@/components/ParentHeader";
import { getParentPortalContext } from "@/lib/parent-context";
import {
  acceptedParentConsentChoices,
  currentParentConsentVersion,
  REQUIRED_PARENT_CONSENT_KEYS,
} from "@/lib/parent-consent";
import { clientIpFromHeaders, rateLimitKey } from "@/lib/rate-limit";
import { supabaseAdmin } from "@/lib/supabase-admin";

async function grantConsent(runnerId: string, guardianId: string, formData: FormData) {
  "use server";

  const { userId } = await auth();
  if (!userId) redirect("/parent/sign-in");

  const context = await getParentPortalContext(userId);
  if (!context) redirect("/parent/dashboard");
  const runner = context?.pendingRunners.find((item) => item.id === runnerId);
  const guardian = context?.guardians.find((item) => item.id === guardianId);
  if (!runner || !guardian || runner.team_id !== guardian.team_id) {
    redirect("/parent/dashboard");
  }

  const choices = acceptedParentConsentChoices(formData);
  if (REQUIRED_PARENT_CONSENT_KEYS.some((key) => !choices[key])) {
    redirect(`/parent/consent/${runnerId}?error=required`);
  }

  const verifiedEmail = context.emails.find((email) => email === String(guardian.email || "").trim().toLowerCase());
  if (!verifiedEmail) {
    redirect(`/parent/consent/${runnerId}?error=email`);
  }

  const requestHeaders = await headers();
  const { error } = await supabaseAdmin.rpc("grant_runner_parent_consent", {
    p_runner_id: runner.id,
    p_guardian_id: guardian.id,
    p_clerk_user_id: userId,
    p_document_version: currentParentConsentVersion(),
    p_choices: choices,
    p_relationship_attestation: "parent_or_legal_guardian",
    p_verified_email: verifiedEmail,
    p_user_agent: requestHeaders.get("user-agent")?.slice(0, 500) || null,
    p_ip_evidence_hash: rateLimitKey(["parent-consent", clientIpFromHeaders(requestHeaders)]),
  });

  if (error) {
    redirect(`/parent/consent/${runnerId}?error=save`);
  }

  redirect("/parent/dashboard?consent=complete");
}

export default async function ParentConsentPage({
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
  const runner = context.pendingRunners.find((item) => item.id === runnerId);
  if (!runner) redirect("/parent/dashboard");
  const guardian = context.guardians.find((item) => item.team_id === runner.team_id && item.email && context.emails.includes(item.email.trim().toLowerCase()));
  if (!guardian) redirect("/parent/dashboard");

  return (
    <div className="min-h-screen hersemita-page-bg">
      <ParentHeader />
      <main className="mx-auto max-w-3xl p-4 sm:p-6 lg:p-8">
        <section className="rounded-2xl border border-white/10 bg-white/10 p-6 text-white shadow-2xl backdrop-blur">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#00a7ff]">Parent authorization</p>
          <h1 className="mt-2 text-3xl font-bold">Activate {runner.first_name} {runner.last_name}&apos;s runner portal</h1>
          <p className="mt-3 text-[#cbd5e1]">
            Review each item carefully. The runner portal remains locked until an authorized parent or legal guardian agrees.
          </p>
        </section>

        <form action={grantConsent.bind(null, runner.id, guardian.id)} className="mt-6 space-y-5 rounded-2xl bg-white p-6 text-slate-900 shadow-xl">
          {query?.error && (
            <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
              {query.error === "required" ? "Every required authorization must be checked." : "Consent could not be recorded. Please try again or contact support."}
            </p>
          )}

          <ConsentCheckbox name="parent_authority" label="I am this student's parent or legal guardian and I am authorized to make this decision." />
          <ConsentCheckbox name="terms" label="I have read and agree to the Hersemita Terms of Service." href="/terms" />
          <ConsentCheckbox name="privacy" label="I have read the Hersemita Privacy Policy and understand the described data practices." href="/privacy" />
          <ConsentCheckbox name="runner_portal" label="I authorize this student to use the Hersemita runner portal." />
          <ConsentCheckbox name="training_data" label="I authorize Hersemita to process the student's team identity, workout records, activity details, and sanitized workout-proof images for coaching purposes." />
          <ConsentCheckbox name="wellness_data" label="I authorize Hersemita to process the student's recovery and wellness entries, including soreness, illness, sleep, heart-rate, and HRV information, for coaching purposes." />

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            SMS consent is separate and is not granted by this form. You may withdraw portal authorization later; withdrawal will disable runner access while required deletion and retention steps are processed.
          </div>

          <button type="submit" className="w-full rounded-lg bg-slate-900 px-5 py-3 font-bold text-white transition hover:bg-slate-800">
            Agree and activate runner portal
          </button>
          <p className="text-center text-xs text-slate-500">Consent document version: {currentParentConsentVersion()}</p>
        </form>
      </main>
    </div>
  );
}

function ConsentCheckbox({ name, label, href }: { name: string; label: string; href?: string }) {
  return (
    <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-4">
      <input name={name} type="checkbox" required className="mt-1 h-5 w-5" />
      <span className="text-sm leading-relaxed">
        {label}{" "}
        {href && <Link href={href} target="_blank" className="font-bold text-[#007ab8] underline">Open document</Link>}
      </span>
    </label>
  );
}
