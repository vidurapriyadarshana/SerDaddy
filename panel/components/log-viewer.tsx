"use client";

import { useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';

interface LogViewerProps {
  logs: string;
  socket?: any; // Socket.io socket client instance
  deploymentId?: string;
}

export default function LogViewer({ logs, socket, deploymentId }: LogViewerProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminalInstance = useRef<Terminal | null>(null);
  const fitAddonInstance = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!terminalRef.current) return;

    // Initialize Terminal
    const term = new Terminal({
      theme: {
        background: '#0e0e16',
        foreground: '#e2e8f0',
        cursor: '#6366f1',
        black: '#000000',
        red: '#ef4444',
        green: '#10b981',
        yellow: '#f59e0b',
        blue: '#3b82f6',
        magenta: '#6366f1',
        cyan: '#00ffcc',
        white: '#ffffff',
      },
      fontFamily: 'Consolas, "Courier New", monospace',
      fontSize: 12,
      lineHeight: 1.25,
      cursorBlink: true,
      convertEol: true, 
      rows: 24,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    term.open(terminalRef.current);
    fitAddon.fit();

    terminalInstance.current = term;
    fitAddonInstance.current = fitAddon;

    // Load initial buffer contents
    if (logs) {
      term.write(logs);
    }

    // Setup active listeners for socket.io logs streaming
    if (socket && deploymentId) {
      const handleLog = (data: { deploymentId: string; chunk: string }) => {
        if (data.deploymentId === deploymentId) {
          term.write(data.chunk);
        }
      };

      socket.on('deploy:log', handleLog);

      return () => {
        socket.off('deploy:log', handleLog);
      };
    }

    return () => {
      term.dispose();
    };
  }, [logs, socket, deploymentId]);

  // Track window sizing changes and fit terminal columns
  useEffect(() => {
    const handleResize = () => {
      if (fitAddonInstance.current) {
        fitAddonInstance.current.fit();
      }
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <div className="w-full rounded-2xl overflow-hidden border border-white/5 bg-[#0e0e16] p-4 shadow-2xl">
      <div className="flex items-center justify-between border-b border-white/5 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 bg-[#ef4444] rounded-full"></span>
          <span className="w-2.5 h-2.5 bg-[#f59e0b] rounded-full"></span>
          <span className="w-2.5 h-2.5 bg-[#10b981] rounded-full"></span>
          <span className="text-xs font-mono text-slate-500 font-bold ml-2">Console Session Output</span>
        </div>
      </div>
      <div ref={terminalRef} className="w-full min-h-[300px]" />
    </div>
  );
}
