import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import CoachMobileMenu from "@/components/CoachMobileMenu";

async function saveCoachProfile(formData: FormData) {
  "use server";

  const { userId } = await auth();
  if (!userId) redirect("/");

  const name = (formData.get("name") as string)?.trim();
  const schoolName = (formData.get("schoolName") as string)?.trim();

  if (!name) {
    redirect("/settings?error=Coach%20name%20is%20required.");
  }

  const { data: existingCoach } = await supabase
    .from("coaches")
    .select("id")
    .eq("email", userId)
    .single();

  const payload = {
    email: userId,
    name,
    school_name: schoolName || null,
  };

  const { error } = existingCoach?.id
    ? await supabase
        .from("coaches")
        .update(payload)
        .eq("id", existingCoach.id)
    : await supabase
        .from("coaches")
        .insert(payload);

  if (error) {
    redirect(`/settings?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/settings?saved=1");
}

export default async function CoachSettingsPage({
  searchParams,
}: {
  searchParams?: Promise<{ saved?: string; error?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/");

  const params = await searchParams;

  const { data: coach, error } = await supabase
    .from("coaches")
    .select("id, name, school_name")
    .eq("email", userId)
    .single();

  return (
    <div className="min-h-screen hersemita-page-bg text-white">
      <header className="border-b border-slate-200 bg-white px-4 py-3 sticky top-0 z-50 shadow-sm sm:px-6 sm:py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg overflow-hidden bg-white">
              <Image src="/logo.png" alt="Hersemita" width={40} height={40} className="w-full h-full object-contain" />
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-[#00ff67] to-[#00a7ff] bg-clip-text text-transparent">
              Hersemita
            </h1>
          </Link>

          <div className="hidden items-center gap-3 sm:flex">
            <Link href="/dashboard" className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-[#00a7ff]/60 hover:text-[#00a7ff]">
              Dashboard
            </Link>
            <Link href="/runners" className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-[#00a7ff]/60 hover:text-[#00a7ff]">
              Runners
            </Link>
            <Link href="/groups" className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-[#00a7ff]/60 hover:text-[#00a7ff]">
              Groups
            </Link>
            <Link href="/activities" className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-[#00a7ff]/60 hover:text-[#00a7ff]">
              Activities
            </Link>
          </div>

          <CoachMobileMenu
            links={[
              { href: "/dashboard", label: "Dashboard" },
              { href: "/runners", label: "Runners" },
              { href: "/groups", label: "Groups" },
              { href: "/activities", label: "Activities" },
              { href: "/runners/message", label: "Message Parents" },
            ]}
          />
        </div>
      </header>

      <main className="mx-auto max-w-2xl p-4 sm:p-6 lg:p-8">
        <div className="mb-8 rounded-2xl border border-white/10 bg-white/10 p-5 shadow-2xl shadow-black/10 backdrop-blur sm:p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#00a7ff]">Coach Settings</p>
          <h2 className="mt-2 text-3xl font-bold text-white">Team Identity</h2>
          <p className="mt-2 text-[#cbd5e1]">
            Add your coach name and school or team name so the dashboard and parent messages feel official.
          </p>
        </div>

        {(error || params?.error) && (
          <div className="mb-6 rounded-xl border border-orange-400/30 bg-orange-400/10 p-4 text-sm text-orange-100">
            {params?.error || "Coach profile fields are not set up yet. Run supabase/coach-profile-fields.sql in Supabase SQL Editor, then refresh."}
          </div>
        )}

        {params?.saved && (
          <div className="mb-6 rounded-xl border border-[#00ff67]/30 bg-[#00ff67]/10 p-4 text-sm text-green-100">
            Coach profile saved.
          </div>
        )}

        <form action={saveCoachProfile} className="space-y-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Coach Display Name</label>
            <input
              name="name"
              type="text"
              required
              defaultValue={coach?.name || ""}
              placeholder="Coach Martinez"
              className="w-full rounded-lg border-2 border-slate-200 px-4 py-3 transition-colors focus:border-[#00a7ff] focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">School or Team Name</label>
            <input
              name="schoolName"
              type="text"
              defaultValue={coach?.school_name || ""}
              placeholder="Central High Cross Country"
              className="w-full rounded-lg border-2 border-slate-200 px-4 py-3 transition-colors focus:border-[#00a7ff] focus:outline-none"
            />
          </div>

          <button type="submit" className="w-full rounded-lg bg-gradient-to-r from-[#00ff67] to-[#00a7ff] px-4 py-3 text-lg font-bold text-white transition hover:shadow-lg hover:shadow-[#00a7ff]/25">
            Save Profile
          </button>
        </form>
      </main>
    </div>
  );
}
