'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

interface ExtractedData {
  distance?: number;
  duration?: string;
  pace?: string;
  date?: string;
  confidence?: 'high' | 'medium' | 'low';
  app?: 'garmin_connect' | 'garmin_clipboard' | 'strava' | 'apple_watch' | 'unknown';
  rawDistance?: string;
  rawPace?: string;
}

export default function UploadPage() {
  const router = useRouter();
  
  // Get runnerId from localStorage instead of URL
  const [runnerId, setRunnerId] = useState<string | null>(null);
  const [runnerName, setRunnerName] = useState<string>('');

  const [screenshots, setScreenshots] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [screenshotUrls, setScreenshotUrls] = useState<string[]>([]);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [detectedApp, setDetectedApp] = useState<string>('unknown');
  const [rawValues, setRawValues] = useState<{distance?: string, pace?: string}>({});
  const [showVerification, setShowVerification] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const [formData, setFormData] = useState({
    distance: '',
    duration: '',
    pace: '',
    date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  // Check localStorage on mount
  useEffect(() => {
    const storedId = localStorage.getItem('runner_id');
    const storedName = localStorage.getItem('runner_name');
    
    if (!storedId) {
      // No login session, redirect to login
      router.push('/runner/login');
      return;
    }
    
    setRunnerId(storedId);
    if (storedName) setRunnerName(storedName);
    setLoading(false);
  }, [router]);

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter(file => 
      file.type.startsWith('image/') || file.name.endsWith('.gpx')
    );
    setScreenshots(prev => [...prev, ...files]);
    setError(null);
  }, []);

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setScreenshots(prev => [...prev, ...files]);
      setError(null);
    }
  };

  const removeScreenshot = (index: number) => {
    setScreenshots(prev => prev.filter((_, i) => i !== index));
  };

  const getAppIcon = (app: string) => {
    switch(app) {
      case 'garmin_connect':
      case 'garmin_clipboard':
        return '📱 Garmin';
      case 'strava':
        return '🔥 Strava';
      case 'apple_watch':
        return '⌚ Apple Watch';
      default:
        return '📸 Screenshot';
    }
  };

  const processScreenshots = async () => {
    if (screenshots.length === 0 || !runnerId) {
      setError('Please select files');
      return;
    }
    
    setProcessing(true);
    setError(null);
    
    try {
      const data = new FormData();
      screenshots.forEach(file => {
        data.append('screenshots', file);
      });
      data.append('runnerId', runnerId);
      
      const response = await fetch('/api/parse-screenshot', {
        method: 'POST',
        body: data,
      });
      
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to process images');
      }
      
      const result = await response.json();
      const parsed = result.data as ExtractedData;
      
      setExtractedData(parsed);
      setScreenshotUrls(result.screenshotUrls || []);
      setDetectedApp(result.detectedApp || 'unknown');
      setRawValues({
        distance: result.rawDistance,
        pace: result.rawPace
      });
      
      // Pre-fill form with extracted data
      setFormData(prev => ({
        ...prev,
        distance: parsed.distance?.toString() || '',
        duration: parsed.duration || '',
        pace: parsed.pace || '',
        date: parsed.date || prev.date,
      }));
      
      setShowVerification(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process screenshots');
    } finally {
      setProcessing(false);
    }
  };

  const parseDurationToSeconds = (duration: string): number => {
    if (!duration) return 0;
    const parts = duration.split(':').map(Number);
    if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    }
    return parseFloat(duration) * 60 || 0;
  };

  const parsePaceToSeconds = (pace: string): number => {
    if (!pace) return 0;
    if (pace.includes(':')) {
      const [min, sec] = pace.split(':').map(Number);
      return (min || 0) * 60 + (sec || 0);
    }
    return parseFloat(pace) * 60 || 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!runnerId || screenshotUrls.length === 0) {
      setError('Missing required data. Please upload screenshots first.');
      return;
    }

    if (!formData.distance || !formData.duration) {
      setError('Please fill in distance and duration');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const durationSeconds = parseDurationToSeconds(formData.duration);
      const pacePerMile = parsePaceToSeconds(formData.pace) || 
        (durationSeconds / parseFloat(formData.distance));

      const { error: insertError } = await supabase.from('activities').insert({
        runner_id: runnerId,
        garmin_activity_id: `screenshot_upload_${Date.now()}`,
        distance_miles: parseFloat(formData.distance),
        duration_seconds: durationSeconds,
        pace_per_mile: pacePerMile,
        start_time: formData.date ? new Date(formData.date).toISOString() : new Date().toISOString(),
        verified: false,
        uploaded_by: 'runner',
        file_type: 'screenshot',
        original_filename: screenshots.map(s => s.name).join(', '),
        screenshot_urls: screenshotUrls,
        detected_app: detectedApp,
        raw_distance: rawValues.distance || null,
        raw_pace: rawValues.pace || null,
        notes: formData.notes || null,
      });

      if (insertError) throw insertError;

      // Clear form and redirect to success
      setScreenshots([]);
      setScreenshotUrls([]);
      setShowVerification(false);
      setFormData({
        distance: '',
        duration: '',
        pace: '',
        date: new Date().toISOString().split('T')[0],
        notes: ''
      });
      
      router.push('/runner/upload/success');
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save activity');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('runner_id');
    localStorage.removeItem('runner_name');
    router.push('/runner/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl overflow-hidden">
              <img src="/logo.png" alt="Hersemita" className="w-full h-full object-contain" />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-[#00ff67] to-[#00a7ff] bg-clip-text text-transparent">
                Hersemita
              </h1>
              {runnerName && (
                <p className="text-xs text-slate-500">Welcome, {runnerName}</p>
              )}
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="text-slate-600 hover:text-red-500 transition-colors text-sm font-medium"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="p-6">
        <div className="max-w-3xl mx-auto">
          <div className="mb-8 text-center">
            <h2 className="text-3xl font-bold text-slate-900 mb-2">Upload Your Run</h2>
            <p className="text-slate-600">Take a photo of your watch or fitness app showing your run details</p>
          </div>

          {!showVerification ? (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              {/* Upload Area */}
              <div
                onDrop={onDrop}
                onDragOver={(e) => e.preventDefault()}
                className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:border-[#00a7ff] hover:bg-[#00a7ff]/5 transition-colors cursor-pointer mb-6"
              >
                <input
                  type="file"
                  accept="image/*,.gpx"
                  multiple
                  onChange={onFileSelect}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload" className="cursor-pointer block">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#00a7ff]/10 flex items-center justify-center">
                    <svg className="w-8 h-8 text-[#00a7ff]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <p className="text-lg font-semibold text-slate-700 mb-1">Drop screenshots here or click to browse</p>
                  <p className="text-sm text-slate-500">Supports: Garmin, Strava, Apple Watch, GPX files</p>
                </label>
              </div>

              {/* Preview Selected Files */}
              {screenshots.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-slate-700 mb-3">Selected Files ({screenshots.length})</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {screenshots.map((file, idx) => (
                      <div key={idx} className="relative group aspect-square rounded-lg overflow-hidden border border-slate-200">
                        {file.type.startsWith('image/') ? (
                          <img
                            src={URL.createObjectURL(file)}
                            alt={`Preview ${idx + 1}`}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-slate-100 flex items-center justify-center">
                            <span className="text-xs font-medium text-slate-600">GPX</span>
                          </div>
                        )}
                        <button
                          onClick={() => removeScreenshot(idx)}
                          className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          ×
                        </button>
                        <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-1 truncate">
                          {file.name}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {error && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                  {error}
                </div>
              )}

              <button
                onClick={processScreenshots}
                disabled={screenshots.length === 0 || processing}
                className="w-full bg-gradient-to-r from-[#00ff67] to-[#00a7ff] text-white py-3 rounded-lg font-semibold hover:shadow-lg hover:shadow-[#00a7ff]/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {processing ? (
                  <>
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Processing...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Extract Data from Images
                  </>
                )}
              </button>

              <div className="mt-6 text-center">
                <button
                  onClick={() => setShowVerification(true)}
                  className="text-slate-500 hover:text-[#00a7ff] text-sm font-medium"
                >
                  Skip OCR - Enter manually →
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-full bg-[#00ff67]/10 flex items-center justify-center">
                  <svg className="w-4 h-4 text-[#00ff67]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Verify Your Run Details</h3>
                  <div className="flex items-center gap-2 mt-1">
                    {detectedApp !== 'unknown' && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                        {getAppIcon(detectedApp)}
                      </span>
                    )}
                    {extractedData?.confidence && (
                      <span className={`text-xs ${
                        extractedData.confidence === 'high' ? 'text-[#00ff67]' : 
                        extractedData.confidence === 'medium' ? 'text-yellow-600' : 'text-orange-500'
                      }`}>
                        Confidence: {extractedData.confidence}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Show uploaded screenshots */}
              {screenshotUrls.length > 0 && (
                <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <p className="text-sm font-semibold text-slate-700 mb-2">Uploaded Screenshots:</p>
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {screenshotUrls.map((url, idx) => (
                      <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
                        <img src={url} alt={`Screenshot ${idx + 1}`} className="w-24 h-32 object-cover rounded-lg border border-slate-200" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">
                      Distance (miles)
                      {rawValues.distance && (
                        <span className="ml-2 text-xs font-normal text-slate-500">
                          (Detected: {rawValues.distance})
                        </span>
                      )}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={formData.distance}
                      onChange={(e) => setFormData(prev => ({ ...prev, distance: e.target.value }))}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#00a7ff]/50 focus:border-[#00a7ff]"
                      placeholder="3.1"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Date</label>
                    <input
                      type="date"
                      required
                      value={formData.date}
                      onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#00a7ff]/50 focus:border-[#00a7ff]"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Duration (HH:MM:SS or MM:SS)</label>
                    <input
                      type="text"
                      required
                      value={formData.duration}
                      onChange={(e) => setFormData(prev => ({ ...prev, duration: e.target.value }))}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#00a7ff]/50 focus:border-[#00a7ff]"
                      placeholder="26:30 or 1:26:30"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">
                      Pace (min:sec/mile)
                      {rawValues.pace && (
                        <span className="ml-2 text-xs font-normal text-slate-500">
                          (Detected: {rawValues.pace})
                        </span>
                      )}
                    </label>
                    <input
                      type="text"
                      value={formData.pace}
                      onChange={(e) => setFormData(prev => ({ ...prev, pace: e.target.value }))}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#00a7ff]/50 focus:border-[#00a7ff]"
                      placeholder="8:32"
                    />
                    <p className="text-xs text-slate-500 mt-1">Optional - will calculate automatically</p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Notes (optional)</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#00a7ff]/50 focus:border-[#00a7ff]"
                    rows={3}
                    placeholder="How did the run feel? Any notes for your coach?"
                  />
                </div>

                {error && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                    {error}
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowVerification(false)}
                    className="flex-1 px-4 py-3 border border-slate-300 text-slate-700 rounded-lg font-semibold hover:bg-slate-50 transition-colors"
                  >
                    ← Back
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 bg-gradient-to-r from-[#00ff67] to-[#00a7ff] text-white py-3 rounded-lg font-semibold hover:shadow-lg hover:shadow-[#00a7ff]/20 transition-all disabled:opacity-50"
                  >
                    {submitting ? 'Saving...' : 'Submit to Coach'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}