"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { supabase } from "@/lib/supabase";
import { parseActivityFile } from "@/lib/parse-activity-file";
import Image from "next/image";
import Link from "next/link";

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

export default function CoachUploadForRunnerPage({ params }: Props) {
  const router = useRouter();
  const { isLoaded, userId } = useAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [manualData, setManualData] = useState({
    distance: "",
    duration: "",
    pace: "",
    date: new Date().toISOString().split("T")[0],
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
    const fileType = file.name.split(".").pop()?.toLowerCase() || "unknown";
    const isImage = file.type.startsWith("image/");

    try {
      if (isImage) {
        const fileName = `${runnerId}/coach_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, "_")}`;
        const { error: uploadError } = await supabase.storage
          .from("activity-screenshots")
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from("activity-screenshots").getPublicUrl(fileName);
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
          screenshot_urls: [data.publicUrl],
          notes: manualData.notes || null,
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
      <header className="bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-50 sm:px-6 sm:py-4">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg overflow-hidden bg-white">
            <Image src="/logo.png" alt="Hersemita" width={40} height={40} className="w-full h-full object-contain" />
          </div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-[#00ff67] to-[#00a7ff] bg-clip-text text-transparent">
            Hersemita
          </h1>
        </Link>
        <Link href="/runners" className="w-full rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-center text-sm font-bold text-white transition hover:bg-white/15 sm:w-auto">
          &larr; Back to Runners
        </Link>
        </div>
      </header>

      <main className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto">
        <div className="mb-8 rounded-2xl border border-white/10 bg-white/10 p-5 sm:p-6 shadow-2xl shadow-black/10 backdrop-blur">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#00a7ff]">Coach Upload</p>
          <h2 className="mt-2 text-3xl font-bold text-white">Upload Run Proof</h2>
          <p className="mt-2 text-[#cbd5e1]">Add a screenshot like the runner upload flow, or use a GPX, FIT, or TCX file.</p>
        </div>
        
        <form action={handleSubmit} className="bg-white p-5 sm:p-6 rounded-xl shadow-sm border border-slate-200 space-y-6">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Run Proof</label>
            <input
              name="file"
              type="file"
              accept="image/*,.fit,.gpx,.tcx"
              required
              onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
              className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-[#00a7ff] transition-colors"
            />
            <p className="mt-2 text-xs text-slate-500">Screenshots require manual details below. GPX, FIT, and TCX files will be parsed automatically.</p>
          </div>

          {selectedFile?.type.startsWith("image/") && (
            <div className="rounded-xl border border-[#00a7ff]/20 bg-[#00a7ff]/5 p-4 space-y-4">
              <h3 className="font-bold text-white">Screenshot Details</h3>
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
