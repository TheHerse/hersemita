import { SignUp } from '@clerk/nextjs';

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center hersemita-auth-bg p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-slate-50 mb-2">Join Hersemita</h1>
          <p className="text-slate-400">Create your coach account</p>
        </div>
        
        <SignUp 
          forceRedirectUrl="/dashboard"
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
