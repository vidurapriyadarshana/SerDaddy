"use client";

import { useState } from "react";
import Link from "next/link";
import { 
  Terminal, Server, FolderGit2, Plus, 
  Settings, LogOut, Radio, Cpu, RefreshCw, CpuIcon 
} from "lucide-react";

export default function Dashboard() {
  const [servers, setServers] = useState([
    { id: "1", name: "Production-VPS-1", ip: "192.168.1.100", status: "ONLINE", projects: 3 },
    { id: "2", name: "Staging-VPS", ip: "192.168.1.101", status: "OFFLINE", projects: 1 },
  ]);

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-background">
      {/* Top Navbar */}
      <header className="h-16 border-b border-white/5 px-6 flex justify-between items-center glass-panel">
        <div className="flex items-center gap-2">
          <Terminal className="w-6 h-6 text-primary" />
          <span className="font-extrabold text-lg tracking-wider text-slate-100">SERDADDY</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-white/5 py-1.5 px-3 rounded-full border border-white/5">
            <span className="w-2.5 h-2.5 bg-success rounded-full animate-pulse"></span>
            <span className="text-xs text-slate-300 font-semibold">Web Socket Hub Open</span>
          </div>
          <Link href="/" className="p-2 hover:bg-white/5 rounded-xl transition text-slate-400 hover:text-danger">
            <LogOut className="w-5 h-5" />
          </Link>
        </div>
      </header>

      {/* Main Layout Container */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar Nav */}
        <aside className="w-64 border-r border-white/5 p-4 flex flex-col gap-2 glass-panel">
          <Link href="/dashboard" className="flex items-center gap-3 py-3 px-4 rounded-xl bg-primary/10 text-primary border border-primary/20 transition-all font-medium">
            <Server className="w-5 h-5" />
            <span>Servers</span>
          </Link>
          <Link href="#" className="flex items-center gap-3 py-3 px-4 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-white/5 transition-all font-medium">
            <FolderGit2 className="w-5 h-5" />
            <span>Projects</span>
          </Link>
          <Link href="#" className="flex items-center gap-3 py-3 px-4 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-white/5 transition-all font-medium">
            <Settings className="w-5 h-5" />
            <span>Settings</span>
          </Link>
        </aside>

        {/* Dashboard Content Panel */}
        <main className="flex-1 overflow-y-auto p-8">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Active Infrastructure</h1>
              <p className="text-sm text-slate-400">View live status and metrics of your registered servers.</p>
            </div>
            <button className="flex items-center gap-2 py-2.5 px-4 bg-gradient-to-r from-primary to-indigo-600 hover:from-primary hover:to-indigo-500 text-white text-sm font-semibold rounded-xl glow-btn transition-all">
              <Plus className="w-4 h-4" />
              <span>Register Server</span>
            </button>
          </div>

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="glass-panel p-5 rounded-2xl flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-xl text-primary">
                <Server className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs text-slate-500 font-bold block">TOTAL SERVERS</span>
                <span className="text-xl font-extrabold text-slate-200">{servers.length}</span>
              </div>
            </div>
            <div className="glass-panel p-5 rounded-2xl flex items-center gap-4">
              <div className="p-3 bg-success/10 rounded-xl text-success">
                <Radio className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs text-slate-500 font-bold block">ONLINE TARGETS</span>
                <span className="text-xl font-extrabold text-slate-200">
                  {servers.filter(s => s.status === "ONLINE").length}
                </span>
              </div>
            </div>
            <div className="glass-panel p-5 rounded-2xl flex items-center gap-4">
              <div className="p-3 bg-accent/10 rounded-xl text-accent">
                <FolderGit2 className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs text-slate-500 font-bold block">RUNNING PROJECTS</span>
                <span className="text-xl font-extrabold text-slate-200">
                  {servers.reduce((acc, s) => acc + s.projects, 0)}
                </span>
              </div>
            </div>
          </div>

          {/* Server List Card Tables */}
          <div className="glass-panel rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-white/5 flex justify-between items-center bg-white/[0.01]">
              <span className="font-bold text-slate-200 text-sm">Server Clusters</span>
              <button className="p-2 text-slate-400 hover:text-slate-200 transition">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
            <div className="divide-y divide-white/5">
              {servers.map((server) => (
                <div key={server.id} className="p-5 flex justify-between items-center hover:bg-white/[0.01] transition-all">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-2xl border ${
                      server.status === "ONLINE" 
                        ? "bg-success/5 border-success/10 text-success" 
                        : "bg-white/5 border-white/5 text-slate-400"
                    }`}>
                      <Server className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-100">{server.name}</span>
                        <span className={`w-2 h-2 rounded-full ${
                          server.status === "ONLINE" ? "bg-success animate-pulse" : "bg-danger"
                        }`}></span>
                      </div>
                      <span className="text-xs text-slate-500 font-mono block mt-0.5">{server.ip}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-8">
                    <div className="text-right hidden md:block">
                      <span className="text-xs text-slate-500 block">PROJECTS</span>
                      <span className="text-sm font-semibold text-slate-300">{server.projects} linked</span>
                    </div>
                    <Link 
                      href={`/dashboard/servers/${server.id}`}
                      className="py-1.5 px-3 bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold rounded-lg border border-white/5 transition-all"
                    >
                      Manage Target
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
