import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const MARKER = "[Phase 5 Demo]";
const RUNNER_ID = "4835d989-7820-44fc-b2b0-dbda6d3622de";
const ACTIVITY_PREFIX = "phase5_demo_assistant_random";
const START_DATE = "2026-05-25";
const END_DATE = "2026-07-19";

function loadEnv() {
  const envPath = path.join(process.cwd(), ".env.local");
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    if (!line || line.trim().startsWith("#") || !line.includes("=")) continue;
    const index = line.indexOf("=");
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
    process.env[key] ||= value;
  }
}

function isoAtNoon(date) {
  return `${date}T12:00:00.000Z`;
}

function secondsFor(distanceMiles, paceSeconds) {
  return Math.round(distanceMiles * paceSeconds);
}

function trainingLoad(durationSeconds, rpe) {
  return Number(((durationSeconds / 60) * rpe * 0.6).toFixed(2));
}

function activity(date, distanceMiles, paceSeconds, workoutType, rpe, notes, extras = {}) {
  const durationSeconds = secondsFor(distanceMiles, paceSeconds);
  return {
    runner_id: RUNNER_ID,
    garmin_activity_id: `${ACTIVITY_PREFIX}_${date}`,
    distance_miles: distanceMiles,
    duration_seconds: durationSeconds,
    pace_per_mile: paceSeconds,
    start_time: isoAtNoon(date),
    verified: true,
    uploaded_by: "coach",
    file_type: "manual",
    original_filename: "Phase 5 demo seed",
    detected_app: "manual_demo",
    notes: `${MARKER} ${notes}`,
    workout_type: workoutType,
    rpe,
    training_load: trainingLoad(durationSeconds, rpe),
    training_load_source: "estimated_rpe",
    avg_hr: extras.avgHr ?? null,
    max_hr: extras.maxHr ?? null,
    elevation_gain_m: extras.elevationGainM ?? null,
    soreness: extras.soreness ?? null,
    illness: extras.illness ?? false,
  };
}

function recovery(date, hrvStatus, soreness, sleepScore, sleepDurationMin, bodyBattery, notes, extras = {}) {
  return {
    runner_id: RUNNER_ID,
    log_date: date,
    hrv_ms: extras.hrvMs ?? null,
    hrv_status: hrvStatus,
    resting_hr: extras.restingHr ?? null,
    sleep_score: sleepScore,
    sleep_duration_min: sleepDurationMin,
    body_battery: bodyBattery,
    soreness,
    illness: extras.illness ?? false,
    notes: `${MARKER} ${notes}`,
  };
}

