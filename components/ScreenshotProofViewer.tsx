"use client";

import { useState } from "react";
import { createPortal } from "react-dom";

export default function ScreenshotProofViewer({ activityId, count }: { activityId: string; count: number }) {
  const [activeUrl, setActiveUrl] = useState<string | null>(null);
  const [loadingIndex, setLoadingIndex] = useState<number | null>(null);
  const [error, setError] = useState("");

  if (count <= 0) return null;

  async function openScreenshot(index: number) {
    setError("");
    setLoadingIndex(index);
    try {
      const response = await fetch(`/api/activity-screenshots/${encodeURIComponent(activityId)}/${index}`, {
        cache: "no-store",
      });
      const payload = await response.json().catch(() => null) as { url?: string; error?: string } | null;
      if (!response.ok || !payload?.url) throw new Error(payload?.error || "Screenshot access failed");
      setActiveUrl(payload.url);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Screenshot access failed");
    } finally {
      setLoadingIndex(null);
    }
  }

  return (
    <div className="mt-3 rounded-lg border border-slate-700 bg-[#0f172a] px-3 py-2">
      <p className="text-sm font-semibold text-[#7dd3fc]">Screenshot proof ({count})</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {Array.from({ length: count }, (_, index) => (
          <button
            key={index}
            type="button"
            onClick={() => openScreenshot(index)}
            disabled={loadingIndex !== null}
            className="rounded-lg border border-slate-600 bg-[#111827] px-3 py-2 text-xs font-bold text-white transition hover:border-[#00a7ff]"
          >
            {loadingIndex === index ? "Opening..." : `View screenshot ${index + 1}`}
          </button>
        ))}
      </div>
      {error && <p className="mt-2 text-xs font-semibold text-red-300">{error}</p>}

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
