"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { supabase } from "@/lib/supabase";
import { parseActivityFile } from "@/lib/parse-activity-file";
import CoachHeader from "@/components/CoachHeader";

interface Props {
  params: Promise<{
    runnerId: string;
  }>;
}

function formatSupabaseError(error: unknown) {
  if (!error) return "Unknown Supabase error";
  if (error instanceof Error) return error.message;
  if (typeof error === "object") {
    const details = error as {
      message?: string;
      details?: string;
      hint?: string;
      code?: string;
    };
    return [details.message, details.details, details.hint, details.code && `Code: ${details.code}`]
      .filter(Boolean)
      .join(" | ") || JSON.stringify(error);
  }
  return String(error);
}

function nullableNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && value.trim() !== "" ? parsed : null;
}

function buildTrainingFields(data: {
  durationSeconds: number;
  workoutType: string;
  rpe: string;
  soreness: string;
  illness: boolean;
  avgHr: string;
  maxHr: string;
  trainingLoad: string;
  elevationGainM: string;
}) {
  const rpe = nullableNumber(data.rpe);
  const manualLoad = nullableNumber(data.trainingLoad);
  const estimatedLoad = manualLoad == null && rpe != null ? (data.durationSeconds / 60) * rpe * 0.6 : null;

  return {
    workout_type: data.workoutType || null,
    rpe,
    soreness: nullableNumber(data.soreness),
    illness: data.illness,
    avg_hr: nullableNumber(data.avgHr),
    max_hr: nullableNumber(data.maxHr),
    training_load: manualLoad ?? estimatedLoad,
    training_load_source: manualLoad != null ? "manual" : estimatedLoad != null ? "estimated_rpe" : "manual",
    elevation_gain_m: nullableNumber(data.elevationGainM),
  };
}

