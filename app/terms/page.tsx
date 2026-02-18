export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-slate-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-slate-800 rounded-lg border border-slate-700 p-8 shadow-xl">
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
            <p>By providing a phone number, users consent to receive training verification notifications. Standard message and data rates may apply.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-100 mb-3">Limitations</h2>
            <p>Hersemita is not responsible for carrier delays or failed message delivery. Service availability depends on third-party integrations (Garmin, Twilio).</p>
          </section>

          <p className="text-sm text-slate-500 mt-8 pt-8 border-t border-slate-700">Last updated: February 2026</p>
        </div>
      </div>
    </div>
  );
}