import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Image from "next/image";
import Link from "next/link";

export default async function RunnersPage() {
  const { userId } = await auth();
  if (!userId) redirect("/");

  const { data: coach } = await supabase
    .from("coaches")
    .select("id")
    .eq("email", userId)
    .single();

  const { data: runners } = await supabase
    .from("runners")
    .select("*")
    .eq("coach_id", coach?.id)
    .order("last_name", { ascending: true });

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg overflow-hidden bg-white">
            <Image src="/logo.png" alt="Hersemita" width={40} height={40} className="w-full h-full object-contain" />
          </div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-[#00ff67] to-[#00a7ff] bg-clip-text text-transparent">
            Hersemita
          </h1>
        </div>
        <div className="flex gap-4 items-center">
          <Link href="/dashboard" className="text-slate-600 hover:text-[#00a7ff] transition-colors font-medium">Dashboard</Link>
          <Link href="/runners/new" className="bg-gradient-to-r from-[#00ff67] to-[#00a7ff] text-white px-4 py-2 rounded-lg hover:shadow-lg hover:shadow-[#00a7ff]/20 transition-all font-semibold">
            + Add Runner
          </Link>
        </div>
      </header>

      <main className="p-8 max-w-6xl mx-auto">
        <h2 className="text-3xl font-bold text-slate-900 mb-8">My Runners</h2>
        
        {runners && runners.length > 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-slate-900">Name</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-slate-900">Grade</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-slate-900">Parent Phone</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-slate-900">Access Code</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-slate-900">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {runners.map((runner) => (
                  <tr key={runner.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-900">{runner.first_name} {runner.last_name}</td>
                    <td className="px-6 py-4 text-slate-600">{runner.grade}th</td>
                    <td className="px-6 py-4 text-slate-600">{runner.parent_phone || "-"}</td>
                    <td className="px-6 py-4">
                      <span className="font-mono text-sm font-bold bg-slate-100 px-3 py-1 rounded-md text-slate-700">
                        {runner.access_code}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-3">
                        <Link href={`/runners/upload/${runner.id}`} className="text-[#00a7ff] hover:underline text-sm font-semibold">
                          Upload Run
                        </Link>
                        <span className="text-slate-300">|</span>
                        <Link 
                          href={`/runner/login?code=${runner.access_code}`} 
                          className="text-[#00ff67] hover:underline text-sm font-semibold"
                        >
                          Portal Link
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 text-center">
            <p className="text-slate-500 mb-4">No runners added yet.</p>
            <Link href="/runners/new" className="text-[#00a7ff] hover:underline font-semibold">Add your first runner</Link>
          </div>
        )}
      </main>
    </div>
  );
}