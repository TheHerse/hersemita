import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Image from "next/image";
import Link from "next/link";

async function sendMessage(formData: FormData) {
  "use server";
  
  const { userId } = await auth();
  if (!userId) redirect("/");
  
  const { data: coach } = await supabase
    .from("coaches")
    .select("id, name")
    .eq("email", userId)
    .single();
  
  const message = formData.get("message") as string;
  const messageType = formData.get("type") as string;
  const selectedRunners = formData.getAll("runners") as string[];
  
  const { data: runners } = await supabase
    .from("runners")
    .select("first_name, last_name, parent_phone")
    .eq("coach_id", coach?.id)
    .in("id", selectedRunners)
    .not("parent_phone", "is", null);
  
  const phones = runners?.map(r => r.parent_phone!).filter(Boolean) || [];
  const runnerNames = runners?.map(r => `${r.first_name} ${r.last_name}`) || [];
  
  console.log(`📱 ${messageType.toUpperCase()} MESSAGE to ${phones.length} parents:`);
  console.log(`Runners: ${runnerNames.join(", ")}`);
  console.log(`From: Coach ${coach?.name}`);
  console.log(`Message: ${message}`);
  
  redirect("/runners/message?sent=1");
}

export default async function MessageParentsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/");

  const { data: coach } = await supabase
    .from("coaches")
    .select("id, name")
    .eq("email", userId)
    .single();

  const { data: runners } = await supabase
    .from("runners")
    .select("id, first_name, last_name, grade, parent_phone")
    .eq("coach_id", coach?.id)
    .order("last_name", { ascending: true });

  const runnersWithPhone = runners?.filter(r => r.parent_phone) || [];
  const runnersWithoutPhone = runners?.filter(r => !r.parent_phone) || [];

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
          <Link href="/runners" className="text-slate-600 hover:text-[#00a7ff] transition-colors font-medium">Runners</Link>
        </div>
      </header>

      <main className="p-8">
        <div className="max-w-3xl mx-auto">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-[#00a7ff]/10 flex items-center justify-center">
                <svg className="w-4 h-4 text-[#00a7ff]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-slate-900">Message Parents</h1>
            </div>
            <p className="text-slate-600 mb-6 ml-11">
              {runnersWithPhone.length} of {runners?.length || 0} runners have parent phone numbers
            </p>
            
            <form action={sendMessage} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Message Type</label>
                <select name="type" className="w-full px-4 py-2 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-[#00a7ff] transition-colors bg-white">
                  <option value="general">General Update</option>
                  <option value="schedule">Schedule Change</option>
                  <option value="weekly">Weekly Report</option>
                  <option value="meet">Meet Day Info</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Select Runners</label>
                <div className="border-2 border-slate-200 rounded-xl max-h-64 overflow-y-auto">
                  <div className="sticky top-0 bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center gap-2">
                    <input 
                      type="checkbox" 
                      id="select-all"
                      className="rounded border-slate-300 text-[#00a7ff] focus:ring-[#00a7ff] select-all-checkbox w-4 h-4"
                    />
                    <label htmlFor="select-all" className="text-sm font-semibold text-slate-700 cursor-pointer">Select All</label>
                  </div>
                  
                  {runnersWithPhone.map((runner) => (
                    <div key={runner.id} className="px-4 py-3 border-b border-slate-100 last:border-b-0 hover:bg-slate-50 flex items-center gap-3 transition-colors">
                      <input 
                        type="checkbox" 
                        name="runners" 
                        value={runner.id}
                        id={`runner-${runner.id}`}
                        className="rounded border-slate-300 text-[#00a7ff] focus:ring-[#00a7ff] runner-checkbox w-4 h-4"
                        defaultChecked
                      />
                      <label htmlFor={`runner-${runner.id}`} className="flex-1 cursor-pointer">
                        <span className="font-medium text-slate-900">{runner.last_name}, {runner.first_name}</span>
                        <span className="text-slate-500 text-sm ml-2">Grade {runner.grade}</span>
                      </label>
                    </div>
                  ))}
                  
                  {runnersWithoutPhone.length > 0 && (
                    <div className="px-4 py-3 bg-slate-50 border-t border-slate-200">
                      <p className="text-xs text-slate-500 font-semibold mb-2">No parent phone on file:</p>
                      {runnersWithoutPhone.map((runner) => (
                        <div key={runner.id} className="py-1 text-sm text-slate-400 flex items-center gap-2">
                          <input type="checkbox" disabled className="rounded opacity-50 w-4 h-4" />
                          {runner.last_name}, {runner.first_name} (Grade {runner.grade})
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Message</label>
                <textarea 
                  name="message" 
                  required 
                  maxLength={320}
                  placeholder="Practice moved to 4pm today due to weather..."
                  className="w-full p-4 border-2 border-slate-200 rounded-lg h-32 focus:outline-none focus:border-[#00a7ff] transition-colors resize-none"
                />
                <p className="text-xs text-slate-500 mt-1">320 character limit for SMS</p>
              </div>
              
              <div className="flex gap-3">
                <button 
                  type="submit" 
                  className="flex-1 bg-gradient-to-r from-[#00ff67] to-[#00a7ff] text-white py-3 rounded-lg hover:shadow-lg hover:shadow-[#00a7ff]/25 transition-all font-bold"
                >
                  Send to Selected Parents
                </button>
                <Link 
                  href="/dashboard" 
                  className="px-6 py-3 border-2 border-slate-200 rounded-lg hover:bg-slate-50 font-semibold text-slate-700 transition-colors"
                >
                  Cancel
                </Link>
              </div>
            </form>
            
            <div className="mt-6 p-4 bg-orange-50 border border-orange-200 rounded-lg">
              <p className="text-sm text-orange-800 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <b>Note:</b> SMS integration not yet enabled. Messages will be logged to console for testing.
              </p>
            </div>
          </div>
        </div>
      </main>
      
      <script dangerouslySetInnerHTML={{ __html: `
        document.getElementById('select-all').addEventListener('change', function() {
          document.querySelectorAll('.runner-checkbox').forEach(cb => cb.checked = this.checked);
        });
      `}} />
    </div>
  );
}