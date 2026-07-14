"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { 
  ArrowLeft, FolderGit2, Shield, Cpu, Server,
  Terminal, Key, RefreshCw, Trash2, Plus, 
  History, RotateCcw, AlertTriangle, PlayCircle, EyeOff, Globe, LogOut
} from "lucide-react";
import { io, Socket } from "socket.io-client";
import LogViewer from "../../../../components/log-viewer";

interface Deployment {
  id: string;
  commitHash: string;
  buildStatus: string;
  logSummary: string;
  releasePath: string | null;
  duration: number;
  createdAt: string;
}

interface EnvVar {
  key: string;
  createdAt: string;
}

interface Project {
  id: string;
  repoUrl: string;
  branch: string;
  subdomain: string;
  port: number;
  status: string;
  server: {
    id: string;
    name: string;
    ip: string;
    status: string;
  };
  deployments: Deployment[];
  environmentVariables: EnvVar[];
}

export default function ProjectDetail() {
  const { id } = useParams();
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"console" | "secrets" | "history">("console");
  const [isClient, setIsClient] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  // Env form states
  const [envKey, setEnvKey] = useState("");
  const [envValue, setEnvValue] = useState("");
  const [isSavingEnv, setIsSavingEnv] = useState(false);
  const [envError, setEnvError] = useState("");

  // Build states
  const [activeDeploymentId, setActiveDeploymentId] = useState<string | null>(null);
  const [currentLogs, setCurrentLogs] = useState<string>("");
  const [isTriggeringBuild, setIsTriggeringBuild] = useState(false);

  const fetchProjectDetails = async () => {
    const activeUserId = localStorage.getItem("userId");
    if (!activeUserId) return;

    try {
      const res = await fetch(`http://localhost:4000/api/projects/${id}`, {
        headers: {
          "x-user-id": activeUserId,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setProject(data);

        // Find active/building deployment if any
        const activeDep = data.deployments.find(
          (d: Deployment) => d.buildStatus === "QUEUED" || d.buildStatus === "BUILDING"
        );
        if (activeDep) {
          setActiveDeploymentId(activeDep.id);
          setCurrentLogs(activeDep.logSummary);
        } else if (data.deployments.length > 0) {
          // Fallback to show logs of the latest deployment
          setCurrentLogs(data.deployments[0].logSummary);
        }
      }
    } catch (err) {
      console.error("Failed to load project details:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const activeUserId = localStorage.getItem("userId");
    if (!activeUserId) {
      window.location.href = "/";
      return;
    }
    setIsClient(true);
    fetchProjectDetails();
  }, [id]);

  // Connect WebSocket gateway to receive live log streams
  useEffect(() => {
    if (!isClient) return;

    const socket = io("http://localhost:4000/agent", {
      transports: ["websocket"],
    });

    socket.on("connect", () => {
      console.log("Cockpit connected to WebSocket Gateway");
    });

    // Listen to log chunks
    socket.on("deploy:log", (data: { deploymentId: string; chunk: string }) => {
      if (data.deploymentId === activeDeploymentId) {
        setCurrentLogs((prev) => prev + data.chunk);
      }
    });

    // Listen to status updates to refresh project details
    socket.on("deploy:status", (data: { deploymentId: string; status: string }) => {
      if (data.deploymentId === activeDeploymentId) {
        setActiveDeploymentId(null);
        fetchProjectDetails();
      }
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, [isClient, activeDeploymentId]);

  // Trigger manual deployment run
  const handleDeploy = async () => {
    const activeUserId = localStorage.getItem("userId");
    if (!activeUserId) return;

    try {
      setIsTriggeringBuild(true);
      const res = await fetch(`http://localhost:4000/api/projects/${id}/deploy`, {
        method: "POST",
        headers: {
          "x-user-id": activeUserId,
        },
      });
      if (res.ok) {
        const dep = await res.json();
        setActiveDeploymentId(dep.id);
        setCurrentLogs(dep.logSummary);
        setActiveTab("console");
        // Update local project status temporarily
        if (project) {
          setProject({ ...project, status: "DEPLOYING" });
        }
      }
    } catch (err) {
      console.error("Deployment failed to trigger:", err);
    } finally {
      setIsTriggeringBuild(false);
    }
  };

  // Add environment variable secret
  const handleAddEnv = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!envKey || !envValue) {
      setEnvError("Please fill out both key and value.");
      return;
    }

    const activeUserId = localStorage.getItem("userId");
    if (!activeUserId) return;

    try {
      setIsSavingEnv(true);
      setEnvError("");
      const res = await fetch(`http://localhost:4000/api/projects/${id}/env`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-user-id": activeUserId,
        },
        body: JSON.stringify({ key: envKey, value: envValue }),
      });

      if (!res.ok) {
        throw new Error("Failed to save secret key");
      }

      setEnvKey("");
      setEnvValue("");
      fetchProjectDetails();
    } catch (err: any) {
      setEnvError(err.message);
    } finally {
      setIsSavingEnv(false);
    }
  };

  // Delete environment variable secret
  const handleDeleteEnv = async (key: string) => {
    if (!confirm(`Are you sure you want to delete environment variable "${key}"?`)) return;

    const activeUserId = localStorage.getItem("userId");
    if (!activeUserId) return;

    try {
      const res = await fetch(`http://localhost:4000/api/projects/${id}/env/${key}`, {
        method: "DELETE",
        headers: {
          "x-user-id": activeUserId,
        },
      });
      if (res.ok) {
        fetchProjectDetails();
      }
    } catch (err) {
      console.error("Failed to delete secret key:", err);
    }
  };

  // Rollback to specific deployment revision
  const handleRollback = async (depId: string) => {
    if (!confirm("Are you sure you want to rollback to this build revision? This will swap symlinks instantly.")) return;

    const activeUserId = localStorage.getItem("userId");
    if (!activeUserId) return;

    try {
      setIsLoading(true);
      const res = await fetch(`http://localhost:4000/api/deployments/${depId}/rollback`, {
        method: "POST",
        headers: {
          "x-user-id": activeUserId,
        },
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.message || "Failed to trigger rollback.");
      } else {
        await fetchProjectDetails();
        setActiveTab("history");
      }
    } catch (err) {
      console.error("Rollback failed:", err);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading && !project) {
    return (
      <div className="flex-1 flex justify-center items-center bg-background h-screen">
        <RefreshCw className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!project) return null;

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-background">
      {/* Top Navigation Navbar */}
      <header className="h-16 border-b border-white/5 px-6 flex justify-between items-center glass-panel">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/projects" className="p-2 hover:bg-white/5 rounded-xl transition text-slate-400 hover:text-slate-100">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <span className="font-extrabold text-lg tracking-wider text-slate-100 flex items-center gap-2">
            <FolderGit2 className="w-5 h-5 text-primary" />
            PROJECT MANAGEMENT
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-white/5 py-1.5 px-3 rounded-full border border-white/5 text-xs text-slate-300 font-semibold">
            <span>Allocated Port: </span>
            <span className="font-mono text-accent">{project.port}</span>
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

      {/* Main Content Layout Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 md:p-8 flex flex-col gap-6">
        
        {/* Project Header Widget */}
        <div className="glass-panel p-6 rounded-3xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <span className="text-[10px] text-slate-500 font-bold tracking-wider uppercase block">REPOSITORY PATH</span>
            <h1 className="text-xl font-bold text-slate-100 mt-0.5 truncate max-w-lg">{project.repoUrl}</h1>
            
            <div className="flex gap-4 mt-2 text-xs text-slate-400 font-medium">
              <span className="flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-slate-600" /> {project.subdomain}
              </span>
              <span className="flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5 text-slate-600" /> Node: {project.server.name}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <span className={`text-xs font-bold px-2.5 py-1 rounded-md border ${
              project.status === "SUCCESS"
                ? "bg-success/5 border-success/15 text-success"
                : project.status === "DEPLOYING"
                ? "bg-warning/5 border-warning/15 text-warning animate-pulse"
                : "bg-white/5 border-white/5 text-slate-400"
            }`}>
              {project.status}
            </span>
            <button 
              onClick={handleDeploy}
              disabled={project.server.status !== "ONLINE" || isTriggeringBuild || !!activeDeploymentId}
              className="flex items-center gap-2 py-2.5 px-4 bg-gradient-to-r from-primary to-indigo-600 hover:from-primary hover:to-indigo-500 disabled:from-slate-800 disabled:to-slate-900 text-white text-xs font-semibold rounded-xl glow-btn transition-all"
            >
              <PlayCircle className="w-4 h-4" />
              <span>Deploy Revision</span>
            </button>
          </div>
        </div>

        {/* Warning if server offline */}
        {project.server.status !== "ONLINE" && (
          <div className="glass-panel p-4 rounded-2xl border-danger/15 bg-danger/[0.01] flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-danger flex-shrink-0" />
            <span className="text-xs text-slate-400">
              The linked server node <strong>{project.server.name}</strong> is currently OFFLINE. Deployments and rollbacks are disabled.
            </span>
          </div>
        )}

        {/* Tab switchers bar */}
        <div className="border-b border-white/5 flex gap-6 text-sm font-semibold">
          <button 
            onClick={() => setActiveTab("console")}
            className={`pb-3 transition-all ${activeTab === "console" ? "text-primary border-b-2 border-primary" : "text-slate-400 hover:text-slate-200"}`}
          >
            <span className="flex items-center gap-2"><Terminal className="w-4 h-4" /> Build Logs Console</span>
          </button>
          <button 
            onClick={() => setActiveTab("secrets")}
            className={`pb-3 transition-all ${activeTab === "secrets" ? "text-primary border-b-2 border-primary" : "text-slate-400 hover:text-slate-200"}`}
          >
            <span className="flex items-center gap-2"><Key className="w-4 h-4" /> Environment Secrets</span>
          </button>
          <button 
            onClick={() => setActiveTab("history")}
            className={`pb-3 transition-all ${activeTab === "history" ? "text-primary border-b-2 border-primary" : "text-slate-400 hover:text-slate-200"}`}
          >
            <span className="flex items-center gap-2"><History className="w-4 h-4" /> Deployments History</span>
          </button>
        </div>

        {/* Tab Panel contents */}
        <div className="flex-1 flex flex-col gap-6">

          {/* TAB 1: CONSOLE */}
          {activeTab === "console" && (
            <div className="flex-1 flex flex-col gap-2">
              <LogViewer 
                logs={currentLogs} 
                socket={socketRef.current} 
                deploymentId={activeDeploymentId || undefined} 
              />
            </div>
          )}

          {/* TAB 2: ENVIRONMENT SECRETS */}
          {activeTab === "secrets" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              
              {/* Form to define secret */}
              <form onSubmit={handleAddEnv} className="glass-panel p-6 rounded-3xl lg:col-span-1">
                <h3 className="text-sm font-bold text-slate-100 mb-4 uppercase tracking-wider flex items-center gap-2">
                  <Plus className="w-4 h-4 text-primary" /> Define Secret Key
                </h3>
                {envError && (
                  <div className="bg-danger/10 border border-danger/25 text-danger px-3 py-2 rounded-xl mb-3 text-[10px] font-semibold">
                    {envError}
                  </div>
                )}
                <div className="space-y-3 mb-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block mb-1 uppercase">Key (uppercase, unique)</label>
                    <input 
                      type="text" 
                      placeholder="DATABASE_URL"
                      value={envKey}
                      onChange={(e) => setEnvKey(e.target.value.toUpperCase())}
                      className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-2.5 text-xs text-slate-300 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block mb-1 uppercase">Secret Value</label>
                    <input 
                      type="password" 
                      placeholder="••••••••••••••"
                      value={envValue}
                      onChange={(e) => setEnvValue(e.target.value)}
                      className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-2.5 text-xs text-slate-300 outline-none"
                    />
                  </div>
                </div>
                <button 
                  type="submit"
                  disabled={isSavingEnv}
                  className="w-full py-2.5 bg-primary hover:bg-primary/95 text-white text-xs font-bold rounded-xl transition"
                >
                  {isSavingEnv ? "Saving..." : "Save Configuration"}
                </button>
              </form>

              {/* Secrets Table List */}
              <div className="glass-panel rounded-3xl lg:col-span-2 overflow-hidden">
                <div className="p-4 border-b border-white/5 bg-white/[0.01] flex items-center gap-2">
                  <Shield className="w-4 h-4 text-accent" />
                  <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">Active Configuration Keys</span>
                </div>
                {project.environmentVariables.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 text-xs">
                    No custom environment configurations mapped. Add a key to start!
                  </div>
                ) : (
                  <div className="divide-y divide-white/5">
                    {project.environmentVariables.map((env) => (
                      <div key={env.key} className="p-4 flex justify-between items-center hover:bg-white/[0.005] transition-all">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-slate-800/40 rounded-lg text-slate-400">
                            <Key className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-mono text-xs font-semibold text-slate-200 block">{env.key}</span>
                            <span className="text-[10px] text-slate-500 block mt-0.5">Encrypted AES-256-GCM</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-1.5 text-slate-500 text-[10px] font-mono">
                            <EyeOff className="w-3 h-3" /> HIDDEN VALUE
                          </div>
                          <button 
                            onClick={() => handleDeleteEnv(env.key)}
                            className="p-2 hover:bg-danger/10 text-slate-500 hover:text-danger rounded-lg transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: DEPLOYMENTS HISTORY */}
          {activeTab === "history" && (
            <div className="glass-panel rounded-3xl overflow-hidden">
              <div className="p-4 border-b border-white/5 bg-white/[0.01]">
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">Build Revisions Log</span>
              </div>
              {project.deployments.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs">
                  No deployment history exists for this project.
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {project.deployments.map((dep, idx) => (
                    <div key={dep.id} className="p-5 flex flex-col md:flex-row md:justify-between md:items-center gap-4 hover:bg-white/[0.005] transition">
                      <div className="flex items-start gap-4">
                        <div className={`p-2 rounded-xl mt-0.5 ${
                          dep.buildStatus === "SUCCESS" 
                            ? "bg-success/5 text-success" 
                            : dep.buildStatus === "FAILED"
                            ? "bg-danger/5 text-danger"
                            : "bg-warning/5 text-warning animate-pulse"
                        }`}>
                          <RefreshCw className={`w-4 h-4 ${dep.buildStatus === "BUILDING" ? "animate-spin" : ""}`} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-200 text-sm">Commit: {dep.commitHash.slice(0, 8)}</span>
                            {idx === 0 && dep.buildStatus === "SUCCESS" && (
                              <span className="text-[9px] font-extrabold bg-primary/10 border border-primary/20 text-primary px-2 py-0.5 rounded-full uppercase tracking-wider">
                                Active Release
                              </span>
                            )}
                          </div>
                          
                          <div className="flex gap-4 mt-1 text-[10px] text-slate-500 font-medium">
                            <span>Duration: {dep.duration}s</span>
                            <span>{new Date(dep.createdAt).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 self-end md:self-auto">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                          dep.buildStatus === "SUCCESS" 
                            ? "bg-success/5 text-success border border-success/15" 
                            : dep.buildStatus === "FAILED"
                            ? "bg-danger/5 text-danger border border-danger/15"
                            : "bg-warning/5 text-warning border border-warning/15 animate-pulse"
                        }`}>
                          {dep.buildStatus}
                        </span>

                        {/* Rollback button: Only show for old succeeded deployments */}
                        {dep.buildStatus === "SUCCESS" && idx > 0 && project.server.status === "ONLINE" && (
                          <button 
                            onClick={() => handleRollback(dep.id)}
                            className="flex items-center gap-1.5 py-1 px-2.5 bg-[#6366f1]/10 hover:bg-[#6366f1]/20 text-primary text-xs font-semibold rounded-lg border border-[#6366f1]/20 transition"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Rollback</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
