import Link from "next/link";

export default function TermsOfService() {
  return (
    <div className="min-h-screen hersemita-page-bg py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-slate-800 rounded-lg border border-slate-700 p-8 shadow-xl">
        <div className="mb-6 p-4 bg-slate-900 rounded border border-slate-700">
            <p className="text-sm text-slate-400">
                These Terms of Service constitute an agreement between you and Herson Hernandez DBA Hersemita.
            </p>
        </div>
        <h1 className="text-3xl font-bold text-slate-50 mb-8">Terms of Service</h1>
        
        <div className="space-y-6 text-slate-300 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-slate-100 mb-3">Service Description</h2>
            <p>Hersemita provides a cross country coaching platform for tracking athlete training data and communicating with parents via SMS notifications.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-100 mb-3">User Responsibilities</h2>
            <p>Coaches are responsible for obtaining consent from parents/guardians before adding phone numbers to the system. All users must comply with FERPA regulations regarding student data.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-100 mb-3">SMS Communication</h2>
            <div className="space-y-3">
              <p>
                Program name: Hersemita. By providing your mobile phone number to your coach and agreeing to receive Hersemita SMS updates, you consent to receive manual SMS messages regarding practices, meets, runner check-ins, team updates, training reminders, and weekly performance summaries.
              </p>
              <p>
                <strong className="text-slate-100">Message and data rates may apply.</strong> Message frequency varies based on coach discretion, typically 1-5 messages per week.
              </p>
              <p>
                To opt out at any time, reply <strong className="text-slate-100">STOP</strong>. For assistance, reply <strong className="text-slate-100">HELP</strong> or contact support@hersemita.com.
              </p>
              <p>
                Review the{" "}
                <Link href="/sms-consent" className="text-[#7dd3fc] underline">
                  Hersemita SMS Consent Notice
                </Link>
                .
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-100 mb-3">Limitations</h2>
            <p>Hersemita is not responsible for carrier delays or failed message delivery. Service availability depends on third-party integrations (Garmin, Twilio).</p>
          </section>

          <p className="text-sm text-slate-500 mt-8 pt-8 border-t border-slate-700">Last updated: July 2026</p>
        </div>
      </div>
    </div>
  );
}
