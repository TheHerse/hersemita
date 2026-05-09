"use client";

import { useEffect, useSyncExternalStore } from "react";

type Theme = "dark" | "light";
const themeEvent = "hersemita-theme-change";

function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  return window.localStorage.getItem("hersemita-theme") === "light" ? "light" : "dark";
}

function subscribeTheme(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(themeEvent, callback);

  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(themeEvent, callback);
  };
}

export default function ThemeToggle() {
  const theme = useSyncExternalStore(subscribeTheme, getStoredTheme, () => "dark");

  useEffect(() => {
    document.documentElement.classList.toggle("light", theme === "light");
    document.documentElement.classList.toggle("dark", theme === "dark");
    window.localStorage.setItem("hersemita-theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    const nextTheme: Theme = theme === "dark" ? "light" : "dark";
    window.localStorage.setItem("hersemita-theme", nextTheme);
    window.dispatchEvent(new Event(themeEvent));
  };

  return (
    <button
      type="button"
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      onClick={toggleTheme}
      suppressHydrationWarning
      className="theme-toggle fixed bottom-4 right-4 z-[60] flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-[#101b2e]/90 text-white shadow-xl shadow-black/25 backdrop-blur transition hover:border-[#00a7ff]/60 hover:shadow-[#00a7ff]/20 sm:bottom-5 sm:right-5"
    >
      {theme === "dark" ? (
        <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v2m0 14v2m9-9h-2M5 12H3m15.364-6.364-1.414 1.414M7.05 16.95l-1.414 1.414m12.728 0-1.414-1.414M7.05 7.05 5.636 5.636M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" />
        </svg>
      ) : (
        <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}
