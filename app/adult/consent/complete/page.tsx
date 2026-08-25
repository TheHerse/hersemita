import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdultRunnerCredentialReveal } from "@/lib/runner-credential-reveal";

export default async function AdultConsentCompletePage({ searchParams }: { searchParams: Promise<{ runnerId?: string }> }) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const { runnerId } = await searchParams;
  if (!runnerId) redirect("/adult/consent");
  const reveal = await getAdultRunnerCredentialReveal(runnerId);
  if (!reveal) redirect("/adult/consent");

  return <main className="min-h-screen hersemita-page-bg p-4 sm:p-8">
    <section className="mx-auto max-w-xl rounded-2xl bg-white p-6 text-slate-900 shadow-xl">
      <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#0f8f45]">Portal activated</p>
      <h1 className="mt-2 text-3xl font-bold">Save your runner credentials</h1>
      <p className="mt-3 text-slate-600">This passcode is shown for five minutes and cannot be recovered later. It can only be reset.</p>
      <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 font-mono text-lg">
        <p>Username: <strong>{reveal.username}</strong></p>
        <p>Passcode: <strong>{reveal.accessCode}</strong></p>
      </div>
      <Link href="/runner/login" className="mt-6 inline-flex rounded-lg bg-slate-900 px-5 py-3 font-bold text-white">Continue to runner login</Link>
    </section>
  </main>;
}
