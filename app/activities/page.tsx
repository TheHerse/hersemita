import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import ActivityAppBadge from "@/components/ActivityAppBadge";
import CoachHeader from "@/components/CoachHeader";
import DeleteActivityButton from "@/components/DeleteActivityButton";
import ScreenshotProofViewer from "@/components/ScreenshotProofViewer";
import { formatPace } from "@/lib/activity-format";
import { removeActivityScreenshots } from "@/lib/activity-screenshot-storage";
import { logAuditEvent } from "@/lib/audit-log";
import { distanceUnitLabel, milesToDistance, normalizeDistanceUnit, paceFromMiles } from "@/lib/distance-units";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getCurrentTeamContext } from "@/lib/team-context";

const PAGE_SIZE = 25;
const RANGE_OPTIONS = [
  { label: "30 days", value: "30" },
  { label: "90 days", value: "90" },
  { label: "All", value: "all" },
];
const STATUS_OPTIONS = [
  { label: "All", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Verified", value: "verified" },
];

async function verifyActivity(activityId: string) {
  "use server";

  const { userId } = await auth();
  if (!userId) redirect("/");
  const supabase = await createServerSupabaseClient();
  const context = await getCurrentTeamContext(userId);
  const teamId = context?.team.id;

  const { data: activity } = await supabase
    .from("activities")
    .select("id, runners!inner(team_id)")
    .eq("id", activityId)
    .eq("runners.team_id", teamId)
    .single();

  if (!activity?.id) redirect("/activities");

  const { error } = await supabase
    .from("activities")
    .update({ verified: true })
    .eq("id", activity.id);

  if (error) throw new Error(error.message);

  await logAuditEvent({
    teamId,
    actorCoachId: context?.coach.id,
    actorClerkId: userId,
    action: "activity.verified",
    entityType: "activity",
    entityId: activity.id,
  });
  
  redirect("/activities");
}

async function deleteActivity(activityId: string) {
  "use server";

  const { userId } = await auth();
  if (!userId) redirect("/");
  const supabase = await createServerSupabaseClient();
  const context = await getCurrentTeamContext(userId);
  const teamId = context?.team.id;

  const { data: activity } = await supabase
    .from("activities")
    .select("id, screenshot_urls, runners!inner(team_id)")
    .eq("id", activityId)
    .eq("runners.team_id", teamId)
    .single();

  if (!activity?.id) redirect("/activities");

  await removeActivityScreenshots(activity.screenshot_urls);

  const { error } = await supabase.from("activities").delete().eq("id", activity.id);
  if (error) throw new Error(error.message);

  await logAuditEvent({
    teamId,
    actorCoachId: context?.coach.id,
    actorClerkId: userId,
    action: "activity.deleted",
    entityType: "activity",
    entityId: activity.id,
    metadata: {
      screenshotCount: activity.screenshot_urls?.length || 0,
    },
  });

  redirect("/activities");
}

export default async function ActivitiesPage({
  searchParams,
}: {
  searchParams?: Promise<{ range?: string; status?: string; page?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/");
  const supabase = await createServerSupabaseClient();
  const teamContext = await getCurrentTeamContext(userId);
  const teamId = teamContext?.team.id;
  const params = await searchParams;
  const range = params?.range === "all" ? "all" : params?.range === "30" ? "30" : "90";
  const status = params?.status === "pending" || params?.status === "verified" ? params.status : "all";
  const page = Math.max(1, Number(params?.page || "1") || 1);

  const { data: coach } = await supabase
    .from("coaches")
    .select("id, preferred_distance_unit")
    .eq("clerk_id", userId)
    .single();
  const preferredDistanceUnit = normalizeDistanceUnit(teamContext?.team.default_distance_unit || coach?.preferred_distance_unit);
  const unitLabel = distanceUnitLabel(preferredDistanceUnit);

  let activityQuery = supabase
    .from("activities")
    .select(`
      *,
      runners!inner (
        id,
        first_name,
        last_name,
        team_id
      )
    `, { count: "exact" })
    .eq("runners.team_id", teamId)
    .order("start_time", { ascending: false });

  if (range !== "all") {
    const since = new Date();
    since.setDate(since.getDate() - Number(range));
    activityQuery = activityQuery.gte("start_time", since.toISOString());
  }

  if (status === "pending") activityQuery = activityQuery.eq("verified", false);
  if (status === "verified") activityQuery = activityQuery.eq("verified", true);

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const { data: activities, count: activityCount } = await activityQuery.range(from, to);

  const pendingCount = activities?.filter((activity) => !activity.verified).length || 0;
  const totalPages = Math.max(1, Math.ceil((activityCount || 0) / PAGE_SIZE));
  const previousPage = Math.max(1, page - 1);
  const nextPage = Math.min(totalPages, page + 1);
  const queryBase = `range=${range}&status=${status}`;

  return (
    <div className="min-h-screen hersemita-page-bg text-white">
      <CoachHeader active="activities" />

      <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
        <div className="mb-8 rounded-2xl border border-white/10 bg-white/10 p-5 shadow-2xl shadow-black/10 backdrop-blur sm:p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#00a7ff]">Activity Management</p>
          <h2 className="mt-2 text-3xl font-bold text-white sm:text-4xl">Runs Needing Review</h2>
          <p className="mt-2 text-[#cbd5e1]">
            Review screenshots, verify pending runs, and edit details only when you choose to.
          </p>
          <div className="mt-4 inline-flex rounded-full border border-orange-400/30 bg-orange-400/10 px-4 py-2 text-sm font-bold text-orange-200">
            {pendingCount} pending in view
          </div>
        </div>

        <div className="mb-6 rounded-2xl border border-white/10 bg-white/10 p-4 shadow-xl shadow-black/10 backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {RANGE_OPTIONS.map((option) => (
                <Link
                  key={option.value}
                  href={`/activities?range=${option.value}&status=${status}`}
                  className={`rounded-lg border px-3 py-2 text-sm font-bold transition ${
                    range === option.value
                      ? "border-[#00a7ff] bg-[#00a7ff]/20 text-[#7dd3fc]"
                      : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
                  }`}
                >
                  {option.label}
                </Link>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map((option) => (
                <Link
                  key={option.value}
                  href={`/activities?range=${range}&status=${option.value}`}
                  className={`rounded-lg border px-3 py-2 text-sm font-bold transition ${
                    status === option.value
                      ? "border-[#00ff67] bg-[#00ff67]/15 text-[#86efac]"
                      : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
                  }`}
                >
                  {option.label}
                </Link>
              ))}
            </div>
          </div>
          <p className="mt-3 text-sm text-[#cbd5e1]">
            Showing {activities?.length || 0} of {activityCount || 0} matching activities.
          </p>
        </div>

        <div className="space-y-4">
          {activities?.map((activity) => {
            const runner = activity.runners;
            const distanceDisplay = milesToDistance(Number(activity.distance_miles || 0), preferredDistanceUnit);
            const paceDisplay = formatPace(paceFromMiles(Number(activity.pace_per_mile || 0), preferredDistanceUnit));

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
                      <p className="mt-1 text-lg font-bold text-white">{distanceDisplay.toFixed(2)} {unitLabel}</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-[#111827] p-3">
                      <p className="text-[#94a3b8]">Pace</p>
                      <p className="mt-1 text-lg font-bold text-white">{paceDisplay}/{unitLabel}</p>
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

        {totalPages > 1 && (
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-bold text-[#cbd5e1]">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <Link
                href={`/activities?${queryBase}&page=${previousPage}`}
                className={`rounded-lg border border-white/10 px-4 py-2 text-sm font-bold text-white transition ${page <= 1 ? "pointer-events-none opacity-40" : "hover:bg-white/10"}`}
              >
                Previous
              </Link>
              <Link
                href={`/activities?${queryBase}&page=${nextPage}`}
                className={`rounded-lg border border-white/10 px-4 py-2 text-sm font-bold text-white transition ${page >= totalPages ? "pointer-events-none opacity-40" : "hover:bg-white/10"}`}
              >
                Next
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
