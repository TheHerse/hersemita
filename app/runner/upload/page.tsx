"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { parseActivityFile } from "@/lib/parse-activity-file";

interface Runner {
  first_name: string;
  last_name: string;
  grade: number;
}

export default function RunnerUploadPage() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [runner, setRunner] = useState<Runner | null>(null);
  const [runnerId, setRunnerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function loadRunner() {
      const id = localStorage.getItem("runner_id");

      if (!id) {
        router.push("/runner/login");
        return;
      }

      setRunnerId(id);

      const { data, error: fetchError } = await supabase
        .from("runners")
        .select("first_name, last_name, grade")
        .eq("id", id)
        .single();

      if (fetchError || !data) {
        localStorage.removeItem("runner_id");
        router.push("/runner/login");
        return;
      }

      setRunner(data);
      setLoading(false);
    }

    loadRunner();
  }, [router]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!runnerId) return;
    
    setUploading(true);
    setError(null);
    setSuccess(false);

    try {
      const formData = new FormData(e.currentTarget);
      const file = formData.get("file") as File;
      const fileType = file.name.split('.').pop()?.toLowerCase() || 'unknown';

      if (!['gpx', 'fit', 'tcx'].includes(fileType)) {
        throw new Error("Invalid file type. Please upload .gpx, .fit, or .tcx files.");
      }

      const activityData = await parseActivityFile(file, fileType);
      
      const { data: existing } = await supabase
        .from("activities")
        .select("id")
        .eq("runner_id", runnerId)
        .eq("start_time", activityData.start_time)
        .single();

      if (existing) {
        throw new Error("This run was already uploaded. Check your activities list.");
      }

      const { error: insertError } = await supabase.from("activities").insert({
        runner_id: runnerId,
        garmin_activity_id: `runner_upload_${Date.now()}`,
        distance_miles: activityData.distance_miles,
        duration_seconds: activityData.duration_seconds,
        pace_per_mile: activityData.pace_per_mile,
        start_time: activityData.start_time,
        verified: false,
        uploaded_by: 'runner',
        file_type: fileType,
        original_filename: file.name,
      });

      if (insertError) throw new Error("Failed to save activity");

      setSuccess(true);
      formRef.current?.reset();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      setError(message);
    } finally {
      setUploading(false);
    }
  }

  function logout() {
    localStorage.removeItem("runner_id");
    router.push("/runner/login");
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        Loading...
      </div>
    );
  }

  if (!runner) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b px-4 py-3 flex justify-between items-center">
        <h1 className="text-xl font-bold text-slate-900">Upload Run</h1>
        <button onClick={logout} className="text-red-600 text-sm hover:underline">Logout</button>
      </header>

      <main className="p-6 max-w-lg mx-auto">
        <div className="bg-white p-6 rounded-lg shadow-sm border mb-6">
          <h2 className="text-xl font-bold text-slate-900 mb-2">
            {runner.first_name} {runner.last_name}
          </h2>
          <p className="text-slate-600">Grade {runner.grade} • Upload your run activity</p>
        </div>

        <form ref={formRef} onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-sm border space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-md text-sm">
              {error}
            </div>
          )}
          
          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-3 py-2 rounded-md text-sm">
              Run uploaded successfully! Your coach will verify it soon.
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Activity File (GPX, FIT, TCX)</label>
            <input name="file" type="file" accept=".fit,.gpx,.tcx" required className="w-full px-3 py-2 border rounded-md" />
            <details className="mt-2 text-xs text-slate-500">
              <summary className="cursor-pointer">How to export from your app</summary>
              <div className="mt-2 space-y-1">
                <p><b>Strava:</b> Activity → ... → Export GPX</p>
                <p><b>Garmin:</b> Activity → Gear → Export Original</p>
                <p><b>Apple Watch:</b> Use "Shortcuts" app (ask coach for setup)</p>
              </div>
            </details>
          </div>
          
          <button type="submit" disabled={uploading} className="w-full bg-green-600 text-white py-3 px-4 rounded-md hover:bg-green-700 disabled:bg-green-400 font-semibold">
            {uploading ? "Uploading..." : "Upload Run"}
          </button>
        </form>
      </main>
    </div>
  );
}