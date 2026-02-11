import Link from "next/link";
import Image from "next/image";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute top-20 left-20 w-72 h-72 bg-[#00ff67]/10 rounded-full blur-3xl" />
      <div className="absolute bottom-20 right-20 w-96 h-96 bg-[#00a7ff]/10 rounded-full blur-3xl" />
      
      <div className="max-w-3xl text-center space-y-8 relative z-10">
        {/* Logo Section - Clean background */}
        <div className="flex flex-col items-center gap-4">
          <div className="w-50 h-50 rounded-2xl overflow-hidden">
            <img 
              src="/logo.png" 
              alt="Hersemita" 
              className="w-full h-full object-contain"
            />
          </div>
          <h1 className="text-6xl font-bold tracking-tight bg-gradient-to-r from-[#00ff67] to-[#00a7ff] bg-clip-text text-transparent">
            Hersemita
          </h1>
        </div>
        
        <p className="text-xl text-slate-300 max-w-xl mx-auto leading-relaxed">
          Universal run tracking for cross country coaches. 
          Athletes upload runs from Garmin, Apple Watch, or Strava—verify progress, analyze trends, and communicate with parents all in one place.
        </p>
        
        {/* Platform icons */}
        <div className="flex justify-center items-center gap-6 pt-2">
          <div className="flex flex-col items-center gap-2 group">
            <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center border border-white/20 group-hover:border-[#00ff67]/50 transition-colors">
              <svg className="w-6 h-6 text-[#00ff67]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
            </div>
            <span className="text-xs text-slate-400 font-medium">Garmin</span>
          </div>
          <div className="w-px h-8 bg-white/20" />
          <div className="flex flex-col items-center gap-2 group">
            <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center border border-white/20 group-hover:border-[#00a7ff]/50 transition-colors">
              <svg className="w-6 h-6 text-[#00a7ff]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
              </svg>
            </div>
            <span className="text-xs text-slate-400 font-medium">Apple Watch</span>
          </div>
          <div className="w-px h-8 bg-white/20" />
          <div className="flex flex-col items-center gap-2 group">
            <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center border border-white/20 group-hover:border-[#00ff67]/50 transition-colors">
              <svg className="w-6 h-6 text-[#00ff67]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
              </svg>
            </div>
            <span className="text-xs text-slate-400 font-medium">Strava</span>
          </div>
        </div>
        
        {/* Two buttons side by side */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-6">
          <a 
            href="/sign-in"
            className="group relative bg-gradient-to-r from-[#00ff67] to-[#00a7ff] text-white font-bold py-4 px-8 rounded-xl text-lg transition-all duration-300 inline-block text-center shadow-lg shadow-[#00a7ff]/25 hover:shadow-xl hover:shadow-[#00a7ff]/40 hover:scale-105"
          >
            <span className="relative z-10 flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Coach Login
            </span>
          </a>
          
          <a 
            href="/runner/login"
            className="group bg-white/10 backdrop-blur-sm border-2 border-[#00ff67]/50 text-white font-bold py-4 px-8 rounded-xl text-lg transition-all duration-300 inline-block text-center hover:bg-[#00ff67]/20 hover:border-[#00ff67] hover:scale-105"
          >
            <span className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5 text-[#00ff67]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Runner Portal
            </span>
          </a>
        </div>

        {/* Feature pills */}
        <div className="flex flex-wrap justify-center gap-3 pt-8">
          <span className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-sm text-slate-400 flex items-center gap-2">
            <svg className="w-4 h-4 text-[#00ff67]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            Mobile File Upload
          </span>
          <span className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-sm text-slate-400 flex items-center gap-2">
            <svg className="w-4 h-4 text-[#00a7ff]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            Parent Messaging
          </span>
          <span className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-sm text-slate-400 flex items-center gap-2">
            <svg className="w-4 h-4 text-[#00ff67]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Performance Analytics
          </span>
        </div>
      </div>
      
      {/* Footer */}
      <div className="absolute bottom-6 text-slate-500 text-sm">
        © 2025 Hersemita. All rights reserved.
      </div>
    </main>
  );
}