"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function RunnerLoginPage() {
  const searchParams = useSearchParams();
  const prefilledCode = searchParams.get("code");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const code = formData.get("code") as string;
    
    const { data: runner, error: fetchError } = await supabase
      .from("runners")
      .select("id, first_name, last_name")
      .eq("access_code", code)
      .single();
    
    if (fetchError || !runner) {
      setError("Invalid access code. Ask your coach for the correct code.");
      setLoading(false);
      return;
    }
    
    localStorage.setItem("runner_id", runner.id);
    
    await supabase
      .from("runners")
      .update({ last_login_at: new Date().toISOString() })
      .eq("id", runner.id);
    
    window.location.href = "/runner/upload";
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-lg shadow-sm border max-w-md w-full">
        <h1 className="text-2xl font-bold text-slate-900 mb-6 text-center">Hersemita Runner Portal</h1>
        
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Enter Your 6-Digit Code</label>
            <input 
              name="code" 
              type="text" 
              pattern="[0-9]{6}"
              maxLength={6}
              placeholder="123456"
              defaultValue={prefilledCode || ""}
              className="w-full px-3 py-2 border rounded-md text-center text-2xl tracking-widest" 
              required 
            />
          </div>
          
          <button type="submit" disabled={loading} className="w-full bg-green-600 text-white py-3 px-4 rounded-md hover:bg-green-700 disabled:bg-green-400 font-semibold">
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
}