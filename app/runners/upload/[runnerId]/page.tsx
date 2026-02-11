"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { supabase } from "@/lib/supabase";
import { parseActivityFile } from "@/lib/parse-activity-file";
import Image from "next/image";

interface Props {
  params: Promise<{
    runnerId: string;
  }>;
}

export default function CoachUploadForRunnerPage({ params }: Props) {
  const router = useRouter();
  const { isLoaded, userId } = useAuth();
  
  if (!isLoaded) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center">Loading...</div>;
  }
  
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
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg overflow-hidden bg-white">
            <Image src="/logo.png" alt="Hersemita" width={40} height={40} className="w-full h-full object-contain" />
          </div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-[#00ff67] to-[#00a7ff] bg-clip-text text-transparent">
            Hersemita
          </h1>
        </div>
        <a href="/runners" className="text-slate-600 hover:text-[#00a7ff] transition-colors font-medium">Back to Runners</a>
      </header>

      <main className="p-8 max-w-2xl mx-auto">
        <h2 className="text-3xl font-bold text-slate-900 mb-2">Upload Run</h2>
        <p className="text-slate-500 mb-6">Uploading activity for runner</p>
        
        <form action={handleSubmit} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-6">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Activity File (GPX, FIT, TCX)</label>
            <input name="file" type="file" accept=".fit,.gpx,.tcx" required className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-[#00a7ff] transition-colors" />
          </div>
          <button type="submit" className="w-full bg-gradient-to-r from-[#00ff67] to-[#00a7ff] text-white py-3 px-4 rounded-lg hover:shadow-lg hover:shadow-[#00a7ff]/25 transition-all font-bold">
            Upload Run
          </button>
        </form>
      </main>
    </div>
  );
}