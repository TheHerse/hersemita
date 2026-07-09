import { SignUp } from "@clerk/nextjs";
import Link from "next/link";

export default function ParentSignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center hersemita-auth-bg p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/" className="brand-wordmark text-3xl font-bold text-white">
            Hersemita
          </Link>
          <h1 className="mt-6 text-3xl font-bold text-slate-50">Create Parent Access</h1>
          <p className="mt-2 text-slate-400">Use the same email your coach has on file.</p>
        </div>

        <SignUp
          forceRedirectUrl="/parent/dashboard"
          signInUrl="/parent/sign-in"
          appearance={{
            elements: {
              rootBox: "mx-auto",
              card: "bg-slate-800 border-slate-700 shadow-xl",
              headerTitle: "text-slate-50",
              headerSubtitle: "text-slate-400",
              socialButtonsBlockButton: "bg-slate-700 border-slate-600 text-slate-50 hover:bg-slate-600",
              formFieldLabel: "text-slate-300",
              formFieldInput: "bg-slate-700 border-slate-600 text-slate-50 placeholder:text-slate-500",
              formButtonPrimary: "bg-blue-600 hover:bg-blue-500 text-white",
              footerActionText: "text-slate-400",
              footerActionLink: "text-blue-400 hover:text-blue-300",
            },
          }}
        />
      </div>
    </div>
  );
}
