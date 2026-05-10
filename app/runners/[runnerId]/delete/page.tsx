import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import CoachHeader from "@/components/CoachHeader";

async function deleteRunner(runnerId: string) {
  "use server";

  const { userId } = await auth();
  if (!userId) redirect("/");
  const supabase = await createServerSupabaseClient();

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
  const supabase = await createServerSupabaseClient();

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
    <div className="min-h-screen hersemita-page-bg text-[#f8fafc]">
      <CoachHeader active="runners" />

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
