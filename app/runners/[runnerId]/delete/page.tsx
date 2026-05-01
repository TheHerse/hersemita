import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { supabase } from "@/lib/supabase";

async function deleteRunner(runnerId: string) {
  "use server";

  const { userId } = await auth();
  if (!userId) redirect("/");

  const { data: coach } = await supabase
    .from("coaches")
    .select("id")
    .eq("email", userId)
    .single();

  if (!coach?.id) redirect("/runners");

  const { data: runner } = await supabase
    .from("runners")
    .select("id")
    .eq("id", runnerId)
    .eq("coach_id", coach.id)
    .single();

  if (!runner?.id) redirect("/runners");

  await supabase.from("runner_group_members").delete().eq("runner_id", runner.id);
  await supabase.from("activities").delete().eq("runner_id", runner.id);

  const { error } = await supabase
    .from("runners")
    .delete()
    .eq("id", runner.id)
    .eq("coach_id", coach.id);

  if (error) {
    throw new Error(error.message);
  }

  redirect("/runners");
}

export default async function DeleteRunnerPage({
  params,
}: {
  params: Promise<{ runnerId: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/");

  const { runnerId } = await params;

  const { data: coach } = await supabase
    .from("coaches")
    .select("id")
    .eq("email", userId)
    .single();

  if (!coach?.id) redirect("/runners");

  const { data: runner } = await supabase
    .from("runners")
    .select("id, first_name, last_name, grade, parent_phone, access_code")
    .eq("id", runnerId)
    .eq("coach_id", coach.id)
    .single();

  if (!runner) redirect("/runners");

  const { count: activityCount } = await supabase
    .from("activities")
    .select("id", { count: "exact", head: true })
    .eq("runner_id", runner.id);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(239,68,68,0.16),transparent_30%),radial-gradient(circle_at_top_right,rgba(0,167,255,0.14),transparent_32%),linear-gradient(135deg,#0f172a_0%,#1e293b_48%,#0f172a_100%)] text-[#f8fafc]">
      <header className="border-b border-slate-200 bg-white px-4 py-3 sticky top-0 z-50 shadow-sm sm:px-6 sm:py-4">
        <div className="max-w-7xl mx-auto flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg overflow-hidden bg-white">
              <Image src="/logo.png" alt="Hersemita" width={40} height={40} className="w-full h-full object-contain" />
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-[#00ff67] to-[#00a7ff] bg-clip-text text-transparent">
              Hersemita
            </h1>
          </Link>
          <Link href="/runners" className="w-full rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-center text-sm font-bold text-white transition hover:bg-white/15 sm:w-auto">
            &larr; Back to Runners
          </Link>
        </div>
      </header>

      <main className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto">
        <div className="overflow-hidden rounded-2xl border border-red-500/30 bg-white/5 shadow-2xl shadow-black/20">
          <div className="border-b border-red-500/20 bg-red-500/10 p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-red-300">Delete Runner</p>
            <h2 className="mt-2 text-3xl font-bold text-white">
              Are you sure?
            </h2>
            <p className="mt-2 text-[#cbd5e1]">
              This removes the runner and their uploaded activity history from this coach account.
            </p>
          </div>

          <div className="p-6 space-y-5">
            <div className="rounded-xl border border-white/10 bg-[#111827] p-4">
              <div className="text-xl font-bold text-white">
                {runner.first_name} {runner.last_name}
              </div>
              <div className="mt-4 grid gap-3 text-sm text-[#cbd5e1] sm:grid-cols-2">
                <p>Grade: {runner.grade}th</p>
                <p>Access code: {runner.access_code}</p>
                <p>Parent phone: {runner.parent_phone || "Not set"}</p>
                <p>Activities: {activityCount || 0}</p>
              </div>
            </div>

            <div className="rounded-xl border border-orange-400/30 bg-orange-400/10 p-4 text-sm text-orange-200">
              Deleting test runners is fine, but this action cannot be undone from the app.
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href="/runners"
                className="flex-1 rounded-lg border border-white/10 px-4 py-3 text-center font-semibold text-[#cbd5e1] transition hover:border-[#00a7ff]/60 hover:text-white"
              >
                Cancel
              </Link>
              <form action={deleteRunner.bind(null, runner.id)} className="flex-1">
                <button
                  type="submit"
                  className="w-full rounded-lg bg-red-600 px-4 py-3 font-bold text-white transition-colors hover:bg-red-700"
                >
                  Yes, Delete Runner
                </button>
              </form>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
