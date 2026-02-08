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
      // ADD THESE 4 LINES:
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      afterSignInUrl="/dashboard"
      afterSignUpUrl="/dashboard"
    >
      <html lang="en" className="dark">
        <body className={`${inter.className} bg-slate-900 text-slate-50 antialiased`}>
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}