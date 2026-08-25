import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { checkRateLimit, rateLimitKey } from "@/lib/rate-limit";
import { getPrivacyRequestSubjects } from "@/lib/privacy-request-access";
import { supabaseAdmin } from "@/lib/supabase-admin";

const REQUEST_TYPES = new Set(["access", "export", "correction", "deletion", "restriction"]);

async function submitPrivacyRequest(formData: FormData) {
  "use server";
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const subjects = await getPrivacyRequestSubjects(userId);
  const runnerId = String(formData.get("runnerId") || "");
  const subject = subjects.find((runner) => runner.id === runnerId);
  const requestType = String(formData.get("requestType") || "");
  const details = String(formData.get("details") || "").trim();
  if (!subject || !REQUEST_TYPES.has(requestType) || details.length > 4000) {
    redirect("/privacy/requests?error=Invalid%20privacy%20request.");
  }

  const limit = await checkRateLimit({
    key: rateLimitKey(["privacy-request", userId]),
    windowMs: 24 * 60 * 60 * 1000,
    max: 10,
  });
  if (limit.limited) redirect("/privacy/requests?error=Too%20many%20requests.%20Contact%20support%20if%20this%20is%20urgent.");

  const { error } = await supabaseAdmin.rpc("submit_privacy_request", {
    p_runner_id: subject.id,
    p_team_id: subject.teamId,
    p_requester_clerk_id: userId,
    p_requester_role: subject.role,
    p_request_type: requestType,
    p_details: details,
  });
  if (error) redirect("/privacy/requests?error=Privacy%20request%20storage%20is%20not%20ready.");
  redirect("/privacy/requests?submitted=1");
}

export default async function PrivacyRequestsPage({
  searchParams,
}: {
  searchParams?: Promise<{ submitted?: string; error?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const [subjects, query] = await Promise.all([getPrivacyRequestSubjects(userId), searchParams]);
  const { data: requests } = await supabaseAdmin
    .from("privacy_requests")
    .select("id, runner_id, request_type, status, submitted_at, due_at")
    .eq("requester_clerk_id", userId)
    .order("submitted_at", { ascending: false })
    .limit(50);
  const names = new Map(subjects.map((runner) => [runner.id, runner.name]));

  return (
    <main className="mx-auto min-h-screen max-w-3xl space-y-6 bg-slate-950 p-4 text-white sm:p-8">
      <div>
        <Link href="/privacy" className="text-sm font-bold text-sky-300">Back to privacy policy</Link>
        <h1 className="mt-3 text-3xl font-black">Privacy requests</h1>
        <p className="mt-2 text-slate-300">Request access, an export, a correction, restriction, or deletion for an account you are authorized to manage.</p>
      </div>
      {query?.submitted && <p className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-4">Request submitted and recorded.</p>}
      {query?.error && <p className="rounded-xl border border-red-400/30 bg-red-500/10 p-4">{query.error}</p>}

      <form action={submitPrivacyRequest} className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-5">
        <label className="block"><span className="mb-2 block font-bold">Runner</span>
          <select name="runnerId" required className="w-full rounded-lg bg-slate-900 p-3">
            <option value="">Select a runner</option>
            {subjects.map((runner) => <option key={runner.id} value={runner.id}>{runner.name}</option>)}
          </select>
        </label>
        <label className="block"><span className="mb-2 block font-bold">Request</span>
          <select name="requestType" required className="w-full rounded-lg bg-slate-900 p-3">
            <option value="access">Access my information</option><option value="export">Export a copy</option>
            <option value="correction">Correct information</option><option value="restriction">Restrict processing</option>
            <option value="deletion">Delete information</option>
          </select>
        </label>
        <label className="block"><span className="mb-2 block font-bold">Details</span>
          <textarea name="details" maxLength={4000} rows={5} className="w-full rounded-lg bg-slate-900 p-3" placeholder="Describe the records or correction requested." />
        </label>
        <button disabled={subjects.length === 0} className="rounded-lg bg-sky-500 px-5 py-3 font-black text-slate-950 disabled:opacity-50">Submit request</button>
      </form>

      <section className="space-y-3"><h2 className="text-xl font-black">Your requests</h2>
        {(requests || []).length === 0 ? <p className="text-slate-400">No requests submitted.</p> : (requests || []).map((request) => (
          <article key={request.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="font-bold">{names.get(request.runner_id) || "Authorized runner"} — {request.request_type}</p>
            <p className="mt-1 text-sm text-slate-300">Status: {request.status} · Submitted {new Date(request.submitted_at).toLocaleDateString("en-US")}</p>
            {request.runner_id && (request.request_type === "access" || request.request_type === "export") && (
              <a href={`/api/privacy/export/${request.runner_id}`} className="mt-3 inline-block text-sm font-bold text-sky-300 underline">Download current data export</a>
            )}
          </article>
        ))}
      </section>
    </main>
  );
}
