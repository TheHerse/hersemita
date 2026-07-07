import Link from "next/link";

export default function SmsConsentPage() {
  return (
    <div className="min-h-screen hersemita-page-bg px-4 py-12 sm:px-6 lg:px-8">
      <main className="mx-auto max-w-3xl rounded-lg border border-slate-700 bg-slate-800 p-8 text-slate-300 shadow-xl">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-[#00a7ff]">
          Hersemita SMS Consent
        </p>
        <h1 className="mb-6 text-3xl font-bold text-slate-50">SMS Consent Notice</h1>

        <div className="space-y-6 leading-relaxed">
          <section>
            <h2 className="mb-3 text-xl font-semibold text-slate-100">Program Description</h2>
            <p>
              Hersemita allows cross country and track coaches to send manual SMS updates to parents and
              guardians of runners on their team. Messages may include practice updates, meet information,
              runner check-in updates, training reminders, and team announcements.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-slate-100">How Parents and Guardians Opt In</h2>
            <p>
              Parents and guardians opt in by providing their mobile phone number to their child&apos;s coach
              during team registration, roster setup, or direct coach communication, and by agreeing to receive
              SMS updates through Hersemita. Coaches enter a parent or guardian phone number into Hersemita
              only after receiving this consent.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-slate-100">Message Details</h2>
            <ul className="list-disc space-y-2 pl-5">
              <li>Program name: Hersemita</li>
              <li>Message frequency varies based on coach discretion and team activity.</li>
              <li>Message and data rates may apply.</li>
              <li>Reply <strong className="text-slate-50">STOP</strong> to opt out.</li>
              <li>Reply <strong className="text-slate-50">HELP</strong> for help.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-slate-100">Privacy</h2>
            <p>
              Hersemita uses parent and guardian phone numbers only to provide team, practice, meet, runner
              check-in, and training-related updates. Phone numbers are not sold or shared with third parties
              for marketing purposes.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-slate-100">Support</h2>
            <p>
              For assistance, reply <strong className="text-slate-50">HELP</strong> or contact{" "}
              <a className="text-[#7dd3fc] underline" href="mailto:support@hersemita.com">
                support@hersemita.com
              </a>
              .
            </p>
          </section>

          <div className="border-t border-slate-700 pt-6 text-sm text-slate-400">
            <p>
              Review the Hersemita{" "}
              <Link className="text-[#7dd3fc] underline" href="/privacy">
                Privacy Policy
              </Link>{" "}
              and{" "}
              <Link className="text-[#7dd3fc] underline" href="/terms">
                Terms of Service
              </Link>
              .
            </p>
            <p className="mt-3">Last updated: July 2026</p>
          </div>
        </div>
      </main>
    </div>
  );
}
