import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default async function NewRunnerPage() {
  const { userId } = await auth();
  
  if (!userId) {
    redirect("/");
  }

  async function addRunner(formData: FormData) {
    "use server";
    
    // Get auth inside the server action
    const { userId } = await auth();
    if (!userId) redirect("/");
    
    const firstName = formData.get("firstName") as string;
    const lastName = formData.get("lastName") as string;
    const grade = parseInt(formData.get("grade") as string);
    const parentPhone = formData.get("parentPhone") as string;
    
    // Generate 6-digit access code
    const accessCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Get or create coach
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
    
    // Add runner WITH access code
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
        access_code: accessCode, // <-- ADDED THIS LINE
      });
    
    if (runnerError) {
      console.error("Error adding runner:", runnerError);
      return;
    }
    
    redirect("/runners");
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b px-8 py-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-900">Hersemita</h1>
        <a href="/dashboard" className="text-blue-600 hover:underline">Back to Dashboard</a>
      </header>

      <main className="p-8 max-w-2xl mx-auto">
        <h2 className="text-3xl font-bold text-slate-900 mb-8">Add New Runner</h2>
        
        <form action={addRunner} className="bg-white p-6 rounded-lg shadow-sm border space-y-4">
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">First Name</label>
                <input name="firstName" type="text" required className="w-full px-3 py-2 border rounded-md" />
                </div>
                
                <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Last Name</label>
                <input name="lastName" type="text" required className="w-full px-3 py-2 border rounded-md" />
            </div>
            
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Grade</label>
                <select name="grade" required className="w-full px-3 py-2 border rounded-md">
                    <option value="9">9th</option>
                    <option value="10">10th</option>
                    <option value="11">11th</option>
                    <option value="12">12th</option>
                </select>
            </div>
          
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Parent Phone Number</label>
                <input 
                    name="parentPhone" 
                    type="tel" 
                    placeholder="(555) 123-4567" 
                    className="w-full px-3 py-2 border rounded-md" 
                />
                <p className="text-xs text-slate-500 mt-1">For SMS updates about run verification</p>
            </div>
          
            <button type="submit" className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 font-semibold">
            Add Runner
            </button>
        </form>
      </main>
    </div>
  );
}