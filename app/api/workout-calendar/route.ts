import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

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

async function getCoach() {
  const { userId } = await auth();
  if (!userId) return { supabase: null, coach: null };

  const supabase = await createServerSupabaseClient();
  const { data: coach } = await supabase
    .from("coaches")
    .select("id")
    .eq("email", userId)
    .maybeSingle();

  return { supabase, coach };
}

export async function GET() {
  const { supabase, coach } = await getCoach();
  if (!supabase || !coach?.id) {
    return NextResponse.json({ error: "Coach profile required" }, { status: 401 });
  }

  const [{ data: templates, error: templateError }, { data: assignments, error: assignmentError }] = await Promise.all([
    supabase
      .from("workout_templates")
      .select("id, title, kind, miles, pace, warmup, main_set, cooldown, strength, location, notes, tags, created_at")
      .eq("coach_id", coach.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("workout_assignments")
      .select("id, assigned_date, template_id, target_type, target_id, target_label, created_at")
      .eq("coach_id", coach.id)
      .order("assigned_date", { ascending: true }),
  ]);

  if (templateError || assignmentError) {
    return NextResponse.json(
      { error: templateError?.message || assignmentError?.message || "Calendar tables are not ready" },
      { status: 500 }
    );
  }

  return NextResponse.json({
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
  });
}

export async function PUT(request: Request) {
  const { supabase, coach } = await getCoach();
  if (!supabase || !coach?.id) {
    return NextResponse.json({ error: "Coach profile required" }, { status: 401 });
  }

  const body = await request.json().catch(() => null) as {
    templates?: TemplatePayload[];
    assignments?: AssignmentPayload[];
  } | null;

  const templates = body?.templates || [];
  const assignments = body?.assignments || [];

  const { error: deleteAssignmentsError } = await supabase
    .from("workout_assignments")
    .delete()
    .eq("coach_id", coach.id);

  if (deleteAssignmentsError) {
    return NextResponse.json({ error: deleteAssignmentsError.message }, { status: 500 });
  }

  const { error: deleteTemplatesError } = await supabase
    .from("workout_templates")
    .delete()
    .eq("coach_id", coach.id);

  if (deleteTemplatesError) {
    return NextResponse.json({ error: deleteTemplatesError.message }, { status: 500 });
  }

  if (templates.length > 0) {
    const { error } = await supabase.from("workout_templates").insert(
      templates.map((template) => ({
        id: template.id,
        coach_id: coach.id,
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
          coach_id: coach.id,
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

  return NextResponse.json({ ok: true });
}
