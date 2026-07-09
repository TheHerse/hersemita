import { auth } from "@clerk/nextjs/server";
import crypto from "crypto";
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getCurrentTeamContext } from "@/lib/team-context";

type TemplatePayload = {
  id: string;
  title: string;
  kind: string;
  miles: string;
  pace: string;
  warmup: string;
  mainSet: string;
  cooldown: string;
  strength: string;
  location: string;
  notes: string;
  tags: string[];
  createdAt: string;
};

type AssignmentPayload = {
  id: string;
  date: string;
  templateId: string;
  targetType: "team" | "group" | "runner";
  targetId: string;
  targetLabel: string;
};

type ActivityRecord = {
  id: string;
  runner_id: string;
  distance_miles: number | null;
  start_time: string;
  verified: boolean | null;
};

function calendarRevision(
  templates: Array<Record<string, unknown>> | null | undefined,
  assignments: Array<Record<string, unknown>> | null | undefined
) {
  const payload = {
    templates: (templates || []).map((template) => ({
      id: template.id,
      title: template.title,
      kind: template.kind,
      miles: template.miles || "",
      pace: template.pace || "",
      warmup: template.warmup || "",
      main_set: template.main_set || "",
      cooldown: template.cooldown || "",
      strength: template.strength || "",
      location: template.location || "",
      notes: template.notes || "",
      tags: template.tags || [],
      created_at: template.created_at || "",
    })).sort((a, b) => String(a.id).localeCompare(String(b.id))),
    assignments: (assignments || []).map((assignment) => ({
      id: assignment.id,
      assigned_date: assignment.assigned_date,
      template_id: assignment.template_id,
      target_type: assignment.target_type,
      target_id: assignment.target_id,
      target_label: assignment.target_label || "",
    })).sort((a, b) => String(a.id).localeCompare(String(b.id))),
  };

  return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

async function getCoach() {
  const { userId } = await auth();
  if (!userId) return { supabase: null, coachId: null, teamId: null };

  const supabase = await createServerSupabaseClient();
  const context = await getCurrentTeamContext(userId);

  return {
    supabase,
    coachId: context?.team.owner_coach_id || context?.coach.id || null,
    teamId: context?.team.id || null,
  };
}

export async function GET() {
  const { supabase, coachId, teamId } = await getCoach();
  if (!supabase || !coachId || !teamId) {
    return NextResponse.json({ error: "Coach profile required" }, { status: 401 });
  }

  const since = new Date();
  since.setFullYear(since.getFullYear() - 1);

  const [
    { data: templates, error: templateError },
    { data: assignments, error: assignmentError },
    { data: activities, error: activityError },
    { data: groups, error: groupError },
  ] = await Promise.all([
    supabase
      .from("workout_templates")
      .select("id, title, kind, miles, pace, warmup, main_set, cooldown, strength, location, notes, tags, created_at")
      .eq("team_id", teamId)
      .order("created_at", { ascending: true }),
    supabase
      .from("workout_assignments")
      .select("id, assigned_date, template_id, target_type, target_id, target_label, created_at")
      .eq("team_id", teamId)
      .order("assigned_date", { ascending: true }),
    supabase
      .from("activities")
      .select("id, runner_id, distance_miles, start_time, verified, runners!inner(team_id)")
      .eq("runners.team_id", teamId)
      .gte("start_time", since.toISOString())
      .order("start_time", { ascending: false }),
    supabase
      .from("runner_groups")
      .select("id")
      .eq("team_id", teamId),
  ]);

  if (templateError || assignmentError || activityError || groupError) {
    return NextResponse.json(
      { error: templateError?.message || assignmentError?.message || activityError?.message || groupError?.message || "Calendar tables are not ready" },
      { status: 500 }
    );
  }

  const groupIds = (groups || []).map((group) => group.id);
  const { data: memberships, error: membershipError } = groupIds.length
    ? await supabase
        .from("runner_group_members")
        .select("group_id, runner_id")
        .in("group_id", groupIds)
    : { data: [], error: null };

  if (membershipError) {
    return NextResponse.json({ error: membershipError.message }, { status: 500 });
  }

  return NextResponse.json({
    revision: calendarRevision(templates, assignments),
    templates: (templates || []).map((template) => ({
      id: template.id,
      title: template.title,
      kind: template.kind,
      miles: template.miles || "",
      pace: template.pace || "",
      warmup: template.warmup || "",
      mainSet: template.main_set || "",
      cooldown: template.cooldown || "",
      strength: template.strength || "",
      location: template.location || "",
      notes: template.notes || "",
      tags: template.tags || [],
      createdAt: template.created_at,
    })),
    assignments: (assignments || []).map((assignment) => ({
      id: assignment.id,
      date: assignment.assigned_date,
      templateId: assignment.template_id,
      targetType: assignment.target_type,
      targetId: assignment.target_id,
      targetLabel: assignment.target_label || assignment.target_id,
    })),
    activities: ((activities || []) as ActivityRecord[]).map((activity) => ({
      id: activity.id,
      runnerId: activity.runner_id,
      distanceMiles: Number(activity.distance_miles || 0),
      startTime: activity.start_time,
      verified: Boolean(activity.verified),
    })),
    memberships: (memberships || []).map((membership) => ({
      groupId: membership.group_id,
      runnerId: membership.runner_id,
    })),
  });
}

export async function PUT(request: Request) {
  const { supabase, coachId, teamId } = await getCoach();
  if (!supabase || !coachId || !teamId) {
    return NextResponse.json({ error: "Coach profile required" }, { status: 401 });
  }

  const body = await request.json().catch(() => null) as {
    templates?: TemplatePayload[];
    assignments?: AssignmentPayload[];
    revision?: string | null;
  } | null;

  const templates = body?.templates || [];
  const assignments = body?.assignments || [];

  const [{ data: currentTemplates, error: currentTemplateError }, { data: currentAssignments, error: currentAssignmentError }] = await Promise.all([
    supabase
      .from("workout_templates")
      .select("id, title, kind, miles, pace, warmup, main_set, cooldown, strength, location, notes, tags, created_at")
      .eq("team_id", teamId),
    supabase
      .from("workout_assignments")
      .select("id, assigned_date, template_id, target_type, target_id, target_label")
      .eq("team_id", teamId),
  ]);

  if (currentTemplateError || currentAssignmentError) {
    return NextResponse.json({ error: currentTemplateError?.message || currentAssignmentError?.message || "Could not verify calendar revision" }, { status: 500 });
  }

  const currentRevision = calendarRevision(currentTemplates, currentAssignments);
  if (body?.revision && body.revision !== currentRevision) {
    return NextResponse.json(
      {
        error: "Calendar changed on another device. Refresh to load the latest version before saving.",
        revision: currentRevision,
      },
      { status: 409 }
    );
  }

  const { error: deleteAssignmentsError } = await supabase
    .from("workout_assignments")
    .delete()
    .eq("team_id", teamId);

  if (deleteAssignmentsError) {
    return NextResponse.json({ error: deleteAssignmentsError.message }, { status: 500 });
  }

  const { error: deleteTemplatesError } = await supabase
    .from("workout_templates")
    .delete()
    .eq("team_id", teamId);

  if (deleteTemplatesError) {
    return NextResponse.json({ error: deleteTemplatesError.message }, { status: 500 });
  }

  if (templates.length > 0) {
    const { error } = await supabase.from("workout_templates").insert(
      templates.map((template) => ({
        id: template.id,
        coach_id: coachId,
        team_id: teamId,
        title: template.title,
        kind: template.kind,
        miles: template.miles || null,
        pace: template.pace || null,
        warmup: template.warmup || null,
        main_set: template.mainSet || null,
        cooldown: template.cooldown || null,
        strength: template.strength || null,
        location: template.location || null,
        notes: template.notes || null,
        tags: template.tags || [],
        created_at: template.createdAt || new Date().toISOString(),
      }))
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  if (assignments.length > 0) {
    const validTemplateIds = new Set(templates.map((template) => template.id));
    const safeAssignments = assignments.filter((assignment) => validTemplateIds.has(assignment.templateId));

    if (safeAssignments.length > 0) {
      const { error } = await supabase.from("workout_assignments").insert(
        safeAssignments.map((assignment) => ({
          id: assignment.id,
          coach_id: coachId,
          team_id: teamId,
          template_id: assignment.templateId,
          assigned_date: assignment.date,
          target_type: assignment.targetType,
          target_id: assignment.targetId,
          target_label: assignment.targetLabel,
        }))
      );

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }
  }

  const [{ data: savedTemplates }, { data: savedAssignments }] = await Promise.all([
    supabase
      .from("workout_templates")
      .select("id, title, kind, miles, pace, warmup, main_set, cooldown, strength, location, notes, tags, created_at")
      .eq("team_id", teamId),
    supabase
      .from("workout_assignments")
      .select("id, assigned_date, template_id, target_type, target_id, target_label")
      .eq("team_id", teamId),
  ]);

  return NextResponse.json({ ok: true, revision: calendarRevision(savedTemplates, savedAssignments) });
}
