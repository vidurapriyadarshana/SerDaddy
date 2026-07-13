"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { 
  ArrowLeft, Server, Activity, Terminal, 
  Cpu, HardDrive, Shield, RefreshCw, AlertTriangle, CheckCircle 
} from "lucide-react";
import { io, Socket } from "socket.io-client";

interface TelemetryMetrics {
  cpuPercent: number;
  ramUsedBytes: number;
  ramTotalBytes: number;
  diskUsedBytes: number;
  diskTotalBytes: number;
  uptimeSeconds: number;
}

export default function ServerDetail() {
  const { id } = useParams();
  const [status, setStatus] = useState<string>("OFFLINE");
  const [metrics, setMetrics] = useState<TelemetryMetrics | null>(null);
  const [installCommand, setInstallCommand] = useState<string>("");
  const [isClient, setIsClient] = useState(false);

  // Mark client hydration complete
  useEffect(() => {
    setIsClient(true);
    setInstallCommand(`curl -sSL http://localhost:4000/api/agent/install | bash -s sd_agt_${id}`);
  }, [id]);

  useEffect(() => {
    if (!isClient) return;

    // Connect to NestJS Fastify WebSocket Hub (Namespace: agent)
    const socket: Socket = io("http://localhost:4000/agent", {
      transports: ["websocket"],
    });

    socket.on("connect", () => {
      console.log("Connected to SerDaddy Hub Gateway");
    });

    // Listen to live metrics for this server
    socket.on(`metrics:server:${id}`, (data: TelemetryMetrics) => {
      setStatus("ONLINE");
      setMetrics(data);
    });

    // Listen to global server state changes
    socket.on("server:state_change", (data: { serverId: string; status: string }) => {
      if (data.serverId === id) {
        setStatus(data.status);
        if (data.status === "OFFLINE") {
          setMetrics(null);
        }
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [id, isClient]);

  // Utility helpers
  const formatBytes = (bytes: number) => {
    if (!bytes) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatUptime = (seconds: number) => {
    if (!seconds) return "0m";
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-background">
      {/* Top Navigation Navbar */}
      <header className="h-16 border-b border-white/5 px-6 flex justify-between items-center glass-panel">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="p-2 hover:bg-white/5 rounded-xl transition text-slate-400 hover:text-slate-100">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <span className="font-extrabold text-lg tracking-wider text-slate-100 flex items-center gap-2">
            <Server className="w-5 h-5 text-primary" />
            TARGET DETAILS
          </span>
        </div>
        <div className="flex items-center gap-2 bg-white/5 py-1.5 px-3 rounded-full border border-white/5 text-xs text-slate-300 font-semibold">
          <span>Server ID: </span>
          <span className="font-mono text-slate-400">{id}</span>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 md:p-8 flex flex-col gap-8">
        
        {/* Server Header Info */}
        <div className="glass-panel p-6 rounded-3xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            <div className={`p-4 rounded-2xl border ${
              status === "ONLINE" 
                ? "bg-success/5 border-success/15 text-success" 
                : "bg-white/5 border-white/5 text-slate-400"
            }`}>
              <Server className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2.5">
                Target Node VPS
                <span className={`w-3 h-3 rounded-full ${
                  status === "ONLINE" ? "bg-success animate-pulse" : "bg-danger"
                }`}></span>
              </h1>
              <p className="text-sm text-slate-400 mt-0.5">Status: <span className="font-semibold">{status}</span></p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-right">
              <span className="text-[10px] text-slate-500 font-bold block tracking-wider uppercase">UPTIME</span>
              <span className="text-slate-200 font-semibold">
                {metrics ? formatUptime(metrics.uptimeSeconds) : "Offline"}
              </span>
            </div>
          </div>
        </div>

        {/* If OFFLINE: Display registration and installation script instructions */}
        {status === "OFFLINE" && (
          <div className="glass-panel p-6 rounded-3xl border-warning/15 bg-warning/[0.01]">
            <div className="flex gap-4 items-start">
              <div className="p-3 bg-warning/10 border border-warning/10 text-warning rounded-2xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-slate-200">Server Agent Offline</h3>
                <p className="text-sm text-slate-400 mt-1 max-w-xl">
                  This server node is not yet communicating with the panel. Install the background daemon agent on your target clean VPS (Ubuntu/Debian) to activate it.
                </p>

                <div className="mt-6">
                  <span className="text-xs font-bold text-slate-400 block mb-2 uppercase">Run this installer on your VPS:</span>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      readOnly 
                      value={installCommand}
                      className="flex-1 bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-xs font-mono text-slate-300 outline-none select-all"
                    />
                    <button 
                      onClick={() => navigator.clipboard.writeText(installCommand)}
                      className="px-4 bg-white/5 hover:bg-white/10 text-slate-300 border border-white/5 font-semibold text-xs rounded-xl transition"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Live Gauges Container */}
        {status === "ONLINE" && metrics && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* CPU Gauge */}
            <div className="glass-panel p-6 rounded-3xl flex flex-col items-center text-center">
              <div className="p-3 bg-primary/10 rounded-2xl text-primary mb-4">
                <Cpu className="w-6 h-6" />
              </div>
              <span className="text-xs text-slate-500 font-bold tracking-wider uppercase">CPU UTILIZATION</span>
              <span className="text-3xl font-extrabold text-slate-100 mt-2">{metrics.cpuPercent}%</span>
              {/* Simple progress track */}
              <div className="w-full bg-white/5 h-2 rounded-full mt-6 overflow-hidden">
                <div 
                  className="bg-primary h-full transition-all duration-1000" 
                  style={{ width: `${metrics.cpuPercent}%` }}
                ></div>
              </div>
            </div>

            {/* RAM Gauge */}
            <div className="glass-panel p-6 rounded-3xl flex flex-col items-center text-center">
              <div className="p-3 bg-accent/10 rounded-2xl text-accent mb-4">
                <Activity className="w-6 h-6" />
              </div>
              <span className="text-xs text-slate-500 font-bold tracking-wider uppercase">RAM CONSUMPTION</span>
              <span className="text-3xl font-extrabold text-slate-100 mt-2">
                {Math.round((metrics.ramUsedBytes / metrics.ramTotalBytes) * 100)}%
              </span>
              <span className="text-[10px] text-slate-400 mt-1 block">
                {formatBytes(metrics.ramUsedBytes)} / {formatBytes(metrics.ramTotalBytes)}
              </span>
              <div className="w-full bg-white/5 h-2 rounded-full mt-4 overflow-hidden">
                <div 
                  className="bg-accent h-full transition-all duration-1000" 
                  style={{ width: `${(metrics.ramUsedBytes / metrics.ramTotalBytes) * 100}%` }}
                ></div>
              </div>
            </div>

            {/* Disk Gauge */}
            <div className="glass-panel p-6 rounded-3xl flex flex-col items-center text-center">
              <div className="p-3 bg-success/10 rounded-2xl text-success mb-4">
                <HardDrive className="w-6 h-6" />
              </div>
              <span className="text-xs text-slate-500 font-bold tracking-wider uppercase">DISK CAPACITY</span>
              <span className="text-3xl font-extrabold text-slate-100 mt-2">
                {Math.round((metrics.diskUsedBytes / metrics.diskTotalBytes) * 100)}%
              </span>
              <span className="text-[10px] text-slate-400 mt-1 block">
                {formatBytes(metrics.diskUsedBytes)} / {formatBytes(metrics.diskTotalBytes)}
              </span>
              <div className="w-full bg-white/5 h-2 rounded-full mt-4 overflow-hidden">
                <div 
                  className="bg-success h-full transition-all duration-1000" 
                  style={{ width: `${(metrics.diskUsedBytes / metrics.diskTotalBytes) * 100}%` }}
                ></div>
              </div>
            </div>

          </div>
        )}

        {/* Projects / Status summary details */}
        {status === "ONLINE" && (
          <div className="glass-panel p-6 rounded-3xl">
            <h3 className="font-bold text-slate-200 mb-4 text-sm tracking-wider uppercase flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              Agent Security Metrics
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex justify-between items-center py-3 border-b border-white/5">
                <span className="text-sm text-slate-400">Connection Handshake</span>
                <span className="text-xs text-success bg-success/10 py-1 px-2.5 rounded-full border border-success/10 flex items-center gap-1.5 font-semibold">
                  <CheckCircle className="w-3.5 h-3.5" /> Secure TLS Link
                </span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-white/5">
                <span className="text-sm text-slate-400">WebSocket Ping Rate</span>
                <span className="text-xs text-slate-300 bg-white/5 py-1 px-2.5 rounded-full border border-white/5 font-mono">
                  10s interval telemetry
                </span>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
