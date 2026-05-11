"use client";

import Image from "next/image";
import Link from "next/link";
import CoachMobileMenu from "@/components/CoachMobileMenu";
import CoachUserButton from "@/components/CoachUserButton";

type CoachNavKey = "dashboard" | "runners" | "groups" | "calendar" | "analytics" | "message" | "activities";

const navLinks: Array<{ key: CoachNavKey; href: string; label: string }> = [
  { key: "dashboard", href: "/dashboard", label: "Dashboard" },
  { key: "runners", href: "/runners", label: "Runners" },
  { key: "groups", href: "/groups", label: "Groups" },
  { key: "calendar", href: "/calendar", label: "Calendar" },
  { key: "analytics", href: "/analytics", label: "Analytics" },
  { key: "message", href: "/runners/message", label: "Message" },
  { key: "activities", href: "/activities", label: "Activities" },
];

export default function CoachHeader({ active }: { active?: CoachNavKey }) {
  return (
    <header className="app-shell-header sticky top-0 z-50 border-b px-4 py-3 sm:px-6 sm:py-4">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="h-10 w-10 overflow-hidden rounded-2xl">
            <Image src="/logo.png" alt="Hersemita" width={40} height={40} className="h-full w-full object-contain" />
          </div>
          <h1 className="brand-wordmark text-2xl font-bold">Hersemita</h1>
        </Link>

        <div className="hidden items-center gap-3 sm:flex">
          <nav className="nav-rail flex items-center gap-1 rounded-full p-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active === link.key ? "page" : undefined}
                className={`nav-link-modern shrink-0 ${active === link.key ? "nav-link-active" : ""}`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <CoachUserButton />
        </div>

        <CoachMobileMenu
          showUserButton
          links={navLinks.map((link) => ({
            href: link.href,
            label: link.key === "message" ? "Message Parents" : link.label,
            active: active === link.key,
          }))}
        />
      </div>
    </header>
  );
}
