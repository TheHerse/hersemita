import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ClerkProvider } from '@clerk/nextjs';
import { dark } from '@clerk/themes';

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Hersemita - Cross Country Coach Dashboard",
  description: "Track your runners' progress automatically",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider
      appearance={{
        baseTheme: dark,
        variables: {
          colorPrimary: '#3b82f6',
          colorBackground: '#0f172a',
          colorText: '#f8fafc',
          colorTextSecondary: '#cbd5e1',
        },
      }}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      afterSignInUrl="/dashboard"
      afterSignUpUrl="/dashboard"
    >
      <html lang="en" className="dark">
        <body className={`${inter.className} bg-slate-900 text-slate-50 antialiased flex flex-col min-h-screen`}>
          <main className="flex-grow">
            {children}
          </main>
          
          <footer className="bg-slate-950 border-t border-slate-800 py-6 mt-auto">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="text-center md:text-left">
                <p className="text-sm text-slate-400">© 2026 Hersemita. All rights reserved.</p>
              </div>        
              <div className="flex items-center gap-6">
                <a href="/privacy" className="text-sm text-slate-400 hover:text-slate-200 transition-colors">
                  Privacy
                </a>
                <a href="/terms" className="text-sm text-slate-400 hover:text-slate-200 transition-colors">
                  Terms
                </a>
                <a href="mailto:support@hersemita.com" className="text-sm text-slate-400 hover:text-slate-200 transition-colors">
                  support@hersemita.com
                </a>
              </div>
            </div>
          </footer>
        </body>
      </html>
    </ClerkProvider>
  );
}
