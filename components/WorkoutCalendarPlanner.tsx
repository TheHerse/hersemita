"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Runner = {
  id: string;
  first_name: string;
  last_name: string;
  grade: number | null;
};

type Group = {
  id: string;
  name: string;
  color: string | null;
};

type WorkoutKind = "run" | "intervals" | "tempo" | "long" | "recovery" | "strength" | "track" | "meet";

type WorkoutTemplate = {
  id: string;
  title: string;
  kind: WorkoutKind;
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

type CalendarAssignment = {
  id: string;
  date: string;
  templateId: string;
  targetType: "team" | "group" | "runner";
  targetId: string;
  targetLabel: string;
};

type CompletedActivity = {
  id: string;
  runnerId: string;
  distanceMiles: number;
  startTime: string;
  verified: boolean;
};

type GroupMembership = {
  groupId: string;
  runnerId: string;
};

const STORAGE_KEY = "hersemita-workout-calendar-v1";
const STARTER_ID_MAP: Record<string, string> = {
  "starter-easy": "11111111-1111-4111-8111-111111111111",
  "starter-tempo": "22222222-2222-4222-8222-222222222222",
  "starter-track": "33333333-3333-4333-8333-333333333333",
  "starter-gym": "44444444-4444-4444-8444-444444444444",
};

const WORKOUT_TYPES: Array<{ value: WorkoutKind; label: string; color: string }> = [
  { value: "run", label: "Short Run", color: "#00a7ff" },
  { value: "intervals", label: "Intervals", color: "#f59e0b" },
  { value: "tempo", label: "Tempo", color: "#00ff67" },
  { value: "long", label: "Long Run", color: "#14b8a6" },
  { value: "recovery", label: "Recovery", color: "#7dd3fc" },
  { value: "strength", label: "Gym Day", color: "#a78bfa" },
  { value: "track", label: "Track Workout", color: "#fb7185" },
  { value: "meet", label: "Meet Prep", color: "#ef4444" },
];

const STARTER_TEMPLATES: WorkoutTemplate[] = [
  {
    id: STARTER_ID_MAP["starter-easy"],
    title: "Aerobic Base Run",
    kind: "run",
    miles: "4-6",
    pace: "Conversational",
    warmup: "Dynamic drills, leg swings, 5 min jog",
    mainSet: "Steady mileage on soft surface",
    cooldown: "4 x 20 sec strides, stretch hips/calves",
    strength: "Core 8 min",
    location: "Trails or neighborhood loop",
    notes: "Use for most athletes after hard days or before workout days.",
    tags: ["base", "team"],
    createdAt: new Date().toISOString(),
  },
  {
    id: STARTER_ID_MAP["starter-tempo"],
    title: "Tempo Progression",
    kind: "tempo",
    miles: "5-7",
    pace: "Threshold",
    warmup: "1.5 mi easy, drills, 4 strides",
    mainSet: "3 x 8 min tempo with 2 min jog recovery",
    cooldown: "1 mi easy",
    strength: "Mobility only",
    location: "Park loop",
    notes: "Adjust reps by group. Younger runners can do 2 reps.",
    tags: ["threshold", "varsity"],
    createdAt: new Date().toISOString(),
  },
  {
    id: STARTER_ID_MAP["starter-track"],
    title: "Track Repeats",
    kind: "track",
    miles: "2-4",
    pace: "Fast reps, easy recoveries",
    warmup: "10 min jog, sprint drills",
    mainSet: "8-12 x 400m at controlled workout effort with 200m jog recovery.",
    cooldown: "10 min easy",
    strength: "Bodyweight circuit: squats, lunges, planks",
    location: "Track",
    notes: "Use for controlled speed, pacing practice, or race-specific rhythm.",
    tags: ["speed", "track"],
    createdAt: new Date().toISOString(),
  },
  {
    id: STARTER_ID_MAP["starter-gym"],
    title: "Gym Strength Circuit",
    kind: "strength",
    miles: "0-2",
    pace: "Optional shakeout",
    warmup: "Bike or jog 8 min",
    mainSet: "3 rounds: goblet squat, RDL, step-ups, rows, calf raises",
    cooldown: "Stretch and foam roll",
    strength: "Primary focus",
    location: "Weight room",
    notes: "Keep loads moderate during race week.",
    tags: ["strength", "injury-prevention"],
    createdAt: new Date().toISOString(),
  },
];

const EMPTY_TEMPLATE: WorkoutTemplate = {
  id: "",
  title: "",
  kind: "run",
  miles: "",
  pace: "",
  warmup: "",
  mainSet: "",
  cooldown: "",
  strength: "",
  location: "",
  notes: "",
  tags: [],
  createdAt: "",
};

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function isoDateFromValue(value: string) {
  return isoDate(new Date(value));
}

function parseMileageRange(value: string) {
  const numbers = value.match(/\d+(\.\d+)?/g)?.map(Number).filter((number) => Number.isFinite(number)) || [];
  if (numbers.length >= 2) return (numbers[0] + numbers[1]) / 2;
  return numbers[0] || 0;
}

function formatMiles(value: number) {
  return value >= 10 ? value.toFixed(0) : value.toFixed(1);
}

function startOfWeek(date: Date) {
  const next = new Date(date);
  const day = next.getDay();
  next.setDate(next.getDate() - day);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function typeMeta(kind: WorkoutKind) {
  return WORKOUT_TYPES.find((type) => type.value === kind) || WORKOUT_TYPES[0];
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function normalizeCalendarData(data: {
  templates?: WorkoutTemplate[];
  assignments?: CalendarAssignment[];
}) {
  const idMap = new Map<string, string>();
  const templates = (data.templates?.length ? data.templates : STARTER_TEMPLATES).map((template) => {
    const id = STARTER_ID_MAP[template.id] || (isUuid(template.id) ? template.id : crypto.randomUUID());
    idMap.set(template.id, id);
    return {
      ...template,
      id,
      createdAt: template.createdAt || new Date().toISOString(),
    };
  });

  const assignments = (data.assignments || [])
    .map((assignment) => ({
      ...assignment,
      id: isUuid(assignment.id) ? assignment.id : crypto.randomUUID(),
      templateId: idMap.get(assignment.templateId) || assignment.templateId,
    }))
    .filter((assignment) => templates.some((template) => template.id === assignment.templateId));

  return { templates, assignments };
}

export default function WorkoutCalendarPlanner({
  coachName,
  schoolName,
  runners,
  groups,
}: {
  coachName: string;
  schoolName: string;
  runners: Runner[];
  groups: Group[];
}) {
  const [templates, setTemplates] = useState<WorkoutTemplate[]>(STARTER_TEMPLATES);
  const [assignments, setAssignments] = useState<CalendarAssignment[]>([]);
  const [activities, setActivities] = useState<CompletedActivity[]>([]);
  const [memberships, setMemberships] = useState<GroupMembership[]>([]);
  const [form, setForm] = useState<WorkoutTemplate>(EMPTY_TEMPLATE);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [selectedDate, setSelectedDate] = useState(isoDate(new Date()));
  const [targetType, setTargetType] = useState<CalendarAssignment["targetType"]>("team");
  const [targetId, setTargetId] = useState("team");
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [libraryFilter, setLibraryFilter] = useState<WorkoutKind | "all">("all");
  const [librarySearch, setLibrarySearch] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [templateError, setTemplateError] = useState("");
  const [showWorkoutDetails, setShowWorkoutDetails] = useState(false);
  const [showCreateWorkoutForm, setShowCreateWorkoutForm] = useState(false);
  const [showMobileDayDetails, setShowMobileDayDetails] = useState(false);
  const [dayWorkoutTool, setDayWorkoutTool] = useState<"create" | "library" | null>(null);
  const [calendarLoaded, setCalendarLoaded] = useState(false);
  const [calendarRevision, setCalendarRevision] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState("Loading calendar...");
  const calendarRevisionRef = useRef<string | null>(null);

  useEffect(() => {
    calendarRevisionRef.current = calendarRevision;
  }, [calendarRevision]);

  useEffect(() => {
    let active = true;

    async function loadCalendar() {
      let localData: { templates?: WorkoutTemplate[]; assignments?: CalendarAssignment[] } | null = null;
      try {
        const saved = window.localStorage.getItem(STORAGE_KEY);
        if (saved) localData = JSON.parse(saved);
      } catch {
        localData = null;
      }

      try {
        const response = await fetch("/api/workout-calendar");
        const remote = await response.json().catch(() => null) as {
          templates?: WorkoutTemplate[];
          assignments?: CalendarAssignment[];
          activities?: CompletedActivity[];
          memberships?: GroupMembership[];
          revision?: string;
          error?: string;
        } | null;

        if (!active) return;

        if (!response.ok) {
          const normalized = normalizeCalendarData(localData || { templates: STARTER_TEMPLATES, assignments: [] });
          setTemplates(normalized.templates);
          setAssignments(normalized.assignments);
          setActivities([]);
          setMemberships([]);
          setSelectedTemplateId("");
          setSyncStatus(remote?.error || "Run the calendar SQL, then refresh.");
          setCalendarLoaded(true);
          return;
        }

        const hasRemoteData = Boolean(remote?.templates?.length || remote?.assignments?.length);
        const normalized = normalizeCalendarData(
          hasRemoteData ? { templates: remote?.templates, assignments: remote?.assignments } : localData || { templates: STARTER_TEMPLATES, assignments: [] }
        );

        setTemplates(normalized.templates);
        setAssignments(normalized.assignments);
        setActivities(remote?.activities || []);
        setMemberships(remote?.memberships || []);
        setCalendarRevision(remote?.revision || null);
        setSelectedTemplateId("");
        setSyncStatus(hasRemoteData ? "Synced to student portal." : localData ? "Migrating saved browser calendar to Supabase..." : "Ready to sync calendar.");
        setCalendarLoaded(true);
      } catch {
        if (!active) return;
        const normalized = normalizeCalendarData(localData || { templates: STARTER_TEMPLATES, assignments: [] });
        setTemplates(normalized.templates);
        setAssignments(normalized.assignments);
        setActivities([]);
        setMemberships([]);
        setSelectedTemplateId("");
        setSyncStatus("Calendar is in browser fallback mode.");
        setCalendarLoaded(true);
      }
    }

    loadCalendar();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!calendarLoaded) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ templates, assignments }));

    const timeout = window.setTimeout(async () => {
      try {
        setSyncStatus("Saving calendar...");
        const response = await fetch("/api/workout-calendar", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ templates, assignments, revision: calendarRevisionRef.current }),
        });
        const result = await response.json().catch(() => null) as { error?: string; revision?: string } | null;

        if (response.ok) {
          setCalendarRevision(result?.revision || null);
          setSyncStatus("Synced to student portal.");
          return;
        }

        setSyncStatus(result?.error || "Calendar sync failed.");
      } catch {
        setSyncStatus("Calendar sync failed. Check Supabase calendar tables.");
      }
    }, 600);

    return () => window.clearTimeout(timeout);
  }, [assignments, calendarLoaded, templates]);

  const monthDays = useMemo(() => {
    const monthStart = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
    const monthEnd = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0);
    const gridStart = startOfWeek(monthStart);
    const gridEnd = addDays(startOfWeek(monthEnd), 6);
    const days = [];
    for (let day = new Date(gridStart); day <= gridEnd; day = addDays(day, 1)) {
      days.push(new Date(day));
    }
    return days;
  }, [calendarMonth]);

  const selectedTemplate = templates.find((template) => template.id === selectedTemplateId);

  const filteredTemplates = templates.filter((template) => {
    const matchesType = libraryFilter === "all" || template.kind === libraryFilter;
    const matchesSearch = template.title.toLowerCase().includes(librarySearch.trim().toLowerCase());
    return matchesType && matchesSearch;
  });

  const currentMonthAssignments = assignments.filter((assignment) => {
    const date = new Date(`${assignment.date}T00:00:00`);
    return date.getMonth() === calendarMonth.getMonth() && date.getFullYear() === calendarMonth.getFullYear();
  });

  const templatesById = useMemo(() => new Map(templates.map((template) => [template.id, template])), [templates]);

  const groupRunnerIds = useMemo(() => {
    const map = new Map<string, string[]>();
    memberships.forEach((membership) => {
      const current = map.get(membership.groupId) || [];
      current.push(membership.runnerId);
      map.set(membership.groupId, current);
    });
    return map;
  }, [memberships]);

  const teamRunnerIds = useMemo(() => runners.map((runner) => runner.id), [runners]);

  const resolveAssignmentRunnerIds = useCallback((assignment: CalendarAssignment) => {
    if (assignment.targetType === "team") return teamRunnerIds;
    if (assignment.targetType === "group") return groupRunnerIds.get(assignment.targetId) || [];
    return assignment.targetId ? [assignment.targetId] : [];
  }, [groupRunnerIds, teamRunnerIds]);

  const monthStats = useMemo(() => {
    const viewedMonthKey = `${calendarMonth.getFullYear()}-${String(calendarMonth.getMonth() + 1).padStart(2, "0")}`;
    const todayKey = isoDate(new Date());
    const completedUploadKeys = new Set(activities.map((activity) => `${activity.runnerId}:${isoDateFromValue(activity.startTime)}`));
    let plannedMiles = 0;
    let plannedRunnerDays = 0;
    let missedUploads = 0;
    let upcomingSlots = 0;
    let dueRunnerDays = 0;
    let completedRunnerDays = 0;

    currentMonthAssignments.forEach((assignment) => {
      const template = templatesById.get(assignment.templateId);
      const assignedRunnerIds = resolveAssignmentRunnerIds(assignment);
      const targetRunnerCount = Math.max(assignedRunnerIds.length, 1);
      plannedMiles += parseMileageRange(template?.miles || "") * targetRunnerCount;
      plannedRunnerDays += targetRunnerCount;

      assignedRunnerIds.forEach((runnerId) => {
        const key = `${runnerId}:${assignment.date}`;
        if (assignment.date <= todayKey) {
          dueRunnerDays += 1;
          if (completedUploadKeys.has(key)) completedRunnerDays += 1;
        }
        if (assignment.date < todayKey && !completedUploadKeys.has(key)) missedUploads += 1;
        if (assignment.date >= todayKey) upcomingSlots += 1;
      });
    });

    const completedMiles = activities.reduce((sum, activity) => {
      const activityMonthKey = isoDateFromValue(activity.startTime).slice(0, 7);
      if (!activity.verified || activityMonthKey !== viewedMonthKey) return sum;
      return sum + activity.distanceMiles;
    }, 0);

    return {
      plannedMiles,
      completedMiles,
      plannedRunnerDays,
      dueRunnerDays,
      completedRunnerDays,
      completionRate: dueRunnerDays > 0 ? completedRunnerDays / dueRunnerDays : 0,
      missedUploads,
      upcomingSlots,
    };
  }, [activities, calendarMonth, currentMonthAssignments, resolveAssignmentRunnerIds, templatesById]);

  const selectedDayAssignments = assignments.filter((assignment) => assignment.date === selectedDate);
  const selectedDateLabel = new Date(`${selectedDate}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const targetOptions = useMemo(() => {
    if (targetType === "group") return groups.map((group) => ({ id: group.id, label: group.name }));
    if (targetType === "runner") return runners.map((runner) => ({ id: runner.id, label: `${runner.first_name} ${runner.last_name}` }));
    return [{ id: "team", label: "Entire team" }];
  }, [groups, runners, targetType]);

  const effectiveTargetId = targetId || targetOptions[0]?.id || "team";

  function updateForm(key: keyof WorkoutTemplate, value: string | WorkoutKind | string[]) {
    if (templateError) setTemplateError("");
    setForm((current) => ({ ...current, [key]: value }));
  }

  function saveTemplate() {
    if (!form.title.trim()) {
      setTemplateError("Workout name is required before this workout can be saved.");
      return;
    }
    const nextTemplate: WorkoutTemplate = {
      ...form,
      id: editingId || crypto.randomUUID(),
      title: form.title.trim(),
      tags: form.tags.filter(Boolean),
      createdAt: editingId ? form.createdAt : new Date().toISOString(),
    };
    setTemplates((current) =>
      editingId ? current.map((template) => (template.id === editingId ? nextTemplate : template)) : [nextTemplate, ...current]
    );
    setSelectedTemplateId(nextTemplate.id);
    setTemplateError("");
    setEditingId(null);
    setForm(EMPTY_TEMPLATE);
  }

  function editTemplate(template: WorkoutTemplate) {
    setEditingId(template.id);
    setForm(template);
    setTemplateError("");
    setShowCreateWorkoutForm(true);
    setDayWorkoutTool("create");
  }

  function duplicateTemplate(template: WorkoutTemplate) {
    const copy = {
      ...template,
      id: crypto.randomUUID(),
      title: `${template.title} Copy`,
      createdAt: new Date().toISOString(),
    };
    setTemplates((current) => [copy, ...current]);
    setSelectedTemplateId("");
  }

  function deleteTemplate(templateId: string) {
    setTemplates((current) => current.filter((template) => template.id !== templateId));
    setAssignments((current) => current.filter((assignment) => assignment.templateId !== templateId));
    if (selectedTemplateId === templateId) setSelectedTemplateId("");
  }

  function assignWorkout() {
    if (!selectedTemplate) {
      setConfirmation("Choose an existing workout or create one before adding to the calendar.");
      return;
    }
    const option = targetOptions.find((item) => item.id === effectiveTargetId) || targetOptions[0];
    if (!option) return;
    const nextAssignment: CalendarAssignment = {
      id: crypto.randomUUID(),
      date: selectedDate,
      templateId: selectedTemplate.id,
      targetType,
      targetId: option.id,
      targetLabel: option.label,
    };
    setAssignments((current) => [nextAssignment, ...current]);
    setConfirmation(`${selectedTemplate.title} added to ${new Date(`${selectedDate}T00:00:00`).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    })} for ${option.label}.`);
  }

  function removeAssignment(id: string) {
    setAssignments((current) => current.filter((assignment) => assignment.id !== id));
  }

  return (
    <main className="mx-auto w-full max-w-none p-3 sm:p-5 lg:p-6">
      <section className="mb-6 rounded-2xl border border-white/10 bg-white/10 p-5 shadow-2xl shadow-black/10 backdrop-blur sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#00a7ff]">Workout Calendar</p>
            <h2 className="mt-2 text-3xl font-bold text-white sm:text-4xl">{schoolName}</h2>
            <p className="mt-2 max-w-3xl text-[#cbd5e1]">
              {coachName} can build reusable workouts, assign them to the calendar, and plan mileage, pace, strength, track work, and meet prep from one page.
            </p>
            <p className="mt-3 text-sm font-semibold text-[#7dd3fc]">{syncStatus}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:min-w-[560px] lg:grid-cols-5">
            <HeaderStat label="Workouts" value={currentMonthAssignments.length.toString()} detail={`${monthStats.upcomingSlots} upcoming slots`} />
            <HeaderStat label="Planned" value={formatMiles(monthStats.plannedMiles)} detail={`${monthStats.plannedRunnerDays} runner-days`} />
            <HeaderStat label="Logged" value={formatMiles(monthStats.completedMiles)} detail="verified miles" />
            <HeaderStat
              label="Completion"
              value={monthStats.dueRunnerDays > 0 ? `${Math.round(monthStats.completionRate * 100)}%` : "--"}
              detail={monthStats.dueRunnerDays > 0 ? `${monthStats.completedRunnerDays}/${monthStats.dueRunnerDays} due` : "0 due"}
            />
            <HeaderStat label="Missing" value={monthStats.missedUploads.toString()} detail="past due uploads" intent={monthStats.missedUploads > 0 ? "attention" : "neutral"} />
          </div>
        </div>
      </section>

      <section className="mb-6">
        <div className="section-card overflow-hidden p-4 sm:p-5">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-xl font-bold text-slate-900">
                {calendarMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
              </h3>
              <p className="mt-1 text-sm text-slate-500">Click a day to open details and set the assignment date.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setCalendarMonth(addMonths(calendarMonth, -1))} className="rounded-lg border border-slate-700 bg-slate-900/40 px-3 py-2 text-sm font-bold text-slate-200 hover:bg-slate-800">
                Previous
              </button>
              <button
                type="button"
                onClick={() => {
                  const today = new Date();
                  setCalendarMonth(today);
                  setSelectedDate(isoDate(today));
                  setConfirmation("");
                }}
                className="rounded-lg border border-[#00a7ff]/30 bg-[#00a7ff]/10 px-3 py-2 text-sm font-bold text-[#7dd3fc] hover:bg-[#00a7ff]/20"
              >
                This Month
              </button>
              <button type="button" onClick={() => setCalendarMonth(addMonths(calendarMonth, 1))} className="rounded-lg border border-slate-700 bg-slate-900/40 px-3 py-2 text-sm font-bold text-slate-200 hover:bg-slate-800">
                Next
              </button>
            </div>
          </div>

          <div className="overflow-hidden pb-2">
            <div className="w-full">
              <div className="grid grid-cols-7 border-b border-slate-700 bg-slate-950/35 text-center text-xs font-bold uppercase tracking-wide text-slate-500">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                  <div key={day} className="border-r border-slate-800 px-1 py-2 sm:px-3 sm:py-3 last:border-r-0">
                    {day}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 border-l border-t border-slate-800">
                {monthDays.map((day) => {
                  const dateKey = isoDate(day);
                  const dayAssignments = assignments.filter((assignment) => assignment.date === dateKey);
                  const isSelected = selectedDate === dateKey;
                  const isCurrentMonth = day.getMonth() === calendarMonth.getMonth();
                  const dayMiles = dayAssignments.reduce((sum, assignment) => {
                    const template = templatesById.get(assignment.templateId);
                    const targetRunnerCount = Math.max(resolveAssignmentRunnerIds(assignment).length, 1);
                    return sum + parseMileageRange(template?.miles || "") * targetRunnerCount;
                  }, 0);
                  const completedDayMiles = activities.reduce((sum, activity) => {
                    if (!activity.verified || isoDateFromValue(activity.startTime) !== dateKey) return sum;
                    return sum + activity.distanceMiles;
                  }, 0);

                  return (
                    <button
                      key={dateKey}
                      type="button"
                      onClick={() => {
                        setSelectedDate(dateKey);
                        setCalendarMonth(new Date(day));
                        setSelectedTemplateId("");
                        setConfirmation("");
                        setDayWorkoutTool(null);
                        setShowMobileDayDetails(true);
                      }}
                      className={`min-h-[86px] border-b border-r border-slate-800 p-2 text-left transition sm:min-h-[122px] sm:p-3 lg:min-h-[15vh] ${
                        isSelected
                          ? "bg-[#00ff67]/12 ring-2 ring-inset ring-[#00ff67]"
                          : isCurrentMonth
                            ? "bg-slate-900/30 hover:bg-[#00a7ff]/10"
                            : "bg-slate-950/35 text-slate-500 opacity-70 hover:opacity-100"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold sm:h-8 sm:w-8 sm:text-sm ${isSelected ? "bg-[#00ff67] text-slate-950" : "text-white"}`}>
                          {day.getDate()}
                        </span>
                        {dayAssignments.length > 0 && (
                          <span className="rounded-full border border-[#00a7ff]/30 bg-[#00a7ff]/10 px-1.5 py-0.5 text-[10px] font-bold text-[#7dd3fc] sm:px-2 sm:py-1 sm:text-[11px]">
                            {dayAssignments.length}
                          </span>
                        )}
                      </div>

                      <div className="mt-2 space-y-1 sm:mt-3">
                        {dayAssignments.slice(0, 2).map((assignment) => {
                          const template = templates.find((item) => item.id === assignment.templateId);
                          if (!template) return null;
                          const meta = typeMeta(template.kind);
                          return (
                            <div key={assignment.id} className="truncate rounded-md border border-slate-700 bg-slate-950/50 px-1.5 py-1 text-[10px] font-bold text-slate-200 sm:px-2 sm:text-xs">
                              <span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: meta.color }} />
                              {template.title}
                            </div>
                          );
                        })}
                        {dayAssignments.length > 2 && (
                          <p className="text-xs font-bold text-slate-400">+{dayAssignments.length - 2} more</p>
                        )}
                      </div>

                      {(dayMiles > 0 || completedDayMiles > 0) && (
                        <p className="mt-2 text-[10px] font-bold text-[#00ff67] sm:text-xs">
                          {dayMiles > 0 ? `${formatMiles(dayMiles)} planned` : "No plan"}
                          {completedDayMiles > 0 ? ` / ${formatMiles(completedDayMiles)} done` : ""}
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <aside className="hidden">
          <p className="text-xs font-bold uppercase tracking-wide text-[#00a7ff]">Selected Day</p>
          <h3 className="mt-2 text-2xl font-bold text-slate-900">{selectedDateLabel}</h3>
          <p className="mt-1 text-sm text-slate-500">Use this panel to review the day before assigning another workout.</p>

          <div className="mt-5 rounded-xl border border-[#00a7ff]/30 bg-[#00a7ff]/10 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-[#7dd3fc]">Ready to Add</p>
            <p className="mt-2 font-bold text-white">{selectedTemplate?.title || "Select a workout"}</p>
            <p className="mt-1 text-sm text-slate-300">
              {selectedTemplate ? `${typeMeta(selectedTemplate.kind).label} / ${selectedTemplate.miles || "--"} mi / ${selectedTemplate.pace || "pace open"}` : "Choose from the library below."}
            </p>
          </div>

          <div className="mt-5 space-y-3">
            <h4 className="text-sm font-bold uppercase tracking-wide text-slate-500">Workouts on this day</h4>
            {selectedDayAssignments.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-700 p-4 text-sm text-slate-500">
                Nothing planned yet.
              </div>
            ) : (
              selectedDayAssignments.map((assignment) => {
                const template = templates.find((item) => item.id === assignment.templateId);
                if (!template) return null;
                const meta = typeMeta(template.kind);
                return (
                  <article key={assignment.id} className="rounded-xl border border-slate-700 bg-slate-900/40 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="rounded-full px-2 py-1 text-xs font-bold text-white" style={{ backgroundColor: meta.color }}>
                          {meta.label}
                        </span>
                        <h5 className="mt-2 font-bold text-white">{template.title}</h5>
                      </div>
                      <button type="button" onClick={() => removeAssignment(assignment.id)} className="rounded-md px-2 py-1 text-xs font-bold text-red-300 hover:bg-red-500/15">
                        Remove
                      </button>
                    </div>
                    <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <dt className="text-slate-500">Assigned to</dt>
                        <dd className="font-bold text-slate-200">{assignment.targetLabel}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Miles</dt>
                        <dd className="font-bold text-slate-200">{template.miles || "--"}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Pace</dt>
                        <dd className="font-bold text-slate-200">{template.pace || "Open"}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Location</dt>
                        <dd className="font-bold text-slate-200">{template.location || "TBD"}</dd>
                      </div>
                    </dl>
                    {template.mainSet && <p className="mt-3 text-sm text-slate-300">{template.mainSet}</p>}
                  </article>
                );
              })
            )}
          </div>
        </aside>
      </section>

      <div className="mb-6 flex justify-center">
        <button
          type="button"
          onClick={() => {
            setEditingId(null);
            setForm(EMPTY_TEMPLATE);
            setShowCreateWorkoutForm((current) => !current);
          }}
          className="primary-action w-full px-5 py-3 text-base sm:w-auto"
        >
          {showCreateWorkoutForm ? "Hide New Workout" : "Create New Workout"}
        </button>
      </div>

      <section className="mb-6 grid gap-6">
        <div className={showCreateWorkoutForm ? "section-card p-4 sm:p-5" : "hidden"}>
          <div className="mb-4">
            <h3 className="text-xl font-bold text-slate-900">{editingId ? "Edit Workout" : "Create Workout"}</h3>
            <p className="mt-1 text-sm text-slate-500">Start with the basics. Add full coaching notes only when you need them.</p>
          </div>

          <div className="space-y-4">
            <TextInput label="Workout Name" value={form.title} onChange={(value) => updateForm("title", value)} placeholder="Varsity threshold day" />

            <div>
              <label className="mb-2 block text-sm font-bold text-slate-300">Type</label>
              <div className="grid grid-cols-2 gap-2">
                {WORKOUT_TYPES.map((type) => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => updateForm("kind", type.value)}
                    className={`rounded-lg border px-3 py-2 text-left text-sm font-bold transition ${
                      form.kind === type.value ? "border-white text-white shadow-lg" : "border-slate-700 bg-slate-900/40 text-slate-300"
                    }`}
                    style={form.kind === type.value ? { backgroundColor: type.color } : undefined}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <TextInput label="Miles" value={form.miles} onChange={(value) => updateForm("miles", value)} placeholder="4-6" />
              <TextInput label="Pace" value={form.pace} onChange={(value) => updateForm("pace", value)} placeholder="7:00 or tempo" />
            </div>

            <button
              type="button"
              onClick={() => setShowWorkoutDetails((current) => !current)}
              className="w-full rounded-lg border border-[#00a7ff]/30 bg-[#00a7ff]/10 px-4 py-3 text-sm font-bold text-[#7dd3fc] hover:bg-[#00a7ff]/20"
            >
              {showWorkoutDetails ? "Hide full workout details" : "Add warmup, main set, strength, notes"}
            </button>

            {showWorkoutDetails && (
              <div className="space-y-4 rounded-xl border border-slate-700 bg-slate-900/30 p-3">
                <TextInput label="Location" value={form.location} onChange={(value) => updateForm("location", value)} placeholder="Trails, track, field, gym" />
                <TextArea label="Warmup" value={form.warmup} onChange={(value) => updateForm("warmup", value)} placeholder="Jog, drills, strides" />
                <TextArea label="Main Set" value={form.mainSet} onChange={(value) => updateForm("mainSet", value)} placeholder="Workout details" />
                <TextArea label="Cooldown" value={form.cooldown} onChange={(value) => updateForm("cooldown", value)} placeholder="Easy jog, mobility" />
                <TextArea label="Strength or Gym" value={form.strength} onChange={(value) => updateForm("strength", value)} placeholder="Core, lifts, rehab, mobility" />
                <TextArea label="Coach Notes" value={form.notes} onChange={(value) => updateForm("notes", value)} placeholder="Adjustments, reminders, race-week notes" />
                <TextInput
                  label="Tags"
                  value={form.tags.join(", ")}
                  onChange={(value) => updateForm("tags", value.split(",").map((tag) => tag.trim()))}
                  placeholder="varsity, hills, recovery"
                />
              </div>
            )}

            <div className="flex gap-2">
              <button type="button" onClick={saveTemplate} className="primary-action flex-1 px-4 py-3">
                {editingId ? "Save Changes" : "Save Workout"}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(null);
                    setForm(EMPTY_TEMPLATE);
                  }}
                  className="rounded-lg border border-slate-700 bg-slate-900/40 px-4 py-3 text-sm font-bold text-slate-200 hover:bg-slate-800"
                >
                  Cancel
                </button>
              )}
            </div>
            {templateError && (
              <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm font-bold text-red-300">
                {templateError}
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-6">
          <div className="section-card p-4 sm:p-5">
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Workout Library</h3>
                <p className="mt-1 text-sm text-slate-500">Pick from old workouts, duplicate one, or edit the template.</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <input
                  type="search"
                  value={librarySearch}
                  onChange={(event) => setLibrarySearch(event.target.value)}
                  placeholder="Search workout name"
                  className="rounded-lg border border-slate-700 bg-slate-900/40 px-3 py-2 text-sm font-bold text-slate-200"
                />
                <select
                  value={libraryFilter}
                  onChange={(event) => setLibraryFilter(event.target.value as WorkoutKind | "all")}
                  className="rounded-lg border border-slate-700 bg-slate-900/40 px-3 py-2 text-sm font-bold text-slate-200"
                >
                  <option value="all">All types</option>
                  {WORKOUT_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              {filteredTemplates.map((template) => {
                const meta = typeMeta(template.kind);
                return (
                  <article key={template.id} className="rounded-xl border border-slate-700 bg-slate-900/35 p-4">
                    <div>
                      <div>
                        <span className="rounded-full px-3 py-1 text-xs font-bold text-white" style={{ backgroundColor: meta.color }}>
                          {meta.label}
                        </span>
                        <h4 className="mt-3 text-lg font-bold text-white">{template.title}</h4>
                        <p className="mt-1 text-sm text-slate-400">{template.miles || "No mileage"} mi / {template.pace || "Coach choice"}</p>
                      </div>
                    </div>
                    <p className="mt-3 line-clamp-2 text-sm text-slate-300">{template.mainSet || template.notes || "No details yet."}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {template.tags.map((tag) => (
                        <span key={tag} className="rounded-full border border-slate-700 bg-slate-950/40 px-2 py-1 text-xs font-bold text-slate-300">
                          {tag}
                        </span>
                      ))}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button type="button" onClick={() => editTemplate(template)} className="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm font-bold text-slate-200 hover:bg-slate-800">
                        Edit
                      </button>
                      <button type="button" onClick={() => duplicateTemplate(template)} className="rounded-lg border border-[#00a7ff]/30 bg-[#00a7ff]/10 px-3 py-2 text-sm font-bold text-[#7dd3fc] hover:bg-[#00a7ff]/20">
                        Duplicate
                      </button>
                      <button type="button" onClick={() => deleteTemplate(template.id)} className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm font-bold text-red-300 hover:bg-red-500/20">
                        Delete
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>

        </div>
      </section>

      {showMobileDayDetails && (
        <div className="fixed inset-0 z-[80] flex items-end bg-black/70 px-3 pb-3 pt-10 backdrop-blur-sm sm:items-center sm:p-5">
          <div className="max-h-[92vh] w-full overflow-y-auto rounded-2xl border border-slate-700 bg-[#07111f] p-4 shadow-2xl shadow-black/40 sm:mx-auto sm:max-w-6xl sm:p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-[#00a7ff]">Selected Day</p>
                <h3 className="mt-1 text-2xl font-bold text-white">{selectedDateLabel}</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowMobileDayDetails(false)}
                className="rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm font-bold text-slate-200"
              >
                Close
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <h4 className="text-sm font-bold uppercase tracking-wide text-slate-500">Workouts on this day</h4>
              {selectedDayAssignments.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-700 p-4 text-sm text-slate-500">
                  Nothing planned yet. Pick a workout and use Add to Calendar.
                </div>
              ) : (
                selectedDayAssignments.map((assignment) => {
                  const template = templates.find((item) => item.id === assignment.templateId);
                  if (!template) return null;
                  const meta = typeMeta(template.kind);
                  return (
                    <article key={assignment.id} className="rounded-xl border border-slate-700 bg-slate-900/70 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <span className="rounded-full px-2 py-1 text-xs font-bold text-white" style={{ backgroundColor: meta.color }}>
                            {meta.label}
                          </span>
                          <h5 className="mt-2 font-bold text-white">{template.title}</h5>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeAssignment(assignment.id)}
                          className="rounded-md px-2 py-1 text-xs font-bold text-red-300 hover:bg-red-500/15"
                        >
                          Remove
                        </button>
                      </div>
                      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <dt className="text-slate-500">Assigned to</dt>
                          <dd className="font-bold text-slate-200">{assignment.targetLabel}</dd>
                        </div>
                        <div>
                          <dt className="text-slate-500">Miles</dt>
                          <dd className="font-bold text-slate-200">{template.miles || "--"}</dd>
                        </div>
                        <div>
                          <dt className="text-slate-500">Pace</dt>
                          <dd className="font-bold text-slate-200">{template.pace || "Open"}</dd>
                        </div>
                        <div>
                          <dt className="text-slate-500">Location</dt>
                          <dd className="font-bold text-slate-200">{template.location || "TBD"}</dd>
                        </div>
                      </dl>
                      {template.mainSet && <p className="mt-3 text-sm text-slate-300">{template.mainSet}</p>}
                    </article>
                  );
                })
              )}
            </div>

            <div className="mt-4 rounded-xl border border-slate-700 bg-slate-900/50 p-4">
              <div className="mb-4">
                <h4 className="text-lg font-bold text-white">Assign to Calendar</h4>
                <p className="mt-1 text-sm text-slate-400">Pick who gets the selected workout for this day.</p>
              </div>

              <div className="grid gap-3 md:grid-cols-4">
                <label className="md:col-span-1">
                  <span className="mb-2 block text-sm font-bold text-slate-300">Date</span>
                  <input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} className="w-full rounded-lg px-3 py-3 text-sm" />
                </label>
                <label>
                  <span className="mb-2 block text-sm font-bold text-slate-300">Target</span>
                  <select
                    value={targetType}
                    onChange={(event) => {
                      const next = event.target.value as CalendarAssignment["targetType"];
                      setTargetType(next);
                      setTargetId(next === "team" ? "team" : "");
                      setConfirmation("");
                    }}
                    className="w-full rounded-lg px-3 py-3 text-sm"
                  >
                    <option value="team">Team</option>
                    <option value="group">Group</option>
                    <option value="runner">Runner</option>
                  </select>
                </label>
                <label>
                  <span className="mb-2 block text-sm font-bold text-slate-300">Who</span>
                  <select value={effectiveTargetId} onChange={(event) => setTargetId(event.target.value)} className="w-full rounded-lg px-3 py-3 text-sm">
                    {targetOptions.map((option) => (
                      <option key={option.id} value={option.id}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={assignWorkout}
                  disabled={!selectedTemplate}
                  className="primary-action self-end px-4 py-3 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
                >
                  Add to Calendar
                </button>
              </div>

              <div className="mt-4 rounded-xl border border-[#00a7ff]/30 bg-[#00a7ff]/10 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-[#7dd3fc]">Ready to Add</p>
                <p className="mt-2 font-bold text-white">{selectedTemplate?.title || "No workout selected"}</p>
                <p className="mt-1 text-sm text-slate-300">
                  {selectedTemplate
                    ? `${typeMeta(selectedTemplate.kind).label} / ${selectedTemplate.miles || "--"} mi / ${selectedTemplate.pace || "pace open"}`
                    : "Choose an existing workout or create a new one before adding to the calendar."}
                </p>
              </div>

              {confirmation && (
                <div className="mt-4 rounded-xl border border-[#00ff67]/30 bg-[#00ff67]/10 p-4 text-sm font-bold text-[#86efac]">
                  {confirmation}
                </div>
              )}
            </div>

            <div className="mt-5 rounded-xl border border-slate-700 bg-slate-900/50 p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(null);
                    setForm(EMPTY_TEMPLATE);
                    setDayWorkoutTool("create");
                  }}
                  className={`rounded-lg px-4 py-3 text-sm font-black transition ${
                    dayWorkoutTool === "create"
                      ? "bg-[#00ff67] text-slate-950"
                      : "border border-[#00ff67]/30 bg-[#00ff67]/10 text-[#86efac] hover:bg-[#00ff67]/20"
                  }`}
                >
                  Create New
                </button>
                <button
                  type="button"
                  onClick={() => setDayWorkoutTool("library")}
                  className={`rounded-lg px-4 py-3 text-sm font-black transition ${
                    dayWorkoutTool === "library"
                      ? "bg-[#00a7ff] text-white"
                      : "border border-[#00a7ff]/30 bg-[#00a7ff]/10 text-[#7dd3fc] hover:bg-[#00a7ff]/20"
                  }`}
                >
                  Choose Existing
                </button>
              </div>

              {dayWorkoutTool === "create" && (
                <div className="mt-4 rounded-xl border border-slate-700 bg-slate-950/40 p-4">
                  <div className="mb-4">
                    <h4 className="text-lg font-bold text-white">{editingId ? "Edit Workout" : "Create Workout"}</h4>
                    <p className="mt-1 text-sm text-slate-400">Save it here, then choose it for this day.</p>
                  </div>

                  <div className="space-y-4">
                    <TextInput label="Workout Name" value={form.title} onChange={(value) => updateForm("title", value)} placeholder="Varsity threshold day" />

                    <div>
                      <label className="mb-2 block text-sm font-bold text-slate-300">Type</label>
                      <div className="grid grid-cols-2 gap-2">
                        {WORKOUT_TYPES.map((type) => (
                          <button
                            key={type.value}
                            type="button"
                            onClick={() => updateForm("kind", type.value)}
                            className={`rounded-lg border px-3 py-2 text-left text-sm font-bold transition ${
                              form.kind === type.value ? "border-white text-white shadow-lg" : "border-slate-700 bg-slate-900/40 text-slate-300"
                            }`}
                            style={form.kind === type.value ? { backgroundColor: type.color } : undefined}
                          >
                            {type.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <TextInput label="Miles" value={form.miles} onChange={(value) => updateForm("miles", value)} placeholder="4-6" />
                      <TextInput label="Pace" value={form.pace} onChange={(value) => updateForm("pace", value)} placeholder="7:00 or tempo" />
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowWorkoutDetails((current) => !current)}
                      className="w-full rounded-lg border border-[#00a7ff]/30 bg-[#00a7ff]/10 px-4 py-3 text-sm font-bold text-[#7dd3fc] hover:bg-[#00a7ff]/20"
                    >
                      {showWorkoutDetails ? "Hide full workout details" : "Add warmup, main set, strength, notes"}
                    </button>

                    {showWorkoutDetails && (
                      <div className="space-y-4 rounded-xl border border-slate-700 bg-slate-950/40 p-3">
                        <TextInput label="Location" value={form.location} onChange={(value) => updateForm("location", value)} placeholder="Trails, track, field, gym" />
                        <TextArea label="Warmup" value={form.warmup} onChange={(value) => updateForm("warmup", value)} placeholder="Jog, drills, strides" />
                        <TextArea label="Main Set" value={form.mainSet} onChange={(value) => updateForm("mainSet", value)} placeholder="Workout details" />
                        <TextArea label="Cooldown" value={form.cooldown} onChange={(value) => updateForm("cooldown", value)} placeholder="Easy jog, mobility" />
                        <TextArea label="Strength or Gym" value={form.strength} onChange={(value) => updateForm("strength", value)} placeholder="Core, lifts, rehab, mobility" />
                        <TextArea label="Coach Notes" value={form.notes} onChange={(value) => updateForm("notes", value)} placeholder="Adjustments, reminders, race-week notes" />
                        <TextInput
                          label="Tags"
                          value={form.tags.join(", ")}
                          onChange={(value) => updateForm("tags", value.split(",").map((tag) => tag.trim()))}
                          placeholder="varsity, hills, recovery"
                        />
                      </div>
                    )}

                    <div className="flex gap-2">
                      <button type="button" onClick={saveTemplate} className="primary-action flex-1 px-4 py-3">
                        {editingId ? "Save Changes" : "Save Workout"}
                      </button>
                      {editingId && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(null);
                            setForm(EMPTY_TEMPLATE);
                          }}
                          className="rounded-lg border border-slate-700 bg-slate-900/40 px-4 py-3 text-sm font-bold text-slate-200 hover:bg-slate-800"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                    {templateError && (
                      <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm font-bold text-red-300">
                        {templateError}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {dayWorkoutTool === "library" && (
                <div className="mt-4 rounded-xl border border-slate-700 bg-slate-950/40 p-4">
                  <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h4 className="text-lg font-bold text-white">Workout Library</h4>
                    <p className="mt-1 text-sm text-slate-400">Select, edit, duplicate, or remove reusable workouts.</p>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                    <input
                      type="search"
                      value={librarySearch}
                      onChange={(event) => setLibrarySearch(event.target.value)}
                      placeholder="Search workout name"
                      className="rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm font-bold text-slate-200"
                    />
                    <select
                      value={libraryFilter}
                      onChange={(event) => setLibraryFilter(event.target.value as WorkoutKind | "all")}
                      className="rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm font-bold text-slate-200"
                    >
                      <option value="all">All types</option>
                      {WORKOUT_TYPES.map((type) => (
                        <option key={type.value} value={type.value}>{type.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid gap-3 xl:grid-cols-2">
                  {filteredTemplates.map((template) => {
                    const meta = typeMeta(template.kind);
                    return (
                      <article key={template.id} className="rounded-xl border border-slate-700 bg-slate-950/45 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <span className="rounded-full px-3 py-1 text-xs font-bold text-white" style={{ backgroundColor: meta.color }}>
                              {meta.label}
                            </span>
                            <h5 className="mt-3 text-lg font-bold text-white">{template.title}</h5>
                            <p className="mt-1 text-sm text-slate-400">{template.miles || "No mileage"} mi / {template.pace || "Coach choice"}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedTemplateId(template.id);
                              setConfirmation("");
                            }}
                            className={`rounded-lg px-3 py-2 text-sm font-bold transition ${
                              selectedTemplateId === template.id
                                ? "bg-[#00ff67] text-slate-950"
                                : "border border-[#00a7ff]/30 bg-[#00a7ff]/10 text-[#7dd3fc] hover:bg-[#00a7ff]/20"
                            }`}
                          >
                            {selectedTemplateId === template.id ? "Selected" : "Select"}
                          </button>
                        </div>
                        <p className="mt-3 line-clamp-2 text-sm text-slate-300">{template.mainSet || template.notes || "No details yet."}</p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <button type="button" onClick={() => editTemplate(template)} className="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm font-bold text-slate-200 hover:bg-slate-800">
                            Edit
                          </button>
                          <button type="button" onClick={() => duplicateTemplate(template)} className="rounded-lg border border-[#00a7ff]/30 bg-[#00a7ff]/10 px-3 py-2 text-sm font-bold text-[#7dd3fc] hover:bg-[#00a7ff]/20">
                            Duplicate
                          </button>
                          <button type="button" onClick={() => deleteTemplate(template.id)} className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm font-bold text-red-300 hover:bg-red-500/20">
                            Delete
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowMobileDayDetails(false)}
              className="primary-action mt-4 w-full px-4 py-3"
            >
              Done
            </button>
          </div>
        </div>
      )}

    </main>
  );
}

function HeaderStat({
  label,
  value,
  detail,
  intent = "neutral",
}: {
  label: string;
  value: string;
  detail?: string;
  intent?: "neutral" | "attention";
}) {
  return (
    <div className={`rounded-xl border p-4 ${intent === "attention" ? "border-amber-300/40 bg-amber-300/10" : "border-white/15 bg-white/10"}`}>
      <p className="text-xs font-bold uppercase tracking-wide text-[#94a3b8]">{label}</p>
      <p className="mt-2 text-2xl font-bold text-white">{value}</p>
      {detail && <p className="mt-1 text-xs font-semibold text-slate-300">{detail}</p>}
    </div>
  );
}

function TextInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-slate-300">{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="w-full rounded-lg px-3 py-3 text-sm" />
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-slate-300">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={3}
        className="w-full resize-y rounded-lg px-3 py-3 text-sm"
      />
    </label>
  );
}
