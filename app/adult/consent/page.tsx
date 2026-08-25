import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getPendingAdultRunners } from "@/lib/adult-runner-context";

export default async function AdultConsentLandingPage() {
  const { userId } = await auth();
  if (!userId) redirect(`/sign-in?redirect_url=${encodeURIComponent("/adult/consent")}`);
  const { runners } = await getPendingAdultRunners(userId);
  if (runners.length === 1) redirect(`/adult/consent/${runners[0].id}`);

  return (
    <main className="min-h-screen hersemita-page-bg p-4 sm:p-8">
      <section className="mx-auto max-w-2xl rounded-2xl bg-white p-6 text-slate-900 shadow-xl">
        <h1 className="text-3xl font-bold">Adult runner authorization</h1>
        {runners.length === 0 ? (
          <p className="mt-4 text-slate-600">No adult runner invitation matches a verified email on this account. Ask the coach to verify the runner email.</p>
        ) : (
          <div className="mt-5 grid gap-3">
            {runners.map((runner) => (
              <Link key={runner.id} href={`/adult/consent/${runner.id}`} className="rounded-lg border border-slate-200 p-4 font-bold transition hover:border-[#00a7ff]">
                {runner.first_name} {runner.last_name} · Grade {runner.grade ?? "--"}
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
