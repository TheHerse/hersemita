"use client";

import { UserButton } from "@clerk/nextjs";
import Image from "next/image";
import Link from "next/link";

export default function ParentHeader() {
  return (
    <header className="app-shell-header sticky top-0 z-50 border-b px-4 py-3 sm:px-6 sm:py-4">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
        <Link href="/parent/dashboard" className="flex items-center gap-3">
          <div className="h-10 w-10 overflow-hidden rounded-2xl">
            <Image src="/logo.png" alt="Hersemita" width={40} height={40} className="h-full w-full object-contain" />
          </div>
          <div>
            <p className="brand-wordmark text-2xl font-bold leading-none">Hersemita</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Parent Portal</p>
          </div>
        </Link>

        <UserButton afterSignOutUrl="/parent/sign-in" />
      </div>
    </header>
  );
}
