"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { supabase } from "@/lib/supabase";
import { parseActivityFile } from "@/lib/parse-activity-file";

interface Props {
  params: Promise<{
    runnerId: string;
  }>;
}

export default function CoachUploadForRunnerPage({ params }: Props) {
  const router = useRouter();
  const { isLoaded, userId } = useAuth();
  
  // Wait for Clerk to load
  if (!isLoaded) {
    return <div className="p-8">Loading...</div>;
  }
  
  // If not signed in after load, Clerk will handle redirect
  if (!userId) {
    return null;
  }

  async function handleSubmit(formData: FormData) {
    const { runnerId } = await params;
    const file = formData.get("file") as File;
    const fileType = file.name.split('.').pop()?.toLowerCase() || 'unknown';

    try {
      const activityData = await parseActivityFile(file, fileType);
      
      const { error } = await supabase.from("activities").insert({
        runner_id: runnerId,
        garmin_activity_id: `coach_upload_${Date.now()}`,
        distance_miles: activityData.distance_miles,
        duration_seconds: activityData.duration_seconds,
        pace_per_mile: activityData.pace_per_mile,
        start_time: activityData.start_time,
        verified: false,
        uploaded_by: 'coach',
        file_type: fileType,
        original_filename: file.name,
      });

      if (error) throw error;
      router.push("/runners");
    } catch (error) {
      console.error("Upload error:", error);
      alert("Upload failed: " + (error as Error).message);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b px-8 py-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-900">Hersemita</h1>
        <a href="/runners" className="text-blue-600 hover:underline">Back to Runners</a>
      </header>

      <main className="p-8 max-w-2xl mx-auto">
        <h2 className="text-3xl font-bold text-slate-900 mb-2">Upload Run</h2>
        
        <form action={handleSubmit} className="bg-white p-6 rounded-lg shadow-sm border space-y-4">
          <input name="file" type="file" accept=".fit,.gpx,.tcx" required className="w-full px-3 py-2 border rounded-md" />
          <button type="submit" className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 font-semibold">
            Upload Run
          </button>
        </form>
      </main>
    </div>
  );
}