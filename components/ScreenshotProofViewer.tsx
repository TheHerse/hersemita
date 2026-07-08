"use client";

import { useState } from "react";
import { createPortal } from "react-dom";

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

      {activeUrl && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/95">
          <div className="flex h-screen w-screen flex-col">
            <div className="flex items-center justify-between border-b border-white/10 bg-[#0f172a] px-4 py-3">
              <h3 className="font-bold text-white">Screenshot Proof</h3>
              <button
                type="button"
                onClick={() => setActiveUrl(null)}
                className="rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/15"
              >
                Close
              </button>
            </div>
            <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={activeUrl} alt="Run screenshot proof" className="max-h-full max-w-full rounded-lg object-contain" />
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
