"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Image from "next/image";

function LoginForm() {
  const searchParams = useSearchParams();
  const [code, setCode] = useState(searchParams.get("code") || "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
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
    <div className="min-h-screen hersemita-auth-bg flex items-center justify-center p-4 relative overflow-hidden">
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
          <h1 className="text-3xl font-bold bg-gradient-to-r from-[#00ff67] to-[#00a7ff] bg-clip-text text-transparent">
            Runner Portal
          </h1>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Enter your 6-digit access code
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              maxLength={6}
              className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-center text-2xl tracking-[0.5em] font-bold text-slate-800 focus:outline-none focus:border-[#00a7ff] focus:ring-4 focus:ring-[#00a7ff]/10 transition-all"
              placeholder="000000"
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
          Ask your coach for your access code
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
