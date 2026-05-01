"use client";

import Link from "next/link";
import { useState } from "react";
import { UserButton } from "@clerk/nextjs";

type CoachNavLink = {
  href: string;
  label: string;
};

export default function CoachMobileMenu({
  links,
  showUserButton = false,
}: {
  links: CoachNavLink[];
  showUserButton?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative sm:hidden">
      <button
        type="button"
        aria-label="Open navigation menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-500 bg-[#0f172a] text-white shadow-sm transition hover:border-[#00a7ff] hover:bg-[#111827]"
      >
        <span className="flex flex-col gap-1.5">
          <span className="block h-0.5 w-5 rounded bg-[#f8fafc]" />
          <span className="block h-0.5 w-5 rounded bg-[#f8fafc]" />
          <span className="block h-0.5 w-5 rounded bg-[#f8fafc]" />
        </span>
      </button>

      {open && (
        <div
          className="absolute right-0 top-12 z-50 w-56 overflow-hidden rounded-xl border border-[#334155] shadow-2xl shadow-black/60"
          style={{ backgroundColor: "#0f172a" }}
        >
          <nav className="p-2" style={{ backgroundColor: "#0f172a" }}>
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="block rounded-lg px-4 py-3 text-sm font-bold text-white transition hover:bg-[#1e293b]"
                style={{ backgroundColor: "#0f172a" }}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          {showUserButton && (
            <div className="border-t border-[#334155] px-4 py-3" style={{ backgroundColor: "#0f172a" }}>
              <UserButton afterSignOutUrl="/" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
