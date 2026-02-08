import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 text-white flex flex-col items-center justify-center p-4">
      <div className="max-w-2xl text-center space-y-6">
        <h1 className="text-5xl font-bold tracking-tight">Hersemita</h1>
        <p className="text-xl text-slate-300">
          Automatic Garmin tracking for cross country coaches. 
          Verify long runs, monitor progress, and communicate with parents—all in one place.
        </p>
        <div className="flex gap-4 justify-center pt-4">
          <Link href="/sign-in">
            <button className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg text-lg transition-colors">
              Coach Login
            </button>
          </Link>
        </div>
      </div>
    </main>
  );
}