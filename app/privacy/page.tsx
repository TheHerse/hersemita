import Link from "next/link";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen hersemita-page-bg py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6 p-4 bg-slate-800 rounded border border-slate-700">
          <p className="text-sm text-slate-400">
            This Privacy Policy applies to Hersemita, a sole proprietorship owned by Herson Hernandez.
          </p>
        </div>
        
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-8 shadow-xl">
          <h1 className="text-3xl font-bold text-slate-50 mb-8">Privacy Policy</h1>
          
          <div className="space-y-6 text-slate-300 leading-relaxed">
            <section>
              <h2 className="text-xl font-semibold text-slate-100 mb-3">Information We Collect</h2>
              <p>Hersemita collects phone numbers and athlete training data solely to provide workout verification, team, practice, meet, runner check-in, and training-related updates to parents and guardians of cross country and track athletes.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-slate-100 mb-3">How We Use Your Information</h2>
              <ul className="list-disc pl-5 space-y-2">
                <li>SMS notifications for workout verification</li>
                <li>Training progress updates</li>
                <li>Important coaching announcements</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-slate-100 mb-3">Data Protection</h2>
              <p>We maintain confidential student and team records. Phone numbers are not sold, shared with third parties for marketing, or used for unrelated marketing purposes.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-slate-100 mb-3">SMS Terms</h2>
              <p>Parents and guardians opt in by providing their mobile phone number to their child&apos;s coach and agreeing to receive Hersemita SMS updates. Message frequency varies. Message and data rates may apply. Reply STOP to opt out at any time. Reply HELP for assistance.</p>
              <p className="mt-3">
                View the full{" "}
                <Link href="/sms-consent" className="text-[#7dd3fc] underline">
                  Hersemita SMS Consent Notice
                </Link>
                .
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-slate-100 mb-3">Your Privacy Choices</h2>
              <p>Authorized parents or guardians, adult runners, and coaches may request access, export, correction, restriction, or deletion through the secured request portal.</p>
              <p className="mt-3"><Link href="/privacy/requests" className="text-[#7dd3fc] underline">Open the privacy request portal</Link>.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-slate-100 mb-3">Contact Us</h2>
              <p>Email: support@hersemita.com</p>
              <p>Location: Clarksville, TN</p>
            </section>

            <p className="text-sm text-slate-500 mt-8 pt-8 border-t border-slate-700">Last updated: August 2026</p>
          </div>
        </div>
      </div>
    </div>
  );
}