export default function CoachUploadForRunnerPage({ params }: Props) {
  const router = useRouter();
  const { isLoaded, userId } = useAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [entryMode, setEntryMode] = useState<"file" | "manual">("file");
  const [manualData, setManualData] = useState({
    distance: "",
    duration: "",
    pace: "",
    date: new Date().toISOString().split("T")[0],
    workoutType: "easy",
    rpe: "",
    soreness: "",
    illness: false,
    avgHr: "",
    maxHr: "",
    trainingLoad: "",
    elevationGainM: "",
    notes: "",
  });
  
  if (!isLoaded) {
    return <div className="min-h-screen hersemita-page-bg flex items-center justify-center text-white">Loading...</div>;
  }
  
  if (!userId) {
    return null;
  }

  function durationToSeconds(duration: string) {
    const parts = duration.split(":").map(Number);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return 0;
  }

  function paceToSeconds(pace: string) {
    const [minutes, seconds] = pace.split(":").map(Number);
    return (minutes || 0) * 60 + (seconds || 0);
  }

  async function handleSubmit(formData: FormData) {
    const { runnerId } = await params;
    const file = formData.get("file") as File;
    const hasFile = file && file.size > 0;
    const fileType = hasFile ? file.name.split(".").pop()?.toLowerCase() || "unknown" : "manual";
    const isImage = hasFile && file.type.startsWith("image/");

    try {
      if (entryMode === "manual" || !hasFile) {
        const distance = parseFloat(manualData.distance);
        const durationSeconds = durationToSeconds(manualData.duration);
        const paceSeconds = manualData.pace ? paceToSeconds(manualData.pace) : Math.round(durationSeconds / distance);

        const { error } = await supabase.from("activities").insert({
          runner_id: runnerId,
          garmin_activity_id: `coach_manual_${Date.now()}`,
          distance_miles: distance,
          duration_seconds: durationSeconds,
          pace_per_mile: paceSeconds,
          start_time: new Date(manualData.date).toISOString(),
          verified: false,
          uploaded_by: "coach",
          file_type: "manual",
          original_filename: "Manual entry",
          notes: manualData.notes || null,
          ...buildTrainingFields({
            durationSeconds,
            workoutType: manualData.workoutType,
            rpe: manualData.rpe,
            soreness: manualData.soreness,
            illness: manualData.illness,
            avgHr: manualData.avgHr,
            maxHr: manualData.maxHr,
            trainingLoad: manualData.trainingLoad,
            elevationGainM: manualData.elevationGainM,
          }),
        });

        if (error) throw error;
        router.push("/runners");
        return;
      }

      if (isImage) {
        const uploadData = new FormData();
        uploadData.append("file", file);
        uploadData.append("runnerId", runnerId);

        const uploadResponse = await fetch("/api/coach-screenshots", {
          method: "POST",
          body: uploadData,
        });
        const uploadResult = await uploadResponse.json().catch(() => null) as { url?: string; error?: string } | null;

        if (!uploadResponse.ok || !uploadResult?.url) {
          throw new Error(uploadResult?.error || "Screenshot upload failed");
        }

        const distance = parseFloat(manualData.distance);
        const durationSeconds = durationToSeconds(manualData.duration);
        const paceSeconds = manualData.pace ? paceToSeconds(manualData.pace) : Math.round(durationSeconds / distance);

        const { error } = await supabase.from("activities").insert({
          runner_id: runnerId,
          garmin_activity_id: `coach_screenshot_${Date.now()}`,
          distance_miles: distance,
          duration_seconds: durationSeconds,
          pace_per_mile: paceSeconds,
          start_time: new Date(manualData.date).toISOString(),
          verified: false,
          uploaded_by: "coach",
          file_type: "screenshot",
          original_filename: file.name,
          screenshot_urls: [uploadResult.url],
          notes: manualData.notes || null,
          ...buildTrainingFields({
            durationSeconds,
            workoutType: manualData.workoutType,
            rpe: manualData.rpe,
            soreness: manualData.soreness,
            illness: manualData.illness,
            avgHr: manualData.avgHr,
            maxHr: manualData.maxHr,
            trainingLoad: manualData.trainingLoad,
            elevationGainM: manualData.elevationGainM,
          }),
        });

        if (error) throw error;
        router.push("/runners");
        return;
      }

      const activityData = await parseActivityFile(file, fileType);
      
      const { error } = await supabase.from("activities").insert({
        runner_id: runnerId,
        garmin_activity_id: `coach_upload_${Date.now()}`,
        distance_miles: activityData.distance_miles,
        duration_seconds: activityData.duration_seconds,
        pace_per_mile: activityData.pace_per_mile,
        start_time: activityData.start_time,
        verified: false,
        uploaded_by: "coach",
        file_type: fileType,
        original_filename: file.name,
      });

      if (error) throw error;
      router.push("/runners");
    } catch (error) {
      console.error("Upload error:", error);
      alert("Upload failed: " + formatSupabaseError(error));
    }
  }

  return (
    <div className="min-h-screen hersemita-page-bg">
      <CoachHeader active="runners" />

      <main className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto">
        <button
          type="button"
          onClick={() => router.back()}
          className="mb-4 rounded-lg border border-white/15 bg-white/10 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/15"
        >
          Back
        </button>

        <div className="mb-8 rounded-2xl border border-white/10 bg-white/10 p-5 sm:p-6 shadow-2xl shadow-black/10 backdrop-blur">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#00a7ff]">Coach Upload</p>
          <h2 className="mt-2 text-3xl font-bold text-white">Upload Run Proof</h2>
          <p className="mt-2 text-[#cbd5e1]">Add a screenshot like the runner upload flow, or use a GPX, FIT, or TCX file.</p>
        </div>
        
        <form action={handleSubmit} className="bg-white p-5 sm:p-6 rounded-xl shadow-sm border border-slate-200 space-y-6">
          <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-2">
            <button
              type="button"
              onClick={() => setEntryMode("file")}
              className={`rounded-lg px-4 py-3 text-sm font-bold transition ${entryMode === "file" ? "bg-[#00a7ff] text-white" : "text-slate-700 hover:bg-white"}`}
            >
              Upload Proof
            </button>
            <button
              type="button"
              onClick={() => {
                setEntryMode("manual");
                setSelectedFile(null);
              }}
              className={`rounded-lg px-4 py-3 text-sm font-bold transition ${entryMode === "manual" ? "bg-[#00a7ff] text-white" : "text-slate-700 hover:bg-white"}`}
            >
              Manual Entry
            </button>
          </div>

          {entryMode === "file" && (
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Run Proof</label>
            <input
              name="file"
              type="file"
              accept="image/*,.fit,.gpx,.tcx"
              required={entryMode === "file"}
              onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
              className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-[#00a7ff] transition-colors"
            />
            <p className="mt-2 text-xs text-slate-500">Screenshots require manual details below. GPX, FIT, and TCX files will be parsed automatically.</p>
          </div>
          )}

          {(entryMode === "manual" || selectedFile?.type.startsWith("image/")) && (
            <div className="rounded-xl border border-[#00a7ff]/20 bg-[#00a7ff]/5 p-4 space-y-4">
              <h3 className="font-bold text-slate-900">{entryMode === "manual" ? "Manual Run Details" : "Screenshot Details"}</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-bold mb-1">Distance (mi)</label>
                  <input type="number" step="0.01" required value={manualData.distance} onChange={(event) => setManualData({ ...manualData, distance: event.target.value })} className="w-full border rounded-lg px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1">Date</label>
                  <input type="date" required value={manualData.date} onChange={(event) => setManualData({ ...manualData, date: event.target.value })} className="w-full border rounded-lg px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1">Duration (MM:SS)</label>
                  <input type="text" required value={manualData.duration} onChange={(event) => setManualData({ ...manualData, duration: event.target.value })} className="w-full border rounded-lg px-3 py-2" placeholder="26:30" />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1">Pace</label>
                  <input type="text" value={manualData.pace} onChange={(event) => setManualData({ ...manualData, pace: event.target.value })} className="w-full border rounded-lg px-3 py-2" placeholder="8:32" />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1">Workout Type</label>
                  <select value={manualData.workoutType} onChange={(event) => setManualData({ ...manualData, workoutType: event.target.value })} className="w-full border rounded-lg px-3 py-2">
                    <option value="easy">Easy</option>
                    <option value="tempo">Tempo</option>
                    <option value="interval">Interval</option>
                    <option value="long">Long Run</option>
                    <option value="race">Race</option>
                    <option value="recovery">Recovery</option>
                    <option value="cross">Cross Training</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1">Effort (RPE 1-10)</label>
                  <input type="number" min="1" max="10" value={manualData.rpe} onChange={(event) => setManualData({ ...manualData, rpe: event.target.value })} className="w-full border rounded-lg px-3 py-2" placeholder="6" />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1">Soreness (1-10)</label>
                  <input type="number" min="1" max="10" value={manualData.soreness} onChange={(event) => setManualData({ ...manualData, soreness: event.target.value })} className="w-full border rounded-lg px-3 py-2" placeholder="3" />
                </div>
                <label className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700">
                  <input type="checkbox" checked={manualData.illness} onChange={(event) => setManualData({ ...manualData, illness: event.target.checked })} className="h-4 w-4" />
                  Sick today
                </label>
                <div>
                  <label className="block text-sm font-bold mb-1">Avg HR</label>
                  <input type="number" min="1" max="250" value={manualData.avgHr} onChange={(event) => setManualData({ ...manualData, avgHr: event.target.value })} className="w-full border rounded-lg px-3 py-2" placeholder="Optional" />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1">Max HR</label>
                  <input type="number" min="1" max="250" value={manualData.maxHr} onChange={(event) => setManualData({ ...manualData, maxHr: event.target.value })} className="w-full border rounded-lg px-3 py-2" placeholder="Optional" />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1">Garmin Load</label>
                  <input type="number" min="0" step="0.01" value={manualData.trainingLoad} onChange={(event) => setManualData({ ...manualData, trainingLoad: event.target.value })} className="w-full border rounded-lg px-3 py-2" placeholder="Optional" />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1">Elevation Gain (m)</label>
                  <input type="number" min="0" value={manualData.elevationGainM} onChange={(event) => setManualData({ ...manualData, elevationGainM: event.target.value })} className="w-full border rounded-lg px-3 py-2" placeholder="Optional" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold mb-1">Notes</label>
                <textarea value={manualData.notes} onChange={(event) => setManualData({ ...manualData, notes: event.target.value })} className="w-full border rounded-lg px-3 py-2" rows={3} placeholder="Optional coach note" />
              </div>
            </div>
          )}

          <button type="submit" className="w-full bg-gradient-to-r from-[#00ff67] to-[#00a7ff] text-white py-3 px-4 rounded-lg hover:shadow-lg hover:shadow-[#00a7ff]/25 transition-all font-bold">
            Upload Run
          </button>
        </form>
      </main>
    </div>
  );
}
