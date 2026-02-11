"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Image from "next/image";

interface Runner {
  first_name: string;
  last_name: string;
  grade: number;
}

interface ExtractedData {
  distance: number | null;
  duration: string | null;
  pace: string | null;
  date: string | null;
  confidence: 'high' | 'medium' | 'low';
}

export default function RunnerUploadPage() {
  const router = useRouter();
  const [runner, setRunner] = useState<Runner | null>(null);
  const [runnerId, setRunnerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  // Multi-screenshot state
  const [screenshots, setScreenshots] = useState<File[]>([]);
  const [screenshotPreviews, setScreenshotPreviews] = useState<string[]>([]);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [showVerification, setShowVerification] = useState(false);
  
  // Form data for verification/correction
  const [formData, setFormData] = useState({
    distance: '',
    duration: '',
    pace: '',
    date: '',
  });

  useEffect(() => {
    async function loadRunner() {
      const id = localStorage.getItem("runner_id");
      if (!id) {
        router.push("/runner/login");
        return;
      }
      setRunnerId(id);
      const { data } = await supabase
        .from("runners")
        .select("first_name, last_name, grade")
        .eq("id", id)
        .single();

      if (!data) {
        localStorage.removeItem("runner_id");
        router.push("/runner/login");
        return;
      }
      setRunner(data);
      setLoading(false);
    }
    loadRunner();
  }, [router]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      // Add to existing screenshots (up to 3)
      const newScreenshots = [...screenshots, ...files].slice(0, 3);
      setScreenshots(newScreenshots);
      
      // Generate previews
      const newPreviews = files.map(file => URL.createObjectURL(file));
      setScreenshotPreviews([...screenshotPreviews, ...newPreviews].slice(0, 3));
    }
  };

  const removeScreenshot = (index: number) => {
    const newScreenshots = screenshots.filter((_, i) => i !== index);
    const newPreviews = screenshotPreviews.filter((_, i) => i !== index);
    
    // Revoke object URL to prevent memory leak
    URL.revokeObjectURL(screenshotPreviews[index]);
    
    setScreenshots(newScreenshots);
    setScreenshotPreviews(newPreviews);
  };

  const processScreenshots = async () => {
    if (screenshots.length === 0) return;
    
    setProcessing(true);
    setError(null);
    
    try {
      const formData = new FormData();
      screenshots.forEach(file => {
        formData.append('screenshots', file);
      });
      
      const response = await fetch('/api/parse-screenshot', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('Failed to process images');
      }
      
      const result = await response.json();
      const data = result.data as ExtractedData;
      setExtractedData(data);
      
      // Pre-fill form
      setFormData({
        distance: data.distance?.toString() || '',
        duration: data.duration || '',
        pace: data.pace || '',
        date: data.date || new Date().toISOString().split('T')[0],
      });
      
      setShowVerification(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process screenshots');
    } finally {
      setProcessing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!runnerId) return;
    
    setUploading(true);
    setError(null);

    try {
      // Convert duration to seconds for storage
      const [minutes, seconds] = formData.duration.split(':').map(Number);
      const durationSeconds = (minutes * 60) + (seconds || 0);
      
      // Convert pace to seconds per mile
      const [paceMin, paceSec] = formData.pace.split(':').map(Number);
      const pacePerMile = (paceMin * 60) + (paceSec || 0);

      const { error: insertError } = await supabase.from("activities").insert({
        runner_id: runnerId,
        garmin_activity_id: `screenshot_upload_${Date.now()}`,
        distance_miles: parseFloat(formData.distance),
        duration_seconds: durationSeconds,
        pace_per_mile: pacePerMile,
        start_time: formData.date || new Date().toISOString(),
        verified: false,
        uploaded_by: 'runner',
        file_type: 'screenshot',
        original_filename: screenshots.map(s => s.name).join(', '),
      });

      if (insertError) throw new Error("Failed to save activity");

      setSuccess(true);
      setScreenshots([]);
      setScreenshotPreviews([]);
      setShowVerification(false);
      setExtractedData(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const resetUpload = () => {
    setShowVerification(false);
    setExtractedData(null);
    setError(null);
  };

  function logout() {
    localStorage.removeItem("runner_id");
    router.push("/runner/login");
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-600">Loading...</div>
      </div>
    );
  }

  if (!runner) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg overflow-hidden bg-white">
            <Image src="/logo.png" alt="Hersemita" width={32} height={32} className="w-full h-full object-contain" />
          </div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-[#00ff67] to-[#00a7ff] bg-clip-text text-transparent">
            Upload Run
          </h1>
        </div>
        <button onClick={logout} className="text-red-500 hover:text-red-700 text-sm font-semibold hover:underline transition-colors">
          Logout
        </button>
      </header>

      <main className="p-4 max-w-lg mx-auto">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-6">
          <h2 className="text-2xl font-bold text-slate-900 mb-1">
            {runner.first_name} {runner.last_name}
          </h2>
          <p className="text-slate-600">Grade {runner.grade} • Upload your run activity</p>
        </div>

        {!showVerification ? (
          // Screenshot Upload Stage
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm font-medium">
                {error}
              </div>
            )}
            
            {success && (
              <div className="bg-[#00ff67]/10 border border-[#00ff67]/30 text-[#00a7ff] px-4 py-3 rounded-lg text-sm font-medium flex items-center gap-2">
                <svg className="w-5 h-5 text-[#00ff67]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Run uploaded successfully! Your coach will verify it soon.
                <button onClick={() => setSuccess(false)} className="ml-auto text-[#00a7ff] underline">Upload another</button>
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Screenshot(s) of your Garmin Connect activity
              </label>
              <p className="text-xs text-slate-500 mb-3">
                Take screenshots of the Overview tab (shows Distance, Time, Pace). Add the Stats tab if data is unclear.
              </p>
              
              {/* Screenshot Previews */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                {screenshotPreviews.map((preview, index) => (
                  <div key={index} className="relative aspect-[9/16] rounded-lg overflow-hidden border-2 border-slate-200">
                    <img src={preview} alt={`Screenshot ${index + 1}`} className="w-full h-full object-cover" />
                    <button
                      onClick={() => removeScreenshot(index)}
                      className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600"
                    >
                      ×
                    </button>
                  </div>
                ))}
                
                {/* Add More Button (up to 3) */}
                {screenshots.length < 3 && (
                  <label className="aspect-[9/16] rounded-lg border-2 border-dashed border-slate-300 flex flex-col items-center justify-center cursor-pointer hover:border-[#00a7ff] hover:bg-slate-50 transition-colors">
                    <svg className="w-8 h-8 text-slate-400 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span className="text-xs text-slate-500">Add</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={handleFileSelect}
                      capture="environment"
                    />
                  </label>
                )}
              </div>
              
              {/* Mobile Camera Button */}
              <label className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 rounded-lg cursor-pointer flex items-center justify-center gap-2 transition-colors font-medium">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Take Photo / Choose from Gallery
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={handleFileSelect}
                  capture="environment"
                />
              </label>
            </div>

            <button 
              onClick={processScreenshots}
              disabled={screenshots.length === 0 || processing}
              className="w-full bg-gradient-to-r from-[#00ff67] to-[#00a7ff] text-white py-3 rounded-lg hover:shadow-lg hover:shadow-[#00a7ff]/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-bold text-lg flex items-center justify-center gap-2"
            >
              {processing ? (
                <>
                  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Reading screenshots...
                </>
              ) : (
                `Extract Data (${screenshots.length} image${screenshots.length !== 1 ? 's' : ''})`
              )}
            </button>

            {/* Instructions */}
            <details className="group">
              <summary className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer hover:text-slate-900 transition-colors list-none font-medium">
                <svg className="w-4 h-4 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
                How to screenshot on Garmin Connect
              </summary>
              <div className="mt-3 space-y-3 p-4 bg-slate-50 rounded-lg text-sm">
                <ol className="list-decimal list-inside space-y-2 text-slate-600">
                  <li>Open Garmin Connect app</li>
                  <li>Find your activity and tap it</li>
                  <li>Stay on the <strong>Overview</strong> tab (shows big distance number)</li>
                  <li>Take a screenshot (Volume Down + Power)</li>
                  <li>If stats are unclear, also screenshot the <strong>Stats</strong> tab</li>
                </ol>
              </div>
            </details>
          </div>
        ) : (
          // Verification Stage
          <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-full bg-[#00ff67]/10 flex items-center justify-center">
                <svg className="w-4 h-4 text-[#00ff67]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="font-bold text-slate-900">Verify Extracted Data</h3>
            </div>
            
            {extractedData && (
              <div className="p-3 bg-slate-50 rounded-lg text-xs text-slate-600 mb-4">
                Confidence: <span className={extractedData.confidence === 'high' ? 'text-[#00ff67] font-bold' : 'text-orange-500 font-bold'}>{extractedData.confidence}</span>
                {extractedData.confidence !== 'high' && ' - Please verify numbers are correct'}
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Distance (miles)</label>
              <input 
                type="number" 
                step="0.01"
                value={formData.distance}
                onChange={(e) => setFormData({...formData, distance: e.target.value})}
                className="w-full px-4 py-2 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-[#00a7ff] transition-colors font-semibold text-slate-900"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Duration (MM:SS or HH:MM:SS)</label>
              <input 
                type="text" 
                placeholder="26:45"
                value={formData.duration}
                onChange={(e) => setFormData({...formData, duration: e.target.value})}
                className="w-full px-4 py-2 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-[#00a7ff] transition-colors font-semibold text-slate-900"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Pace (min/mile)</label>
              <input 
                type="text" 
                placeholder="8:30"
                value={formData.pace}
                onChange={(e) => setFormData({...formData, pace: e.target.value})}
                className="w-full px-4 py-2 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-[#00a7ff] transition-colors font-semibold text-slate-900"
                required
              />
              <p className="text-xs text-slate-500 mt-1">Auto-calculated if empty, but verify from screenshot</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Date</label>
              <input 
                type="date" 
                value={formData.date}
                onChange={(e) => setFormData({...formData, date: e.target.value})}
                className="w-full px-4 py-2 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-[#00a7ff] transition-colors font-semibold text-slate-900"
                required
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button 
                type="button"
                onClick={resetUpload}
                className="px-6 py-3 border-2 border-slate-200 rounded-lg hover:bg-slate-50 font-semibold text-slate-700 transition-colors"
              >
                Back
              </button>
              <button 
                type="submit" 
                disabled={uploading}
                className="flex-1 bg-gradient-to-r from-[#00ff67] to-[#00a7ff] text-white py-3 rounded-lg hover:shadow-lg hover:shadow-[#00a7ff]/25 transition-all disabled:opacity-50 font-bold flex items-center justify-center gap-2"
              >
                {uploading ? 'Saving...' : 'Confirm & Upload'}
              </button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}