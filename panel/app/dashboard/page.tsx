"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { 
  Terminal, Server, FolderGit2, Plus, 
  Settings, LogOut, Radio, RefreshCw, Copy, Check 
} from "lucide-react";

interface ServerObj {
  id: string;
  name: string;
  ip: string;
  status: string;
  agentToken: string;
  projects: number;
}

export default function Dashboard() {
  const [servers, setServers] = useState<ServerObj[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [username, setUsername] = useState("");

  // Form states
  const [serverName, setServerName] = useState("");
  const [serverIp, setServerIp] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generatedToken, setGeneratedToken] = useState("");
  const [installCommand, setInstallCommand] = useState("");
  const [copied, setCopied] = useState(false);

  const fetchServers = async (showLoader = false) => {
    const activeUserId = localStorage.getItem("userId");
    if (!activeUserId) return;

    try {
      if (showLoader) setIsLoading(true);
      const res = await fetch("http://localhost:4000/api/servers", {
        headers: {
          "x-user-id": activeUserId,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setServers(data);
      }
    } catch (err) {
      console.error("Failed to load servers:", err);
    } finally {
      if (showLoader) setIsLoading(false);
    }
  };

  useEffect(() => {
    // Parse redirect URL parameters from GitHub Auth Callback
    const params = new URLSearchParams(window.location.search);
    const userIdParam = params.get("userId");
    const usernameParam = params.get("username");

    if (userIdParam) {
      localStorage.setItem("userId", userIdParam);
      if (usernameParam) localStorage.setItem("username", usernameParam);
      
      // Strip query parameters to make URL clean
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    const activeUserId = localStorage.getItem("userId");
    if (!activeUserId) {
      // Redirect back to login screen
      window.location.href = "/";
      return;
    }

    setUsername(localStorage.getItem("username") || "Developer");
    fetchServers(true);
    
    // Auto-refresh metrics/servers list every 5s so connected agents toggle online instantly in UI
    const interval = setInterval(() => {
      fetchServers(false);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const handleRegisterServer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serverName || !serverIp) return;

    const activeUserId = localStorage.getItem("userId");
    if (!activeUserId) return;

    try {
      setIsSubmitting(true);
      const res = await fetch("http://localhost:4000/api/servers", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-user-id": activeUserId,
        },
        body: JSON.stringify({ name: serverName, ip: serverIp }),
      });

      if (res.ok) {
        const data = await res.json();
        setGeneratedToken(data.agentToken);
        
        // Dynamically compute the panel install endpoint address
        const installUrl = `curl -sSL http://localhost:4000/api/servers/install/${data.agentToken} | bash`;
        setInstallCommand(installUrl);
        
        // Refresh local listing
        await fetchServers(false);
        setServerName("");
        setServerIp("");
      }
    } catch (err) {
      console.error("Failed to register server:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(installCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
            <span className="text-[10px] text-slate-400 font-mono">User:</span>
            <span className="text-xs text-slate-200 font-bold">{username}</span>
          </div>
          <Link 
            href="/" 
            onClick={() => localStorage.clear()}
            className="p-2 hover:bg-white/5 rounded-xl transition text-slate-400 hover:text-danger"
          >
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
          <Link href="/dashboard/projects" className="flex items-center gap-3 py-3 px-4 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-white/5 transition-all font-medium">
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
            <button 
              onClick={() => {
                setShowRegisterForm(!showRegisterForm);
                setGeneratedToken("");
                setInstallCommand("");
              }}
              className="flex items-center gap-2 py-2.5 px-4 bg-gradient-to-r from-primary to-indigo-600 hover:from-primary hover:to-indigo-500 text-white text-sm font-semibold rounded-xl glow-btn transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>{showRegisterForm ? "Cancel Registration" : "Register Server"}</span>
            </button>
          </div>

          {/* Registration form panel */}
          {showRegisterForm && (
            <div className="glass-panel p-6 rounded-3xl mb-8 max-w-3xl border-primary/20">
              <h3 className="text-lg font-bold text-slate-100 mb-4">Register Clean VPS Server</h3>
              {!generatedToken ? (
                <form onSubmit={handleRegisterServer} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-slate-400 block mb-1 uppercase">Node Friendly Name</label>
                      <input 
                        type="text" 
                        placeholder="Production-VPS-East"
                        value={serverName}
                        onChange={(e) => setServerName(e.target.value)}
                        className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-xs text-slate-300 outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-400 block mb-1 uppercase">IPv4 Target IP</label>
                      <input 
                        type="text" 
                        placeholder="192.168.1.10"
                        value={serverIp}
                        onChange={(e) => setServerIp(e.target.value)}
                        className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-xs text-slate-300 outline-none"
                        required
                      />
                    </div>
                  </div>
                  <button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="py-2.5 px-5 bg-primary hover:bg-primary/90 text-white text-xs font-bold rounded-xl transition"
                  >
                    {isSubmitting ? "Generating Credentials..." : "Generate Security Token"}
                  </button>
                </form>
              ) : (
                <div className="space-y-4">
                  <div className="bg-success/5 border border-success/10 p-4 rounded-xl text-xs text-slate-300">
                    <span className="font-bold text-success block mb-1">Server Registered successfully!</span>
                    Copy and run the outbound-only agent setup installation script on your clean VPS node:
                  </div>
                  
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      readOnly 
                      value={installCommand}
                      className="flex-1 bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-xs font-mono text-slate-300 outline-none select-all"
                    />
                    <button 
                      onClick={handleCopy}
                      className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-slate-300 border border-white/5 font-semibold text-xs rounded-xl transition flex items-center gap-1.5"
                    >
                      {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                      <span>{copied ? "Copied" : "Copy"}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

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
              <button 
                onClick={() => fetchServers(true)} 
                className="p-2 text-slate-400 hover:text-slate-200 transition"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-12 text-slate-500">
                <RefreshCw className="w-8 h-8 animate-spin" />
              </div>
            ) : servers.length === 0 ? (
              <div className="p-12 text-center text-slate-500 text-sm">
                No server clusters registered yet. Link your infrastructure to begin!
              </div>
            ) : (
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
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
