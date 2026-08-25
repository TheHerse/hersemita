import { auth } from "@clerk/nextjs/server";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { acceptedAdultConsentChoices, currentAdultConsentVersion, REQUIRED_ADULT_CONSENT_KEYS } from "@/lib/adult-consent";
import { getPendingAdultRunners } from "@/lib/adult-runner-context";
import { clientIpFromHeaders, rateLimitKey } from "@/lib/rate-limit";
import { makeAccessCode } from "@/lib/runner-access";
import { setAdultRunnerCredentialReveal } from "@/lib/runner-credential-reveal";
import { hashRunnerAccessCode } from "@/lib/runner-credentials";
import { supabaseAdmin } from "@/lib/supabase-admin";

async function grantAdultConsent(runnerId: string, formData: FormData) {
  "use server";
  const { userId } = await auth();
  if (!userId) redirect(`/sign-in?redirect_url=${encodeURIComponent(`/adult/consent/${runnerId}`)}`);
  const context = await getPendingAdultRunners(userId);
  const runner = context.runners.find((item) => item.id === runnerId);
  if (!runner) redirect("/adult/consent");
  const choices = acceptedAdultConsentChoices(formData);
  if (REQUIRED_ADULT_CONSENT_KEYS.some((key) => !choices[key])) {
    redirect(`/adult/consent/${runnerId}?error=required`);
  }
  const verifiedEmail = context.emails.find((email) => email === runner.runner_email.trim().toLowerCase());
  if (!verifiedEmail) redirect(`/adult/consent/${runnerId}?error=email`);

  const accessCode = makeAccessCode();
  const accessCodeHash = await hashRunnerAccessCode(accessCode);
  const requestHeaders = await headers();
  const { error } = await supabaseAdmin.rpc("grant_adult_runner_consent", {
    p_runner_id: runner.id,
    p_clerk_user_id: userId,
    p_verified_email: verifiedEmail,
    p_document_version: currentAdultConsentVersion(),
    p_choices: choices,
    p_access_code_hash: accessCodeHash,
    p_user_agent: requestHeaders.get("user-agent")?.slice(0, 500) || null,
    p_ip_evidence_hash: rateLimitKey(["adult-runner-consent", clientIpFromHeaders(requestHeaders)]),
  });
  if (error) redirect(`/adult/consent/${runnerId}?error=save`);

  await setAdultRunnerCredentialReveal(runner.id, runner.username, accessCode);
  redirect(`/adult/consent/complete?runnerId=${encodeURIComponent(runner.id)}`);
}

export default async function AdultRunnerConsentPage({ params, searchParams }: {
  params: Promise<{ runnerId: string }>;
  searchParams?: Promise<{ error?: string }>;
}) {
  const { userId } = await auth();
  const { runnerId } = await params;
  if (!userId) redirect(`/sign-in?redirect_url=${encodeURIComponent(`/adult/consent/${runnerId}`)}`);
  const query = await searchParams;
  const context = await getPendingAdultRunners(userId);
  const runner = context.runners.find((item) => item.id === runnerId);
  if (!runner) redirect("/adult/consent");

  return (
    <main className="min-h-screen hersemita-page-bg p-4 sm:p-8">
      <form action={grantAdultConsent.bind(null, runner.id)} className="mx-auto max-w-3xl space-y-5 rounded-2xl bg-white p-6 text-slate-900 shadow-xl">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#007ab8]">Adult runner consent</p>
          <h1 className="mt-2 text-3xl font-bold">Activate your runner portal</h1>
          <p className="mt-2 text-slate-600">{runner.first_name} {runner.last_name} · {runner.runner_email}</p>
        </div>
        {query?.error && <p className="rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">Complete every required authorization or try again.</p>}
        <Consent name="adult_authority" label="I am the named runner, I am at least 18 years old, and I am making this decision for myself." />
        <Consent name="terms" label="I have read and agree to the Terms of Service." href="/terms" />
        <Consent name="privacy" label="I have read the Privacy Policy and understand the described data practices." href="/privacy" />
        <Consent name="training_data" label="I authorize processing of my team identity, workout records, activity details, and sanitized workout-proof images for coaching purposes." />
        <Consent name="wellness_data" label="I authorize processing of my recovery and wellness entries, including soreness, illness, sleep, heart-rate, and HRV information, for coaching purposes." />
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Existing parent access is disabled. You may separately authorize parent access after activation.</div>
        <button className="w-full rounded-lg bg-slate-900 px-5 py-3 font-bold text-white">Agree and activate my portal</button>
        <p className="text-center text-xs text-slate-500">Consent document version: {currentAdultConsentVersion()}</p>
      </form>
    </main>
  );
}

function Consent({ name, label, href }: { name: string; label: string; href?: string }) {
  return <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-4">
    <input name={name} type="checkbox" required className="mt-1 h-5 w-5" />
    <span className="text-sm leading-relaxed">{label} {href && <Link href={href} target="_blank" className="font-bold text-[#007ab8] underline">Open document</Link>}</span>
  </label>;
}
