"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { 
  Terminal, Server, FolderGit2, Plus, 
  Settings, LogOut, RefreshCw, GitBranch, Globe, Radio, PlayCircle, ArrowLeft, Search
} from "lucide-react";

interface ServerObj {
  id: string;
  name: string;
  ip: string;
}

interface Project {
  id: string;
  repoUrl: string;
  branch: string;
  subdomain: string;
  port: number;
  status: string;
  server: {
    name: string;
    ip: string;
  };
  _count: {
    deployments: number;
  };
}

export default function ProjectsList() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [servers, setServers] = useState<ServerObj[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [username, setUsername] = useState("");

  // Repository states
  const [userRepos, setUserRepos] = useState<any[]>([]);
  const [isLoadingRepos, setIsLoadingRepos] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState<any | null>(null);
  const [repoSearch, setRepoSearch] = useState("");

  // Form states
  const [serverId, setServerId] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [branch, setBranch] = useState("main");
  const [subdomain, setSubdomain] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const fetchUserRepos = async () => {
    const activeUserId = localStorage.getItem("userId");
    if (!activeUserId) return;

    try {
      setIsLoadingRepos(true);
      const res = await fetch("http://localhost:4000/api/auth/repos", {
        headers: {
          "x-user-id": activeUserId,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setUserRepos(data);
      }
    } catch (err) {
      console.error("Failed to load user repos:", err);
    } finally {
      setIsLoadingRepos(false);
    }
  };

  const handleToggleAddForm = () => {
    const nextState = !showAddForm;
    setShowAddForm(nextState);
    if (nextState) {
      setSelectedRepo(null);
      setRepoSearch("");
      fetchUserRepos();
    }
  };

  const fetchData = async () => {
    const activeUserId = localStorage.getItem("userId");
    if (!activeUserId) return;

    try {
      setIsLoading(true);
      const [projRes, servRes] = await Promise.all([
        fetch("http://localhost:4000/api/projects", {
          headers: {
            "x-user-id": activeUserId,
          },
        }),
        fetch("http://localhost:4000/api/servers", {
          headers: {
            "x-user-id": activeUserId,
          },
        })
      ]);
      if (projRes.ok && servRes.ok) {
        const projData = await projRes.json();
        const servData = await servRes.json();
        setProjects(projData);
        setServers(servData);
        if (servData.length > 0) {
          setServerId(servData[0].id);
        }
      }
    } catch (err) {
      console.error("Failed to fetch data:", err);
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
    setUsername(localStorage.getItem("username") || "Developer");
    fetchData();
  }, []);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serverId || !repoUrl || !subdomain) {
      setErrorMsg("Please fill out all required fields.");
      return;
    }

    const activeUserId = localStorage.getItem("userId");
    if (!activeUserId) return;

    try {
      setIsSubmitting(true);
      setErrorMsg("");
      const res = await fetch("http://localhost:4000/api/projects", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-user-id": activeUserId,
        },
        body: JSON.stringify({ serverId, repoUrl, branch, subdomain }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to create project");
      }

      // Refresh data
      await fetchData();
      setShowAddForm(false);
      setRepoUrl("");
      setSubdomain("");
      setBranch("main");
    } catch (err: any) {
      setErrorMsg(err.message || "An error occurred.");
    } finally {
      setIsSubmitting(false);
    }
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
          <Link href="/dashboard" className="flex items-center gap-3 py-3 px-4 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-white/5 transition-all font-medium">
            <Server className="w-5 h-5" />
            <span>Servers</span>
          </Link>
          <Link href="/dashboard/projects" className="flex items-center gap-3 py-3 px-4 rounded-xl bg-primary/10 text-primary border border-primary/20 transition-all font-medium">
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
              <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Hosted Projects</h1>
              <p className="text-sm text-slate-400">Manage deployment mapping, custom domains, and repository linkages.</p>
            </div>
            <button 
              onClick={handleToggleAddForm}
              className="flex items-center gap-2 py-2.5 px-4 bg-gradient-to-r from-primary to-indigo-600 hover:from-primary hover:to-indigo-500 text-white text-sm font-semibold rounded-xl glow-btn transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>{showAddForm ? "Cancel Mapping" : "Link Repository"}</span>
            </button>
          </div>

          {/* Form / Repository list to register Project */}
          {showAddForm && (
            <div className="glass-panel p-6 rounded-3xl mb-8 max-w-4xl border-primary/20">
              {!selectedRepo ? (
                /* Step 1: Select Repository */
                <div>
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h3 className="text-lg font-bold text-slate-100">Select Git Repository</h3>
                      <p className="text-xs text-slate-400 mt-0.5">Choose a repository to configure and build on your servers.</p>
                    </div>
                  </div>

                  {/* Search Bar */}
                  <div className="relative mb-6">
                    <Search className="w-4 h-4 text-slate-500 absolute left-4 top-3.5" />
                    <input 
                      type="text" 
                      placeholder="Search repositories..."
                      value={repoSearch}
                      onChange={(e) => setRepoSearch(e.target.value)}
                      className="w-full bg-black/40 border border-white/5 rounded-2xl pl-11 pr-4 py-3 text-xs text-slate-200 outline-none focus:border-primary/50 transition"
                    />
                  </div>

                  {isLoadingRepos ? (
                    <div className="flex justify-center py-12 text-slate-500">
                      <RefreshCw className="w-6 h-6 animate-spin text-primary" />
                    </div>
                  ) : userRepos.length === 0 ? (
                    <div className="text-center py-12 border border-dashed border-white/5 rounded-2xl">
                      <FolderGit2 className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                      <p className="text-xs text-slate-400">No repositories found on your GitHub account.</p>
                    </div>
                  ) : (
                    /* Repos List */
                    <div className="grid grid-cols-1 gap-3 max-h-[350px] overflow-y-auto pr-1">
                      {userRepos
                        .filter(r => 
                          r.name.toLowerCase().includes(repoSearch.toLowerCase()) || 
                          r.fullName.toLowerCase().includes(repoSearch.toLowerCase())
                        )
                        .map((repo) => (
                          <div 
                            key={repo.fullName} 
                            className="flex justify-between items-center p-4 bg-white/[0.02] border border-white/5 hover:border-white/10 rounded-2xl transition"
                          >
                            <div className="flex items-center gap-3">
                              <div className="p-2.5 bg-indigo-500/10 rounded-xl text-indigo-400">
                                <FolderGit2 className="w-5 h-5" />
                              </div>
                              <div className="text-left">
                                <h4 className="font-bold text-slate-200 text-sm">{repo.fullName}</h4>
                                <p className="text-xs text-slate-500 mt-0.5 truncate max-w-lg">{repo.description}</p>
                              </div>
                            </div>
                            <button 
                              onClick={() => {
                                setSelectedRepo(repo);
                                setRepoUrl(repo.cloneUrl);
                                setBranch(repo.defaultBranch);
                                const cleanName = repo.name.toLowerCase().replace(/[^a-z0-9-]/g, "-");
                                setSubdomain(`${cleanName}.local`);
                              }}
                              className="py-2 px-4 bg-primary hover:bg-primary/95 text-white text-xs font-semibold rounded-xl transition"
                            >
                              Import
                            </button>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              ) : (
                /* Step 2: Configure & Link */
                <form onSubmit={handleCreateProject}>
                  <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/5">
                    <button 
                      type="button"
                      onClick={() => setSelectedRepo(null)}
                      className="p-2 bg-white/5 hover:bg-white/10 rounded-xl text-slate-400 hover:text-slate-100 transition"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <div>
                      <h3 className="text-lg font-bold text-slate-100">Configure Deploy Project</h3>
                      <p className="text-xs text-slate-400 mt-0.5">Importing: <span className="font-semibold text-primary">{selectedRepo.fullName}</span></p>
                    </div>
                  </div>

                  {errorMsg && (
                    <div className="bg-danger/10 border border-danger/25 text-danger px-4 py-3 rounded-xl mb-6 text-xs font-semibold">
                      {errorMsg}
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 block mb-1.5 uppercase tracking-wider">Target VPS Server Node</label>
                      <select 
                        value={serverId} 
                        onChange={(e) => setServerId(e.target.value)}
                        className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3.5 text-xs text-slate-200 outline-none focus:border-primary/50 transition"
                      >
                        {servers.map(s => (
                          <option key={s.id} value={s.id}>{s.name} ({s.ip})</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 block mb-1.5 uppercase tracking-wider">Repository URL (Read-Only)</label>
                      <input 
                        type="text" 
                        readOnly
                        value={repoUrl} 
                        className="w-full bg-black/20 border border-white/5 text-slate-500 rounded-xl px-4 py-3.5 text-xs outline-none cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 block mb-1.5 uppercase tracking-wider">Deploy Branch</label>
                      <input 
                        type="text" 
                        value={branch} 
                        onChange={(e) => setBranch(e.target.value)}
                        className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3.5 text-xs text-slate-200 outline-none focus:border-primary/50 transition"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 block mb-1.5 uppercase tracking-wider">Assigned Subdomain mapping</label>
                      <input 
                        type="text" 
                        placeholder="app.my-domain.com"
                        value={subdomain} 
                        onChange={(e) => setSubdomain(e.target.value)}
                        className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3.5 text-xs text-slate-200 outline-none focus:border-primary/50 transition"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 justify-end border-t border-white/5 pt-4">
                    <button 
                      type="button"
                      onClick={() => setSelectedRepo(null)}
                      className="py-2.5 px-4 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-slate-200 text-xs font-bold rounded-xl transition"
                    >
                      Back to Repositories
                    </button>
                    <button 
                      type="submit" 
                      disabled={isSubmitting}
                      className="py-2.5 px-5 bg-gradient-to-r from-primary to-indigo-600 hover:from-primary hover:to-indigo-500 text-white text-xs font-bold rounded-xl transition shadow-lg shadow-primary/10 disabled:opacity-50"
                    >
                      {isSubmitting ? "Linking project..." : "Deploy Project"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {isLoading ? (
            <div className="flex justify-center py-12 text-slate-500">
              <RefreshCw className="w-8 h-8 animate-spin" />
            </div>
          ) : projects.length === 0 ? (
            <div className="glass-panel p-12 rounded-3xl text-center">
              <FolderGit2 className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-slate-300">No projects linked yet</h3>
              <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">Link a Git repository to start building and deploying applications on your infrastructure.</p>
            </div>
          ) : (
            /* Projects Grid List */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {projects.map((proj) => (
                <div key={proj.id} className="glass-panel p-6 rounded-3xl flex flex-col justify-between hover:border-white/10 transition-all">
                  <div>
                    {/* Header: Repo url & Status */}
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-2">
                        <div className="p-2.5 bg-primary/10 rounded-xl text-primary">
                          <FolderGit2 className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-200 text-sm tracking-tight truncate max-w-[200px]">
                            {proj.repoUrl.split('/').pop()?.replace('.git', '')}
                          </h3>
                          <span className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5 font-mono">
                            <GitBranch className="w-3 h-3 text-slate-600" /> {proj.branch}
                          </span>
                        </div>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-md border ${
                        proj.status === "SUCCESS" 
                          ? "bg-success/5 border-success/15 text-success" 
                          : proj.status === "DEPLOYING"
                          ? "bg-warning/5 border-warning/15 text-warning animate-pulse"
                          : "bg-white/5 border-white/5 text-slate-400"
                      }`}>
                        {proj.status}
                      </span>
                    </div>

                    {/* Routing Details block */}
                    <div className="space-y-2.5 my-5 border-t border-b border-white/5 py-4">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500 flex items-center gap-1.5">
                          <Globe className="w-3.5 h-3.5 text-slate-600" /> Domain mapping
                        </span>
                        <span className="font-semibold text-slate-300 font-mono">{proj.subdomain}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500 flex items-center gap-1.5">
                          <Radio className="w-3.5 h-3.5 text-slate-600" /> Allocated Port
                        </span>
                        <span className="font-semibold text-slate-300 font-mono">{proj.port}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500 flex items-center gap-1.5">
                          <Server className="w-3.5 h-3.5 text-slate-600" /> Target VPS node
                        </span>
                        <span className="font-semibold text-slate-300">{proj.server.name}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-[10px] text-slate-500 font-bold uppercase">{proj._count.deployments} Build Runs</span>
                    <Link 
                      href={`/dashboard/projects/${proj.id}`}
                      className="flex items-center gap-1.5 py-1.5 px-3 bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold rounded-lg border border-white/5 transition-all"
                    >
                      <PlayCircle className="w-4 h-4" />
                      <span>Console & Secrets</span>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
