import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createActivityScreenshotSignedUrl } from "@/lib/activity-screenshot-storage";
import { getRunnerSession } from "@/lib/runner-session";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentTeamContext } from "@/lib/team-context";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ activityId: string; index: string }>;
};

export async function GET(_request: Request, { params }: RouteContext) {
  const { activityId, index: rawIndex } = await params;
  const index = Number(rawIndex);
  if (!activityId || !Number.isSafeInteger(index) || index < 0 || index > 9) {
    return NextResponse.json({ error: "Screenshot not found" }, { status: 404 });
  }

  const { userId } = await auth();
  const runnerSession = userId ? null : await getRunnerSession();

  let activityQuery = supabaseAdmin
    .from("activities")
    .select("runner_id, screenshot_urls, runners!inner(team_id)")
    .eq("id", activityId);

  if (userId) {
    const context = await getCurrentTeamContext(userId);
    if (!context?.team.id) {
      return NextResponse.json({ error: "Screenshot not found" }, { status: 404 });
    }
    activityQuery = activityQuery.eq("runners.team_id", context.team.id);
  } else if (runnerSession) {
    activityQuery = activityQuery.eq("runner_id", runnerSession.runnerId);
  } else {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { data: activity } = await activityQuery.maybeSingle();
  const reference = activity?.screenshot_urls?.[index];
  if (typeof reference !== "string") {
    return NextResponse.json({ error: "Screenshot not found" }, { status: 404 });
  }

  const signedUrl = await createActivityScreenshotSignedUrl(reference);
  if (!signedUrl) {
    return NextResponse.json({ error: "Screenshot not found" }, { status: 404 });
  }

  return NextResponse.json(
    { url: signedUrl },
    { headers: { "Cache-Control": "no-store" } }
  );
}
