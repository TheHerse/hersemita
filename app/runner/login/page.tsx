"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

function LoginForm() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/runner/upload";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { data: runner, error: lookupError } = await supabase
      .from("runners")
      .select("id, first_name, last_name")
      .eq("access_code", code)
      .single();

    if (lookupError || !runner) {
      setError("Invalid access code");
      setLoading(false);
      return;
    }

    localStorage.setItem("runner_id", runner.id);
    localStorage.setItem("runner_name", `${runner.first_name} ${runner.last_name}`);
    
    router.push(redirectTo);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <h1 className="text-2xl font-bold text-slate-900 mb-6 text-center">Runner Portal</h1>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Enter your 6-digit access code
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              maxLength={6}
              className="w-full border rounded-md px-3 py-2 text-center text-2xl tracking-widest"
              placeholder="000000"
              required
            />
          </div>

          {error && (
            <div className="text-red-600 text-sm text-center">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 font-semibold"
          >
            {loading ? "Checking..." : "Login"}
          </button>
        </form>

        <div className="mt-4 text-center text-sm text-slate-500">
          Ask your coach for your access code
        </div>
      </div>
    </div>
  );
}

export default function RunnerLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center">Loading...</div>}>
      <LoginForm />
    </Suspense>
  );
}