const activities = [
  activity("2026-05-25", 3.2, 535, "easy", 4, "Easy aerobic run after a rest day.", { avgHr: 142, maxHr: 158, soreness: 2 }),
  activity("2026-05-26", 4.0, 520, "easy", 4, "Comfortable mileage.", { avgHr: 145, maxHr: 160, soreness: 2 }),
  activity("2026-05-28", 5.1, 498, "tempo", 6, "Controlled tempo progression.", { avgHr: 162, maxHr: 176, soreness: 4 }),
  activity("2026-05-30", 3.0, 548, "recovery", 3, "Short recovery run.", { avgHr: 136, maxHr: 148, soreness: 3 }),
  activity("2026-05-31", 6.4, 552, "long", 5, "First steady long run of the block.", { avgHr: 150, maxHr: 166, elevationGainM: 58, soreness: 4 }),

  activity("2026-06-02", 4.2, 512, "easy", 4, "Easy run with strides.", { avgHr: 146, maxHr: 169, soreness: 2 }),
  activity("2026-06-03", 5.0, 455, "interval", 7, "6 x 800m effort with jog recovery.", { avgHr: 168, maxHr: 186, soreness: 5 }),
  activity("2026-06-05", 3.4, 542, "recovery", 3, "Recovery run after intervals.", { avgHr: 138, maxHr: 151, soreness: 4 }),
  activity("2026-06-06", 4.8, 505, "tempo", 6, "Tempo miles felt controlled.", { avgHr: 160, maxHr: 174, soreness: 4 }),
  activity("2026-06-07", 7.0, 558, "long", 5, "Long run, mild heat.", { avgHr: 153, maxHr: 169, elevationGainM: 72, soreness: 5 }),

  activity("2026-06-09", 3.5, 550, "easy", 4, "Easy aerobic mileage.", { avgHr: 140, maxHr: 154, soreness: 3 }),
  activity("2026-06-10", 5.5, 468, "interval", 7, "Fartlek session, strong finish.", { avgHr: 166, maxHr: 184, soreness: 5 }),
  activity("2026-06-12", 4.0, 536, "easy", 4, "Relaxed mileage.", { avgHr: 143, maxHr: 156, soreness: 3 }),
  activity("2026-06-13", 3.1, 430, "race", 8, "5K time trial effort.", { avgHr: 176, maxHr: 193, soreness: 6 }),
  activity("2026-06-14", 7.5, 565, "long", 5, "Long run on tired legs.", { avgHr: 151, maxHr: 168, elevationGainM: 80, soreness: 6 }),

  activity("2026-06-16", 4.0, 544, "easy", 4, "Reduced effort after heavier week.", { avgHr: 141, maxHr: 155, soreness: 3 }),
  activity("2026-06-17", 5.2, 482, "tempo", 6, "Tempo plus hill strides.", { avgHr: 163, maxHr: 179, elevationGainM: 96, soreness: 5 }),
  activity("2026-06-19", 3.0, 575, "recovery", 3, "Recovery jog.", { avgHr: 134, maxHr: 146, soreness: 3 }),
  activity("2026-06-20", 4.6, 515, "easy", 4, "Steady aerobic run.", { avgHr: 146, maxHr: 160, soreness: 3 }),
  activity("2026-06-21", 8.0, 562, "long", 5, "Longest run so far.", { avgHr: 152, maxHr: 170, elevationGainM: 84, soreness: 5 }),

  activity("2026-06-23", 4.1, 530, "easy", 4, "Easy day.", { avgHr: 142, maxHr: 156, soreness: 3 }),
  activity("2026-06-24", 5.8, 462, "interval", 8, "Hard 1K repeats, high load.", { avgHr: 171, maxHr: 190, soreness: 6 }),
  activity("2026-06-26", 4.2, 522, "easy", 4, "Aerobic run, good rhythm.", { avgHr: 145, maxHr: 160, soreness: 4 }),
  activity("2026-06-27", 5.0, 492, "tempo", 6, "Threshold effort.", { avgHr: 164, maxHr: 178, soreness: 5 }),
  activity("2026-06-28", 8.5, 570, "long", 6, "Long run pushed late.", { avgHr: 155, maxHr: 172, elevationGainM: 90, soreness: 7 }),

  activity("2026-06-30", 3.0, 586, "recovery", 3, "Extra easy recovery day.", { avgHr: 132, maxHr: 145, soreness: 5 }),
  activity("2026-07-01", 5.0, 500, "easy", 5, "Steady run, heat index higher.", { avgHr: 154, maxHr: 170, soreness: 5 }),
  activity("2026-07-03", 6.0, 458, "interval", 8, "Track session, high effort.", { avgHr: 174, maxHr: 192, soreness: 7 }),
  activity("2026-07-04", 3.2, 598, "recovery", 3, "Recovery jog.", { avgHr: 136, maxHr: 150, soreness: 5 }),
  activity("2026-07-05", 9.0, 575, "long", 6, "Biggest long run, fatigue noted.", { avgHr: 158, maxHr: 175, elevationGainM: 95, soreness: 7 }),

  activity("2026-07-07", 4.5, 540, "easy", 4, "Returned to easy mileage.", { avgHr: 143, maxHr: 158, soreness: 4 }),
  activity("2026-07-08", 5.8, 470, "tempo", 7, "Tempo felt harder than expected.", { avgHr: 169, maxHr: 184, soreness: 6 }),
  activity("2026-07-10", 4.0, 555, "easy", 4, "Easy aerobic run.", { avgHr: 145, maxHr: 159, soreness: 4 }),
  activity("2026-07-11", 5.2, 465, "interval", 8, "Fast intervals, late fatigue.", { avgHr: 173, maxHr: 191, soreness: 7 }),
  activity("2026-07-12", 9.5, 580, "long", 7, "Aggressive long run; monitor recovery.", { avgHr: 160, maxHr: 178, elevationGainM: 100, soreness: 8 }),

  activity("2026-07-14", 4.0, 560, "easy", 4, "Easy but legs sore.", { avgHr: 146, maxHr: 160, soreness: 6 }),
  activity("2026-07-15", 6.2, 475, "tempo", 7, "Tempo effort after high long run.", { avgHr: 170, maxHr: 186, soreness: 7 }),
  activity("2026-07-17", 5.0, 545, "easy", 5, "Moderate aerobic day.", { avgHr: 151, maxHr: 166, soreness: 6 }),
  activity("2026-07-18", 6.0, 455, "interval", 8, "Sharp interval workout, high load.", { avgHr: 176, maxHr: 194, soreness: 8 }),
  activity("2026-07-19", 10.0, 585, "long", 7, "Peak long run; recovery flag expected.", { avgHr: 162, maxHr: 181, elevationGainM: 108, soreness: 8 }),
];

