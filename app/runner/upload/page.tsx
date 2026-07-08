'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { parseOCR } from '@/lib/ocr-parser';
import RunnerPortalHeader from '@/components/RunnerPortalHeader';
import { distanceUnitLabel, milesToDistance, normalizeDistanceUnit, type DistanceUnit } from '@/lib/distance-units';

// Use the type from your ocr-parser file
type ParsedRunData = {
  distance: number | null;
  duration: string | null;
  pace: string | null;
  date: string | null;
  confidence: 'high' | 'medium' | 'low';
  app: 'garmin_connect' | 'garmin_clipboard' | 'strava' | 'apple_watch' | 'unknown';
  rawDistance: string | null;
  rawPace: string | null;
};

export default function UploadPage() {
  const router = useRouter();
  const [runnerId, setRunnerId] = useState<string | null>(null);
  const [runnerName, setRunnerName] = useState('');
  const [schoolName, setSchoolName] = useState('Your school');
  const [coachName, setCoachName] = useState('Coach');
  const [distanceUnit, setDistanceUnit] = useState<DistanceUnit>('miles');
  const [screenshots, setScreenshots] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [screenshotUrls, setScreenshotUrls] = useState<string[]>([]);
  const [detectedApp, setDetectedApp] = useState('unknown');
  const [rawValues, setRawValues] = useState({ distance: '', pace: '' });
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [entryMode, setEntryMode] = useState<'proof' | 'manual'>('proof');
  
  const [formData, setFormData] = useState({
    distance: '',
    duration: '',
    pace: '',
    date: new Date().toISOString().split('T')[0],
    workoutType: 'easy',
    rpe: '',
    soreness: '',
    illness: false,
    avgHr: '',
    maxHr: '',
    trainingLoad: '',
    elevationGainM: '',
    notes: ''
  });

  useEffect(() => {
    let active = true;

    async function loadSession() {
      const response = await fetch('/api/runner-session', { cache: 'no-store' });
      const result = await response.json().catch(() => null) as {
        runner?: { id: string; name: string; schoolName?: string; coachName?: string; preferredDistanceUnit?: string };
      } | null;

      if (!active) return;
      if (!response.ok || !result?.runner) {
        router.push('/runner/login');
        return;
      }

      setRunnerId(result.runner.id);
      setRunnerName(result.runner.name);
      setSchoolName(result.runner.schoolName || 'Your school');
      setCoachName(result.runner.coachName || 'Coach');
      setDistanceUnit(normalizeDistanceUnit(result.runner.preferredDistanceUnit));
      setLoading(false);
    }

    loadSession();
    return () => {
      active = false;
    };
  }, [router]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter(f => 
      f.type.startsWith('image/') || f.name.endsWith('.gpx')
    );
    setScreenshots(prev => [...prev, ...files]);
    setError(null);
  }, []);

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setScreenshots(prev => [...prev, ...Array.from(e.target.files || [])]);
      setError(null);
    }
  };

  const removeScreenshot = (index: number) => {
    setScreenshots(prev => prev.filter((_, i) => i !== index));
  };

  const startManualEntry = () => {
    setEntryMode('manual');
    setScreenshotUrls([]);
    setScreenshots([]);
    setDetectedApp('manual');
    setRawValues({ distance: '', pace: '' });
    setError(null);
    setShowForm(true);
  };

  const processImages = async (skipOcr = false) => {
    if (!runnerId || screenshots.length === 0) {
      setError('Please select files');
      return;
    }
    
    setProcessing(true);
    setError(null);
    
    let uploadedUrls: string[] = [];
    try {
      const uploadData = new FormData();
      screenshots.forEach((file) => uploadData.append('files', file));
      const uploadResponse = await fetch('/api/runner-screenshots', {
        method: 'POST',
        body: uploadData,
      });
      const uploadResult = await uploadResponse.json().catch(() => null) as { urls?: string[]; error?: string } | null;
      if (!uploadResponse.ok || !uploadResult?.urls?.length) {
        throw new Error(uploadResult?.error || 'Failed to upload screenshots');
      }
      const urls = uploadResult.urls;
      uploadedUrls = urls;
      setScreenshotUrls(urls);

      // OCR in browser. The runner still reviews every parsed value before sending.
      if (!skipOcr && typeof window !== 'undefined') {
        const { createWorker } = await import('tesseract.js');
        const worker = await createWorker('eng');
        const { data: { text } } = await worker.recognize(screenshots[0]);
        await worker.terminate();
        
        const parsed: ParsedRunData = parseOCR(text);
        
        // Convert nulls to empty strings safely
        setFormData({
          distance: parsed.distance != null ? String(Number(milesToDistance(parsed.distance, distanceUnit).toFixed(2))) : '',
          duration: parsed.duration || '',
          pace: parsed.pace || '',
          date: parsed.date || new Date().toISOString().split('T')[0],
          workoutType: 'easy',
          rpe: '',
          soreness: '',
          illness: false,
          avgHr: '',
          maxHr: '',
          trainingLoad: '',
          elevationGainM: '',
          notes: ''
        });
        
        setDetectedApp(parsed.app || 'unknown');
        setRawValues({
          distance: parsed.rawDistance || '',
          pace: parsed.rawPace || ''
        });
      }
      
      setEntryMode('proof');
      setShowForm(true);
    } catch (err) {
      console.error(err);
      if (uploadedUrls.length > 0) {
        setScreenshotUrls(uploadedUrls);
        setError('The screenshot was saved, but the parser could not read it. Please enter the run details manually.');
        setEntryMode('proof');
        setShowForm(true);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to process');
      }
    } finally {
      setProcessing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!runnerId) {
      setError('Runner session required. Please log in again.');
      return;
    }

    // Parse duration to seconds
    const parts = formData.duration.split(':').map(Number);
    let durationSeconds = 0;
    if (parts.length === 3) durationSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
    else if (parts.length === 2) durationSeconds = parts[0] * 60 + parts[1];

    // Calculate pace
    const distance = parseFloat(formData.distance);
    let paceSeconds = 0;
    if (formData.pace) {
      const [m, s] = formData.pace.split(':').map(Number);
      paceSeconds = (m || 0) * 60 + (s || 0);
    } else if (distance > 0) {
      paceSeconds = Math.round(durationSeconds / distance);
    }

    try {
      const response = await fetch('/api/runner-activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          screenshotUrls,
          distance,
          distanceUnit,
          durationSeconds,
          paceSeconds,
          date: formData.date,
          detectedApp,
          rawDistance: rawValues.distance,
          rawPace: rawValues.pace,
          workoutType: formData.workoutType,
          rpe: formData.rpe,
          soreness: formData.soreness,
          illness: formData.illness,
          avgHr: formData.avgHr,
          maxHr: formData.maxHr,
          trainingLoad: formData.trainingLoad,
          elevationGainM: formData.elevationGainM,
          notes: formData.notes,
        }),
      });

      if (!response.ok) {
        const result = await response.json().catch(() => null) as { error?: string } | null;
        const message = result?.error || 'Save failed';
        console.error('Insert error:', message);
        throw new Error(message);
      }
      
      router.push('/runner/upload/success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    }
  };

  if (loading) return <div className="min-h-screen hersemita-page-bg flex items-center justify-center text-white">Loading...</div>;

  return (
    <div className="min-h-screen hersemita-page-bg">
      <RunnerPortalHeader active="upload" runnerName={runnerName} schoolName={schoolName} coachName={coachName} />

      <main className="p-6 max-w-3xl mx-auto">
        <h2 className="text-3xl font-bold text-slate-900 mb-2 text-center">Upload Your Run</h2>
        <p className="text-slate-600 text-center mb-8">Take a photo of your watch or fitness app</p>

        {!showForm ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <div onDrop={onDrop} onDragOver={e => e.preventDefault()} className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:border-[#00a7ff] hover:bg-[#00a7ff]/5 transition-colors cursor-pointer mb-6">
              <input type="file" accept="image/*,.gpx" multiple onChange={onFileSelect} className="hidden" id="upload" />
              <label htmlFor="upload" className="cursor-pointer block">
                <div className="text-4xl mb-2">📸</div>
                <p className="font-semibold text-slate-700">Drop screenshots here or click to browse</p>
                <p className="text-sm text-slate-500">Supports: Garmin, Strava, Apple Watch</p>
              </label>
            </div>

            {screenshots.length > 0 && (
              <div className="mb-6">
                <p className="text-sm font-semibold mb-2">Selected ({screenshots.length})</p>
                <div className="grid grid-cols-3 gap-3">
                  {screenshots.map((f, i) => (
                    <div key={i} className="relative aspect-square rounded-lg overflow-hidden border">
                      <img src={URL.createObjectURL(f)} className="w-full h-full object-cover" alt="" />
                      <button onClick={() => removeScreenshot(i)} className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full text-sm">×</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {error && <div className="mb-4 p-3 bg-red-50 text-red-600 rounded text-sm">{error}</div>}

            <button onClick={() => processImages()} disabled={screenshots.length === 0 || processing} className="w-full bg-gradient-to-r from-[#00ff67] to-[#00a7ff] text-white py-3 rounded-lg font-bold disabled:opacity-50">
              {processing ? 'Processing...' : 'Extract Data from Images'}
            </button>

            <button onClick={() => processImages(true)} disabled={screenshots.length === 0 || processing} className="w-full mt-3 border border-slate-300 text-slate-700 py-3 rounded-lg font-medium hover:bg-slate-50 disabled:opacity-50">
              Save Screenshot and Enter Manually
            </button>

            <button onClick={startManualEntry} disabled={processing} className="w-full mt-3 rounded-lg border border-[#00a7ff]/40 bg-[#00a7ff]/10 py-3 font-bold text-[#0369a1] transition hover:bg-[#00a7ff]/15 disabled:opacity-50">
              Enter Run Without Screenshot
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center gap-2 mb-6">
              <span className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center">✓</span>
              <h3 className="font-semibold text-lg">Review Details Before Sending</h3>
            </div>

            {entryMode === 'manual' && screenshotUrls.length === 0 && (
              <div className="mb-6 rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-800">
                Manual entry is allowed when you cannot upload a screenshot. Your coach may still ask for proof before verifying the run.
              </div>
            )}

            {screenshotUrls.length > 0 && (
              <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
                {screenshotUrls.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noreferrer" className="flex-shrink-0">
                    <img src={url} alt="" className="w-24 h-32 object-cover rounded-lg border" />
                  </a>
                ))}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold mb-1">
                    Distance ({distanceUnitLabel(distanceUnit)}) {rawValues.distance && <span className="text-slate-400 font-normal">(was {rawValues.distance})</span>}
                  </label>
                  <input type="number" step="0.01" required value={formData.distance} onChange={e => setFormData({...formData, distance: e.target.value})} className="w-full border rounded-lg px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1">Date</label>
                  <input type="date" required value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full border rounded-lg px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1">Duration (MM:SS)</label>
                  <input type="text" required value={formData.duration} onChange={e => setFormData({...formData, duration: e.target.value})} className="w-full border rounded-lg px-3 py-2" placeholder="26:30" />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1">
                    Pace per {distanceUnitLabel(distanceUnit)} {rawValues.pace && <span className="text-slate-400 font-normal">(was {rawValues.pace})</span>}
                  </label>
                  <input type="text" value={formData.pace} onChange={e => setFormData({...formData, pace: e.target.value})} className="w-full border rounded-lg px-3 py-2" placeholder="8:32" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold mb-1">Workout Type</label>
                  <select value={formData.workoutType} onChange={e => setFormData({...formData, workoutType: e.target.value})} className="w-full border rounded-lg px-3 py-2">
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
                  <HelpLabel label="Effort (RPE 1-10)" help="Rate how hard the run felt. 1 is very easy, 5-6 is steady, and 10 is all-out race effort." />
                  <input type="number" min="1" max="10" value={formData.rpe} onChange={e => setFormData({...formData, rpe: e.target.value})} className="w-full border rounded-lg px-3 py-2" placeholder="6" />
                </div>
                <div>
                  <HelpLabel label="Soreness (1-10)" help="How sore you felt before or after the run. 1 is fresh, 10 means very sore or limited." />
                  <input type="number" min="1" max="10" value={formData.soreness} onChange={e => setFormData({...formData, soreness: e.target.value})} className="w-full border rounded-lg px-3 py-2" placeholder="3" />
                </div>
                <label className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700">
                  <input type="checkbox" checked={formData.illness} onChange={e => setFormData({...formData, illness: e.target.checked})} className="h-4 w-4" />
                  Sick today
                </label>
                <div>
                  <HelpLabel label="Avg HR" help="Average heart rate for the activity, if your watch or app shows it." />
                  <input type="number" min="1" max="250" value={formData.avgHr} onChange={e => setFormData({...formData, avgHr: e.target.value})} className="w-full border rounded-lg px-3 py-2" placeholder="Optional" />
                </div>
                <div>
                  <HelpLabel label="Max HR" help="Highest heart rate reached during the activity, if available." />
                  <input type="number" min="1" max="250" value={formData.maxHr} onChange={e => setFormData({...formData, maxHr: e.target.value})} className="w-full border rounded-lg px-3 py-2" placeholder="Optional" />
                </div>
                <div>
                  <HelpLabel label="Garmin Load" help="Garmin's training load number for the activity. Leave it blank if you do not see one." />
                  <input type="number" min="0" step="0.01" value={formData.trainingLoad} onChange={e => setFormData({...formData, trainingLoad: e.target.value})} className="w-full border rounded-lg px-3 py-2" placeholder="Optional" />
                </div>
                <div>
                  <HelpLabel label="Elevation Gain (m)" help="Total climbing from the activity. Most apps show this in feet or meters; enter meters for now." />
                  <input type="number" min="0" value={formData.elevationGainM} onChange={e => setFormData({...formData, elevationGainM: e.target.value})} className="w-full border rounded-lg px-3 py-2" placeholder="Optional" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold mb-1">Notes</label>
                <textarea value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} className="w-full border rounded-lg px-3 py-2" rows={3} placeholder="How did it feel?" />
              </div>

              {error && <div className="p-3 bg-red-50 text-red-600 rounded text-sm">{error}</div>}

              <div className="flex gap-3">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 border border-slate-300 py-3 rounded-lg font-bold hover:bg-slate-50">Back</button>
                <button type="submit" className="flex-1 bg-gradient-to-r from-[#00ff67] to-[#00a7ff] text-white py-3 rounded-lg font-bold">Submit for Coach Review</button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}

function HelpLabel({ label, help }: { label: string; help: string }) {
  return (
    <label className="mb-1 flex items-center gap-2 text-sm font-bold text-slate-900">
      <span>{label}</span>
      <span className="group relative inline-flex">
        <span
          tabIndex={0}
          aria-label={help}
          className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 bg-slate-50 text-xs font-black text-slate-500 outline-none transition hover:border-[#00a7ff] hover:text-[#00a7ff] focus:border-[#00a7ff] focus:text-[#00a7ff]"
        >
          ?
        </span>
        <span className="pointer-events-none absolute left-1/2 top-7 z-20 hidden w-64 -translate-x-1/2 rounded-lg border border-slate-200 bg-white p-3 text-xs font-medium leading-relaxed text-slate-600 shadow-xl group-hover:block group-focus-within:block">
          {help}
        </span>
      </span>
    </label>
  );
}
