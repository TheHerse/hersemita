import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";

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
      <header className="bg-white border-b px-8 py-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-900">Hersemita</h1>
        <div className="flex gap-4">
          <a href="/dashboard" className="text-blue-600 hover:underline">Dashboard</a>
          <a href="/runners/new" className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">Add Runner</a>
        </div>
      </header>

      <main className="p-8 max-w-6xl mx-auto">
        <h2 className="text-3xl font-bold text-slate-900 mb-8">My Runners</h2>
        
        {runners && runners.length > 0 ? (
          <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="text-left px-6 py-3 text-sm font-semibold text-slate-900">Name</th>
                  <th className="text-left px-6 py-3 text-sm font-semibold text-slate-900">Grade</th>
                  <th className="text-left px-6 py-3 text-sm font-semibold text-slate-900">Parent Phone</th>
                  <th className="text-left px-6 py-3 text-sm font-semibold text-slate-900">Access Code</th>
                  <th className="text-left px-6 py-3 text-sm font-semibold text-slate-900">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {runners.map((runner) => (
                  <tr key={runner.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-medium">{runner.first_name} {runner.last_name}</td>
                    <td className="px-6 py-4">{runner.grade}th</td>
                    <td className="px-6 py-4 text-slate-600">{runner.parent_phone || "-"}</td>
                    <td className="px-6 py-4 font-mono text-sm font-bold bg-gray-50">{runner.access_code}</td>
                    <td className="px-6 py-4">
                      <div className="flex gap-3">
                        <a href={`/runners/upload/${runner.id}`} className="text-blue-600 hover:underline text-sm font-medium">
                          Upload Run
                        </a>
                        <span className="text-slate-400">|</span>
                        <a 
                          href={`/runner/login?code=${runner.access_code}`} 
                          className="text-green-600 hover:underline text-sm font-medium"
                        >
                          Portal Link
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-white p-8 rounded-lg shadow-sm border text-center">
            <p className="text-slate-500 mb-4">No runners added yet.</p>
            <a href="/runners/new" className="text-blue-600 hover:underline font-semibold">Add your first runner</a>
          </div>
        )}
      </main>
    </div>
  );
}