const recoveryLogs = [
  recovery("2026-06-02", "balanced", 2, 86, 465, 82, "Normal recovery after base week.", { hrvMs: 72, restingHr: 49 }),
  recovery("2026-06-10", "balanced", 4, 78, 430, 74, "Moderate soreness after intervals.", { hrvMs: 68, restingHr: 51 }),
  recovery("2026-06-14", "unbalanced", 6, 64, 395, 58, "Soreness after time trial and long run.", { hrvMs: 61, restingHr: 54 }),
  recovery("2026-06-24", "balanced", 5, 76, 440, 70, "Handled workout load reasonably.", { hrvMs: 66, restingHr: 51 }),
  recovery("2026-06-29", "low", 7, 49, 350, 42, "Recovery dipped after high-load week.", { hrvMs: 54, restingHr: 58 }),
  recovery("2026-07-05", "unbalanced", 7, 58, 370, 48, "Fatigue after long run.", { hrvMs: 57, restingHr: 56 }),
  recovery("2026-07-12", "low", 8, 43, 330, 35, "High soreness; coach should monitor.", { hrvMs: 51, restingHr: 60 }),
  recovery("2026-07-18", "low", 8, 46, 345, 38, "Poor recovery before long run.", { hrvMs: 52, restingHr: 59 }),
  recovery("2026-07-19", "poor", 9, 38, 310, 28, "Peak fatigue after high-load block.", { hrvMs: 48, restingHr: 62 }),
];

loadEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

async function requireOk(label, promise) {
  const result = await promise;
  if (result.error) {
    throw new Error(`${label}: ${result.error.message}`);
  }
  return result;
}

const { data: runner, error: runnerError } = await supabase
  .from("runners")
  .select("id, first_name, last_name, team_id, coach_id, username")
  .eq("id", RUNNER_ID)
  .single();

if (runnerError || !runner) {
  throw new Error(`Could not load Assistant Random: ${runnerError?.message || "missing runner"}`);
}

console.log(`Seeding ${runner.first_name} ${runner.last_name} (${runner.username}) from ${START_DATE} to ${END_DATE}.`);

await requireOk(
  "delete demo alerts",
  supabase.from("coach_alerts").delete().eq("runner_id", RUNNER_ID).like("dedupe_key", `${ACTIVITY_PREFIX}%`)
);

await requireOk(
  "delete demo recovery logs",
  supabase.from("recovery_logs").delete().eq("runner_id", RUNNER_ID).like("notes", `%${MARKER}%`)
);

await requireOk(
  "delete demo activities",
  supabase.from("activities").delete().eq("runner_id", RUNNER_ID).like("garmin_activity_id", `${ACTIVITY_PREFIX}%`)
);

await requireOk(
  "delete demo weekly loads",
  supabase.from("weekly_loads").delete().eq("runner_id", RUNNER_ID).gte("week_start", START_DATE).lte("week_start", END_DATE)
);

await requireOk("insert demo activities", supabase.from("activities").insert(activities));
await requireOk("insert demo recovery logs", supabase.from("recovery_logs").insert(recoveryLogs));

await requireOk(
  "insert demo alerts",
  supabase.from("coach_alerts").insert([
    {
      runner_id: RUNNER_ID,
      coach_id: runner.coach_id,
      team_id: runner.team_id,
      alert_type: "acwr_spike",
      message: `${MARKER} Assistant Random has a high-load training block with a sharp long-run increase. Review recovery before assigning another hard workout.`,
      severity: "high",
      dismissed: false,
      dedupe_key: `${ACTIVITY_PREFIX}_acwr_spike_2026_07_19`,
    },
    {
      runner_id: RUNNER_ID,
      coach_id: runner.coach_id,
      team_id: runner.team_id,
      alert_type: "hrv_drop",
      message: `${MARKER} Low HRV and high soreness are appearing during the current load spike. Consider recovery or reduced intensity.`,
      severity: "critical",
      dismissed: false,
      dedupe_key: `${ACTIVITY_PREFIX}_hrv_drop_2026_07_19`,
    },
  ])
);

const { data: loadRows } = await requireOk(
  "load summary",
  supabase
    .from("weekly_loads")
    .select("week_start, acute_load, chronic_load, acwr_ratio, monotony, strain, status")
    .eq("runner_id", RUNNER_ID)
    .gte("week_start", START_DATE)
    .order("week_start", { ascending: false })
);

console.log(
  JSON.stringify(
    {
      runner: `${runner.first_name} ${runner.last_name}`,
      activities: activities.length,
      recoveryLogs: recoveryLogs.length,
      demoAlerts: 2,
      weeklyLoads: loadRows?.length || 0,
      latestWeeklyLoad: loadRows?.[0] || null,
    },
    null,
    2
  )
);
