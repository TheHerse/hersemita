"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useClerk } from "@clerk/nextjs";
import Image from "next/image";

function LoginForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { signOut } = useClerk();
  const [username, setUsername] = useState(searchParams.get("username") || "");
  const [passcode, setPasscode] = useState(searchParams.get("code") || "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const redirectTo = searchParams.get("redirect") || "/runner/dashboard";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const response = await fetch("/api/runner-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, code: passcode }),
    });

    const result = await response.json().catch(() => null) as {
      runner?: { id: string; name: string };
      error?: string;
    } | null;

    if (!response.ok || !result?.runner) {
      setError(result?.error || "Invalid username or passcode");
      setLoading(false);
      return;
    }

    // Runner accounts are commonly opened on a coach-managed/shared device.
    // Clear any lingering Clerk coach/guardian session before handing the
    // browser to the runner so protected adult pages cannot be revisited.
    await signOut({ redirectUrl: redirectTo });
  };

  return (
    <div className="min-h-screen hersemita-auth-bg flex items-center justify-center p-4 relative overflow-hidden">
      <button
        type="button"
        onClick={() => router.push("/")}
        className="absolute left-4 top-4 z-20 rounded-lg border border-white/20 bg-white/85 px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-white hover:text-slate-950"
      >
        Home
      </button>
      <div className="absolute top-20 left-20 w-72 h-72 bg-[#00ff67]/10 rounded-full blur-3xl" />
      <div className="absolute bottom-20 right-20 w-96 h-96 bg-[#00a7ff]/10 rounded-full blur-3xl" />
      
      <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md relative z-10">
        <div className="flex flex-col items-center gap-4 mb-8">
          <div className="w-16 h-16 rounded-xl overflow-hidden bg-white">
            <Image 
              src="/logo.png" 
              alt="Hersemita" 
              width={64} 
              height={64} 
              className="w-full h-full object-contain"
            />
          </div>
          <h1 className="brand-wordmark text-3xl font-bold">
            Runner Portal
          </h1>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoCapitalize="none"
              autoComplete="username"
              className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-center text-lg font-bold text-slate-800 focus:outline-none focus:border-[#00a7ff] focus:ring-4 focus:ring-[#00a7ff]/10 transition-all"
              placeholder="lastname_f1234"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Passcode
            </label>
            <input
              type="text"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value.toUpperCase())}
              autoCapitalize="characters"
              autoComplete="one-time-code"
              maxLength={16}
              className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-center text-2xl tracking-[0.18em] font-bold text-slate-800 focus:outline-none focus:border-[#00a7ff] focus:ring-4 focus:ring-[#00a7ff]/10 transition-all"
              placeholder="A7K9Q2M4"
              required
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm text-center py-2 rounded-lg font-medium">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-[#00ff67] to-[#00a7ff] text-white py-3 rounded-xl hover:shadow-lg hover:shadow-[#00a7ff]/25 transition-all disabled:opacity-50 font-bold text-lg"
          >
            {loading ? "Checking..." : "Login"}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-slate-500">
          Ask your coach for your username and passcode
        </div>
      </div>
    </div>
  );
}

export default function RunnerLoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen hersemita-auth-bg flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
