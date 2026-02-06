import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
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
      <header className="bg-white border-b px-8 py-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-900">Hersemita</h1>
        <div className="flex gap-4 items-center">
          <Link href="/dashboard" className="text-blue-600 hover:underline">Dashboard</Link>
          <Link href="/runners" className="text-blue-600 hover:underline">Runners</Link>
        </div>
      </header>

      <main className="p-8">
        <div className="max-w-3xl mx-auto">
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <h1 className="text-2xl font-bold mb-2">Message Parents</h1>
            <p className="text-slate-600 mb-6">
              {runnersWithPhone.length} of {runners?.length || 0} runners have parent phone numbers
            </p>
            
            <form action={sendMessage} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Message Type</label>
                <select name="type" className="w-full px-3 py-2 border rounded-md">
                  <option value="general">General Update</option>
                  <option value="schedule">Schedule Change</option>
                  <option value="weekly">Weekly Report</option>
                  <option value="meet">Meet Day Info</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Select Runners</label>
                <div className="border rounded-md max-h-64 overflow-y-auto">
                  <div className="sticky top-0 bg-slate-100 px-4 py-2 border-b flex items-center gap-2">
                    <input 
                      type="checkbox" 
                      id="select-all"
                      className="rounded select-all-checkbox"
                    />
                    <label htmlFor="select-all" className="text-sm font-medium cursor-pointer">Select All</label>
                  </div>
                  
                  {runnersWithPhone.map((runner) => (
                    <div key={runner.id} className="px-4 py-2 border-b last:border-b-0 hover:bg-slate-50 flex items-center gap-3">
                      <input 
                        type="checkbox" 
                        name="runners" 
                        value={runner.id}
                        id={`runner-${runner.id}`}
                        className="rounded runner-checkbox"
                        defaultChecked
                      />
                      <label htmlFor={`runner-${runner.id}`} className="flex-1 cursor-pointer">
                        <span className="font-medium">{runner.last_name}, {runner.first_name}</span>
                        <span className="text-slate-500 text-sm ml-2">Grade {runner.grade}</span>
                      </label>
                    </div>
                  ))}
                  
                  {runnersWithoutPhone.length > 0 && (
                    <div className="px-4 py-2 bg-slate-50">
                      <p className="text-xs text-slate-500 font-medium mb-2">No parent phone on file:</p>
                      {runnersWithoutPhone.map((runner) => (
                        <div key={runner.id} className="py-1 text-sm text-slate-400 flex items-center gap-2">
                          <input type="checkbox" disabled className="rounded opacity-50" />
                          {runner.last_name}, {runner.first_name} (Grade {runner.grade})
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Message</label>
                <textarea 
                  name="message" 
                  required 
                  maxLength={320}
                  placeholder="Practice moved to 4pm today due to weather..."
                  className="w-full p-3 border rounded-md h-32"
                />
                <p className="text-xs text-slate-500 mt-1">320 character limit for SMS</p>
              </div>
              
              <div className="flex gap-3">
                <button 
                  type="submit" 
                  className="flex-1 bg-blue-600 text-white py-3 rounded-md hover:bg-blue-700 font-semibold"
                >
                  Send to Selected Parents
                </button>
                <Link 
                  href="/dashboard" 
                  className="px-6 py-3 border rounded-md hover:bg-slate-50 font-semibold"
                >
                  Cancel
                </Link>
              </div>
            </form>
            
            <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
              <p className="text-sm text-yellow-800">
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