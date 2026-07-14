"use client";

import Link from "next/link";
import { Terminal, Github, Server, Activity, ShieldCheck } from "lucide-react";

export default function Home() {
  return (
    <main className="relative flex-1 flex flex-col justify-center items-center px-4 overflow-hidden">
      {/* Background Glow effects */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-primary/10 blur-3xl -z-10 animate-pulse"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-accent/5 blur-3xl -z-10 animate-pulse delay-75"></div>

      {/* Main Brand header */}
      <div className="text-center mb-8 flex flex-col items-center">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-3 bg-primary/10 border border-primary/20 rounded-2xl">
            <Terminal className="w-8 h-8 text-primary" />
          </div>
          <span className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-primary bg-clip-text text-transparent">
            SerDaddy
          </span>
        </div>
        <p className="text-slate-400 max-w-sm text-sm sm:text-base leading-relaxed">
          Own your infrastructure. Turn clean VPS servers into high-performance web deployment targets.
        </p>
      </div>

      {/* Premium Glass Login Card */}
      <div className="w-full max-w-md glass-panel p-8 rounded-3xl flex flex-col items-center">
        <h2 className="text-xl font-bold mb-1 text-slate-100">Welcome to SerDaddy</h2>
        <p className="text-xs text-slate-400 mb-6">Authorize with GitHub to access your repositories</p>

        <a 
          href="http://localhost:4000/api/auth/github" 
          className="w-full py-3.5 px-5 bg-gradient-to-r from-primary to-indigo-700 hover:from-primary hover:to-indigo-600 text-white font-semibold rounded-2xl flex items-center justify-center gap-3 transition-all duration-200 glow-btn"
        >
          <Github className="w-5 h-5" />
          Sign in with GitHub
        </a>

        {/* Feature Grid */}
        <div className="grid grid-cols-2 gap-4 mt-8 w-full border-t border-white/5 pt-6">
          <div className="flex flex-col items-center p-3 rounded-2xl bg-white/[0.01] border border-white/[0.03]">
            <Server className="w-5 h-5 text-accent mb-2" />
            <span className="text-xs font-semibold text-slate-200">Unlimited Servers</span>
            <span className="text-[10px] text-slate-500 mt-0.5">Deploy anywhere</span>
          </div>
          <div className="flex flex-col items-center p-3 rounded-2xl bg-white/[0.01] border border-white/[0.03]">
            <Activity className="w-5 h-5 text-success mb-2" />
            <span className="text-xs font-semibold text-slate-200">Live Telemetry</span>
            <span className="text-[10px] text-slate-500 mt-0.5">CPU/RAM gauges</span>
          </div>
          <div className="flex flex-col items-center p-3 rounded-2xl bg-white/[0.01] border border-white/[0.03] col-span-2">
            <div className="flex items-center gap-1.5 mb-1.5">
              <ShieldCheck className="w-4 h-4 text-primary" />
              <span className="text-xs font-semibold text-slate-200">Outbound-Only Agents</span>
            </div>
            <span className="text-[10px] text-slate-500 text-center">
              Agent-initiated connections bypass inbound firewall rules.
            </span>
          </div>
        </div>
      </div>

      {/* Footer copyright */}
      <footer className="absolute bottom-6 text-xs text-slate-600">
        &copy; {new Date().getFullYear()} SerDaddy. All rights reserved.
      </footer>
    </main>
  );
}
