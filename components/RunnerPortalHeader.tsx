"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

type RunnerPortalHeaderProps = {
  active: "dashboard" | "upload" | "calendar";
  runnerName: string;
  schoolName: string;
  coachName: string;
};

const navItems = [
  { key: "dashboard", href: "/runner/dashboard", label: "Analytics" },
  { key: "upload", href: "/runner/upload", label: "Upload" },
  { key: "calendar", href: "/runner/calendar", label: "Calendar" },
] as const;

export default function RunnerPortalHeader({
  active,
  runnerName,
  schoolName,
  coachName,
}: RunnerPortalHeaderProps) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/runner-session", { method: "DELETE" });
    router.push("/runner/login");
  }

  return (
    <header className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
      <div className="mx-auto flex max-w-5xl flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <img src="/logo.png" alt="Hersemita" className="h-10 w-10 object-contain" />
            <div className="min-w-0">
              <h1 className="brand-wordmark text-2xl font-bold">Hersemita</h1>
              <p className="truncate text-sm font-semibold text-slate-900">{runnerName}</p>
              <p className="truncate text-xs text-slate-500">
                {schoolName} | Coach {coachName}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => router.back()}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
            >
              Back
            </button>
            <button type="button" onClick={logout} className="text-sm font-semibold text-slate-600 hover:text-red-500">
              Logout
            </button>
          </div>
        </div>

        <nav className="grid grid-cols-3 gap-2 rounded-xl bg-slate-100 p-1">
          {navItems.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className={`rounded-lg px-3 py-2 text-center text-sm font-bold transition ${
                active === item.key ? "bg-white text-slate-950 shadow-sm" : "text-slate-600 hover:text-slate-950"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
