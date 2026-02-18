'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { parseOCR } from '@/lib/ocr-parser';

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
  const [screenshots, setScreenshots] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [screenshotUrls, setScreenshotUrls] = useState<string[]>([]);
  const [detectedApp, setDetectedApp] = useState('unknown');
  const [rawValues, setRawValues] = useState({ distance: '', pace: '' });
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const [formData, setFormData] = useState({
    distance: '',
    duration: '',
    pace: '',
    date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  useEffect(() => {
    const id = localStorage.getItem('runner_id');
    const name = localStorage.getItem('runner_name');
    if (!id) {
      router.push('/runner/login');
      return;
    }
    setRunnerId(id);
    setRunnerName(name || '');
    setLoading(false);
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

  const processImages = async () => {
    if (!runnerId || screenshots.length === 0) {
      setError('Please select files');
      return;
    }
    
    setProcessing(true);
    setError(null);
    
    try {
      // Upload to Supabase
      const urls: string[] = [];
      for (let i = 0; i < screenshots.length; i++) {
        const file = screenshots[i];
        const fileName = `${runnerId}/${Date.now()}_${i}.png`;
        
        const { error: upErr } = await supabase.storage
          .from('activity-screenshots')
          .upload(fileName, file);
          
        if (upErr) throw upErr;
        
        const { data } = supabase.storage.from('activity-screenshots').getPublicUrl(fileName);
        urls.push(data.publicUrl);
      }
      setScreenshotUrls(urls);

      // OCR in browser
      if (typeof window !== 'undefined') {
        const { createWorker } = await import('tesseract.js');
        const worker = await createWorker('eng');
        const { data: { text } } = await worker.recognize(screenshots[0]);
        await worker.terminate();
        
        const parsed: ParsedRunData = parseOCR(text);
        
        // Convert nulls to empty strings safely
        setFormData({
          distance: parsed.distance != null ? String(parsed.distance) : '',
          duration: parsed.duration || '',
          pace: parsed.pace || '',
          date: parsed.date || new Date().toISOString().split('T')[0],
          notes: ''
        });
        
        setDetectedApp(parsed.app || 'unknown');
        setRawValues({
          distance: parsed.rawDistance || '',
          pace: parsed.rawPace || ''
        });
      }
      
      setShowForm(true);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to process');
    } finally {
      setProcessing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!runnerId || screenshotUrls.length === 0) return;

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
      const { error: insertError } = await supabase.from('activities').insert({
        runner_id: runnerId,
        garmin_activity_id: `manual_${Date.now()}`,
        distance_miles: distance,
        duration_seconds: durationSeconds,
        pace_per_mile: paceSeconds,
        start_time: new Date(formData.date).toISOString(),
        verified: false,
        uploaded_by: 'runner',
        file_type: 'screenshot',
        screenshot_urls: screenshotUrls,
        detected_app: detectedApp || null,
        raw_distance: rawValues.distance || null,
        raw_pace: rawValues.pace || null,
        notes: formData.notes || null,
      });

      if (insertError) {
        console.error('Insert error:', insertError);
        throw insertError;
      }
      
      router.push('/runner/upload/success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    }
  };

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center">Loading...</div>;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-3xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Hersemita" className="w-10 h-10 object-contain" />
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-[#00ff67] to-[#00a7ff] bg-clip-text text-transparent">Hersemita</h1>
              {runnerName && <p className="text-xs text-slate-500">Welcome, {runnerName}</p>}
            </div>
          </div>
          <button onClick={() => { localStorage.clear(); router.push('/runner/login'); }} className="text-sm text-slate-600 hover:text-red-500">Logout</button>
        </div>
      </header>

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

            <button onClick={processImages} disabled={screenshots.length === 0 || processing} className="w-full bg-gradient-to-r from-[#00ff67] to-[#00a7ff] text-white py-3 rounded-lg font-bold disabled:opacity-50">
              {processing ? 'Processing...' : 'Extract Data from Images'}
            </button>

            <button onClick={() => setShowForm(true)} className="w-full mt-3 border border-slate-300 text-slate-700 py-3 rounded-lg font-medium hover:bg-slate-50">
              Skip OCR - Enter Manually
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center gap-2 mb-6">
              <span className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center">✓</span>
              <h3 className="font-semibold text-lg">Verify Details</h3>
            </div>

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
                    Distance (mi) {rawValues.distance && <span className="text-slate-400 font-normal">(was {rawValues.distance})</span>}
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
                    Pace {rawValues.pace && <span className="text-slate-400 font-normal">(was {rawValues.pace})</span>}
                  </label>
                  <input type="text" value={formData.pace} onChange={e => setFormData({...formData, pace: e.target.value})} className="w-full border rounded-lg px-3 py-2" placeholder="8:32" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold mb-1">Notes</label>
                <textarea value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} className="w-full border rounded-lg px-3 py-2" rows={3} placeholder="How did it feel?" />
              </div>

              {error && <div className="p-3 bg-red-50 text-red-600 rounded text-sm">{error}</div>}

              <div className="flex gap-3">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 border border-slate-300 py-3 rounded-lg font-bold hover:bg-slate-50">Back</button>
                <button type="submit" className="flex-1 bg-gradient-to-r from-[#00ff67] to-[#00a7ff] text-white py-3 rounded-lg font-bold">Submit</button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}