import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import CoachHeader from "@/components/CoachHeader";
import CoachAnalyticsWorkbench from "@/components/CoachAnalyticsWorkbench";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getParentPortalContext } from "@/lib/parent-context";
import { ensureDefaultRunnerGroups } from "@/lib/runner-groups";
import { getCurrentTeamContext } from "@/lib/team-context";

type WeeklyLoadRow = {
  runner_id: string | null;
  acwr_ratio: number | string | null;
  strain: number | string | null;
  status: string | null;
};

type RecoveryLogRow = {
  runner_id: string | null;
  hrv_status: string | null;
  soreness: number | string | null;
  sleep_score: number | string | null;
};

type CoachAlertRow = {
  runner_id: string | null;
  severity: string | null;
};

export default async function AnalyticsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/");

  const supabase = await createServerSupabaseClient();
  const { data: coach } = await supabase
    .from("coaches")
    .select("id, name, school_name, preferred_distance_unit")
    .eq("clerk_id", userId)
    .single();
  const teamContext = await getCurrentTeamContext(userId);
  if (!teamContext) {
    const parentContext = await getParentPortalContext(userId);
    redirect(parentContext?.runners.length ? "/parent/dashboard" : "/settings");
  }

  const legacyCoachId = teamContext?.team.owner_coach_id || teamContext?.coach.id || coach?.id;
  const teamId = teamContext.team.id;

  if (legacyCoachId && teamId) {
    await ensureDefaultRunnerGroups(legacyCoachId, supabase, teamId);
  }

  const [{ data: runners }, { data: groups }, { data: activities }, { data: weeklyLoads }, { data: recoveryLogs }, { data: coachAlerts }] = teamId
    ? await Promise.all([
        supabase
          .from("runners")
          .select("id, first_name, last_name, grade")
          .eq("team_id", teamId)
          .order("last_name", { ascending: true }),
        supabase
          .from("runner_groups")
          .select("id, name, color")
          .eq("team_id", teamId)
          .order("name", { ascending: true }),
        supabase
          .from("activities")
          .select("id, runner_id, distance_miles, pace_per_mile, duration_seconds, start_time, verified, detected_app, runners!inner(team_id)")
          .eq("runners.team_id", teamId)
          .order("start_time", { ascending: false }),
        supabase
          .from("weekly_loads")
          .select("runner_id, week_start, acwr_ratio, strain, status, runners!inner(team_id)")
          .eq("runners.team_id", teamId)
          .order("week_start", { ascending: false }),
        supabase
          .from("recovery_logs")
          .select("runner_id, log_date, hrv_status, soreness, sleep_score, runners!inner(team_id)")
          .eq("runners.team_id", teamId)
          .order("log_date", { ascending: false }),
        supabase
          .from("coach_alerts")
          .select("runner_id, severity, dismissed, created_at")
          .eq("team_id", teamId)
          .eq("dismissed", false)
          .order("created_at", { ascending: false }),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }];

  const { data: memberships } = groups?.length
    ? await supabase
        .from("runner_group_members")
        .select("group_id, runner_id")
        .in("group_id", groups.map((group) => group.id))
    : { data: [] };

  const weeklyLoadRows = (weeklyLoads || []) as WeeklyLoadRow[];
  const recoveryLogRows = (recoveryLogs || []) as RecoveryLogRow[];
  const coachAlertRows = (coachAlerts || []) as CoachAlertRow[];

  const latestLoadByRunner = new Map<string, WeeklyLoadRow>();
  weeklyLoadRows.forEach((load) => {
    if (!load.runner_id || latestLoadByRunner.has(load.runner_id)) return;
    latestLoadByRunner.set(load.runner_id, load);
  });

  const latestRecoveryByRunner = new Map<string, RecoveryLogRow>();
  recoveryLogRows.forEach((log) => {
    if (!log.runner_id || latestRecoveryByRunner.has(log.runner_id)) return;
    latestRecoveryByRunner.set(log.runner_id, log);
  });

  const severityRank: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
  const alertsByRunner = new Map<string, { count: number; highestSeverity: string | null }>();
  coachAlertRows.forEach((alert) => {
    if (!alert.runner_id) return;
    const current = alertsByRunner.get(alert.runner_id) || { count: 0, highestSeverity: null };
    const severity = alert.severity || null;
    alertsByRunner.set(alert.runner_id, {
      count: current.count + 1,
      highestSeverity:
        severity && (severityRank[severity] || 0) > (severityRank[current.highestSeverity || ""] || 0)
          ? severity
          : current.highestSeverity,
    });
  });

  const riskSignals = (runners || []).map((runner) => {
    const load = latestLoadByRunner.get(runner.id);
    const recovery = latestRecoveryByRunner.get(runner.id);
    const alerts = alertsByRunner.get(runner.id);

    return {
      runner_id: runner.id,
      acwr_ratio: load?.acwr_ratio == null ? null : Number(load.acwr_ratio),
      strain: load?.strain == null ? null : Number(load.strain),
      load_status: load?.status || null,
      hrv_status: recovery?.hrv_status || null,
      soreness: recovery?.soreness == null ? null : Number(recovery.soreness),
      sleep_score: recovery?.sleep_score == null ? null : Number(recovery.sleep_score),
      alert_count: alerts?.count || 0,
      highest_alert_severity: alerts?.highestSeverity || null,
    };
  });

  return (
    <div className="min-h-screen hersemita-page-bg">
      <CoachHeader active="analytics" />
      <CoachAnalyticsWorkbench
        coachName={coach?.name || "Coach"}
        schoolName={teamContext?.team.school_name || teamContext?.team.name || coach?.school_name || "Team Analytics"}
        runners={runners || []}
        groups={groups || []}
        memberships={memberships || []}
        activities={activities || []}
        riskSignals={riskSignals}
        preferredDistanceUnit={teamContext?.team.default_distance_unit || coach?.preferred_distance_unit || "miles"}
      />
    </div>
  );
}
