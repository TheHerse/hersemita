import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Image from "next/image";
import Link from "next/link";

export default async function NewRunnerPage() {
  const { userId } = await auth();
  
  if (!userId) {
    redirect("/");
  }

  async function addRunner(formData: FormData) {
    "use server";
    
    const { userId } = await auth();
    if (!userId) redirect("/");
    
    const firstName = formData.get("firstName") as string;
    const lastName = formData.get("lastName") as string;
    const grade = parseInt(formData.get("grade") as string);
    const parentPhone = formData.get("parentPhone") as string;
    
    const accessCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    let { data: coach, error: coachError } = await supabase
      .from("coaches")
      .select("id")
      .eq("email", userId)
      .single();
    
    if (coachError && coachError.code !== 'PGRST116') {
      console.error("Error finding coach:", coachError);
    }
    
    if (!coach) {
      const { data: newCoach, error: createError } = await supabase
        .from("coaches")
        .insert({ email: userId, name: "Coach" })
        .select()
        .single();
      
      if (createError) {
        console.error("Error creating coach:", createError);
        return;
      }
      coach = newCoach;
    }
    
    if (!coach?.id) {
      console.error("Failed to get or create coach");
      return;
    }
    
    const { error: runnerError } = await supabase
      .from("runners")
      .insert({
        coach_id: coach.id,
        first_name: firstName,
        last_name: lastName,
        grade,
        parent_phone: parentPhone,
        access_code: accessCode,
      });
    
    if (runnerError) {
      console.error("Error adding runner:", runnerError);
      return;
    }
    
    redirect("/runners");
  }

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
        <Link href="/dashboard" className="text-slate-600 hover:text-[#00a7ff] transition-colors font-medium">Back to Dashboard</Link>
      </header>

      <main className="p-8 max-w-2xl mx-auto">
        <h2 className="text-3xl font-bold text-slate-900 mb-8">Add New Runner</h2>
        
        <form action={addRunner} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-6">
            <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">First Name</label>
                <input name="firstName" type="text" required className="w-full px-4 py-2 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-[#00a7ff] transition-colors" />
            </div>
            
            <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Last Name</label>
                <input name="lastName" type="text" required className="w-full px-4 py-2 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-[#00a7ff] transition-colors" />
            </div>
            
            <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Grade</label>
                <select name="grade" required className="w-full px-4 py-2 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-[#00a7ff] transition-colors bg-white">
                    <option value="9">9th</option>
                    <option value="10">10th</option>
                    <option value="11">11th</option>
                    <option value="12">12th</option>
                </select>
            </div>
          
            <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Parent Phone Number</label>
                <input 
                    name="parentPhone" 
                    type="tel" 
                    placeholder="(555) 123-4567" 
                    className="w-full px-4 py-2 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-[#00a7ff] transition-colors" 
                />
                <p className="text-xs text-slate-500 mt-1">For SMS updates about run verification</p>
            </div>
          
            <button type="submit" className="w-full bg-gradient-to-r from-[#00ff67] to-[#00a7ff] text-white py-3 rounded-lg hover:shadow-lg hover:shadow-[#00a7ff]/25 transition-all font-bold text-lg">
              Add Runner
            </button>
        </form>
      </main>
    </div>
  );
}