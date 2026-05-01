import Link from "next/link";

export default function RunnerUploadSuccessPage() {
  return (
    <div className="min-h-screen hersemita-auth-bg text-slate-50 flex items-center justify-center px-4">
      <main className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center shadow-2xl">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#00ff67] to-[#00a7ff]">
          <svg className="h-7 w-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold">Run Submitted</h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          Your coach can now review the details and open the attached screenshot proof if anything needs to be checked.
        </p>
        <div className="mt-7 grid gap-3">
          <Link
            href="/runner/upload"
            className="rounded-xl bg-gradient-to-r from-[#00ff67] to-[#00a7ff] px-4 py-3 font-bold text-white transition hover:shadow-lg hover:shadow-[#00a7ff]/20"
          >
            Upload Another Run
          </Link>
          <Link
            href="/"
            className="rounded-xl border border-slate-700 px-4 py-3 font-semibold text-slate-200 transition hover:border-[#00a7ff] hover:text-white"
          >
            Back to Hersemita
          </Link>
        </div>
      </main>
    </div>
  );
}
