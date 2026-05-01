"use client";

import { useState } from "react";

export default function ScreenshotProofViewer({ urls }: { urls?: string[] | null }) {
  const [activeUrl, setActiveUrl] = useState<string | null>(null);

  if (!urls || urls.length === 0) return null;

  return (
    <div className="mt-3 rounded-lg border border-slate-700 bg-[#0f172a] px-3 py-2">
      <p className="text-sm font-semibold text-[#7dd3fc]">Screenshot proof ({urls.length})</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {urls.map((url, index) => (
          <button
            key={url}
            type="button"
            onClick={() => setActiveUrl(url)}
            className="rounded-lg border border-slate-600 bg-[#111827] px-3 py-2 text-xs font-bold text-white transition hover:border-[#00a7ff]"
          >
            View screenshot {index + 1}
          </button>
        ))}
      </div>

      {activeUrl && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-700 bg-[#0f172a] shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-700 px-4 py-3">
              <h3 className="font-bold text-white">Screenshot Proof</h3>
              <button
                type="button"
                onClick={() => setActiveUrl(null)}
                className="rounded-lg border border-slate-600 px-3 py-1 text-sm font-bold text-white transition hover:bg-slate-800"
              >
                Close
              </button>
            </div>
            <div className="max-h-[82vh] overflow-auto p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={activeUrl} alt="Run screenshot proof" className="mx-auto max-h-[78vh] w-auto rounded-lg object-contain" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
