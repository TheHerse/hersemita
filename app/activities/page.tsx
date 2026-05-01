import { auth } from "@clerk/nextjs/server";
import { UserButton } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import ActivityAppBadge from "@/components/ActivityAppBadge";
import CoachMobileMenu from "@/components/CoachMobileMenu";
import DeleteActivityButton from "@/components/DeleteActivityButton";
import ScreenshotProofViewer from "@/components/ScreenshotProofViewer";
import { formatPace } from "@/lib/activity-format";
import { supabase } from "@/lib/supabase";

async function verifyActivity(activityId: string) {
  "use server";

  const { userId } = await auth();
  if (!userId) redirect("/");

  const { data: activity } = await supabase
    .from("activities")
    .select("id, runners!inner(coach_id, coaches!inner(email))")
    .eq("id", activityId)
    .eq("runners.coaches.email", userId)
    .single();

  if (!activity?.id) redirect("/activities");

  const { error } = await supabase
    .from("activities")
    .update({ verified: true })
    .eq("id", activity.id);

  if (error) throw new Error(error.message);

  redirect("/activities");
}

async function deleteActivity(activityId: string) {
  "use server";

  const { userId } = await auth();
  if (!userId) redirect("/");

  const { data: activity } = await supabase
    .from("activities")
    .select("id, runners!inner(coach_id, coaches!inner(email))")
    .eq("id", activityId)
    .eq("runners.coaches.email", userId)
    .single();

  if (!activity?.id) redirect("/activities");

  const { error } = await supabase.from("activities").delete().eq("id", activity.id);
  if (error) throw new Error(error.message);

  redirect("/activities");
}

export default async function ActivitiesPage() {
  const { userId } = await auth();
  if (!userId) redirect("/");

  const { data: coach } = await supabase
    .from("coaches")
    .select("id")
    .eq("email", userId)
    .single();

  const { data: activities } = await supabase
    .from("activities")
    .select(`
      *,
      runners!inner (
        id,
        first_name,
        last_name,
        coach_id
      )
    `)
    .eq("runners.coach_id", coach?.id)
    .order("start_time", { ascending: false });

  const pendingCount = activities?.filter((activity) => !activity.verified).length || 0;

  return (
    <div className="min-h-screen hersemita-page-bg text-white">
      <header className="border-b border-slate-200 bg-white px-4 py-3 sticky top-0 z-50 shadow-sm sm:px-6 sm:py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg overflow-hidden bg-white">
              <Image src="/logo.png" alt="Hersemita" width={40} height={40} className="w-full h-full object-contain" />
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-[#00ff67] to-[#00a7ff] bg-clip-text text-transparent">
              Hersemita
            </h1>
          </Link>

          <div className="hidden items-center gap-3 sm:flex">
            <Link href="/dashboard" className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-[#00a7ff]/60 hover:text-[#00a7ff]">Dashboard</Link>
            <Link href="/runners" className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-[#00a7ff]/60 hover:text-[#00a7ff]">Runners</Link>
            <Link href="/groups" className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-[#00a7ff]/60 hover:text-[#00a7ff]">Groups</Link>
            <Link href="/settings" className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-[#00a7ff]/60 hover:text-[#00a7ff]">Settings</Link>
            <UserButton afterSignOutUrl="/" />
          </div>
          <CoachMobileMenu
            showUserButton
            links={[
              { href: "/dashboard", label: "Dashboard" },
              { href: "/runners", label: "Runners" },
              { href: "/groups", label: "Groups" },
              { href: "/runners/message", label: "Message Parents" },
              { href: "/settings", label: "Settings" },
            ]}
          />
        </div>
      </header>

      <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
        <div className="mb-8 rounded-2xl border border-white/10 bg-white/10 p-5 shadow-2xl shadow-black/10 backdrop-blur sm:p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#00a7ff]">Activity Management</p>
          <h2 className="mt-2 text-3xl font-bold text-white sm:text-4xl">Runs Needing Review</h2>
          <p className="mt-2 text-[#cbd5e1]">
            Review screenshots, verify pending runs, and edit details only when you choose to.
          </p>
          <div className="mt-4 inline-flex rounded-full border border-orange-400/30 bg-orange-400/10 px-4 py-2 text-sm font-bold text-orange-200">
            {pendingCount} pending
          </div>
        </div>

        <div className="space-y-4">
          {activities?.map((activity) => {
            const runner = activity.runners;
            const paceDisplay = formatPace(activity.pace_per_mile);

            return (
              <article key={activity.id} className="rounded-2xl border border-white/10 bg-white/10 p-4 shadow-xl shadow-black/10 backdrop-blur sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="text-xl font-bold text-white">
                      {runner.first_name} {runner.last_name}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-[#cbd5e1]">
                      <span>{new Date(activity.start_time).toLocaleDateString()}</span>
                      <span>/</span>
                      <ActivityAppBadge app={activity.detected_app} />
                      <span className={activity.verified ? "rounded-full bg-[#00ff67]/10 px-3 py-1 text-xs font-bold text-[#86efac]" : "rounded-full bg-orange-400/10 px-3 py-1 text-xs font-bold text-orange-200"}>
                        {activity.verified ? "Verified" : "Pending"}
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm sm:min-w-[240px]">
                    <div className="rounded-xl border border-white/10 bg-[#111827] p-3">
                      <p className="text-[#94a3b8]">Distance</p>
                      <p className="mt-1 text-lg font-bold text-white">{activity.distance_miles?.toFixed(2)} mi</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-[#111827] p-3">
                      <p className="text-[#94a3b8]">Pace</p>
                      <p className="mt-1 text-lg font-bold text-white">{paceDisplay}/mi</p>
                    </div>
                  </div>
                </div>

                {(activity.raw_distance || activity.raw_pace) && (
                  <div className="mt-3 text-sm text-[#94a3b8]">
                    Detected: {activity.raw_distance || "distance unknown"} {activity.raw_pace ? `/ ${activity.raw_pace}` : ""}
                  </div>
                )}

                <ScreenshotProofViewer urls={activity.screenshot_urls} />

                <div className="mt-4 flex flex-col gap-2 border-t border-white/10 pt-4 sm:flex-row sm:justify-end">
                  <Link href={`/activities/${activity.id}/edit`} className="rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-center text-sm font-bold text-white transition hover:bg-white/15">
                    Edit
                  </Link>
                  {!activity.verified && (
                    <form action={verifyActivity.bind(null, activity.id)}>
                      <button type="submit" className="w-full rounded-lg bg-[#00d95a] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#00ff67] sm:w-auto">
                        Verify
                      </button>
                    </form>
                  )}
                  <form action={deleteActivity.bind(null, activity.id)}>
                    <DeleteActivityButton activityId={activity.id} />
                  </form>
                </div>
              </article>
            );
          })}

          {activities?.length === 0 && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-10 text-center">
              <h3 className="text-2xl font-bold text-white">No activities yet</h3>
              <p className="mt-2 text-[#cbd5e1]">Runner uploads and coach uploads will appear here.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
