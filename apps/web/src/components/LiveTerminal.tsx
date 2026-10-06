import { useEffect, useState, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { Terminal } from "lucide-react";

interface LiveTerminalProps {
  submissionId: string | null;
}

interface TerminalLog {
  id: string;
  timestamp: string;
  message: string;
  status?: string;
  score?: number;
}

const SOCKET_URL = import.meta.env.VITE_WS_URL || "https://leetcad.me";

export function LiveTerminal({ submissionId }: LiveTerminalProps) {
  const [logs, setLogs] = useState<TerminalLog[]>([]);
  const socketRef = useRef<Socket | null>(null);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Reset logs if submission changes
    setLogs([]);
    if (!submissionId) return;

    // Connect to WebSocket Gateway
    const socket = io(SOCKET_URL, {
      transports: ["websocket"],
      reconnectionAttempts: 5,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setLogs((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          message: `[System] Connected to assessment cluster. Subscribing to submission ${submissionId.substring(0, 8)}...`,
        },
      ]);
      socket.emit("subscribe_to_submission", { submissionId });
    });

    socket.on("terminal.log", (payload: any) => {
      setLogs((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          message: `[Engine] Event received for submission: ${payload.submissionId}`,
          status: payload.status,
          score: payload.score,
        },
      ]);
    });

    socket.on("connect_error", (err) => {
      setLogs((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          message: `[System] Connection error: ${err.message}`,
          status: "FAILED",
        },
      ]);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [submissionId]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  if (!submissionId) return null;

  return (
    <div className="w-full flex flex-col rounded-xl border border-neutral-800 bg-[#0a0a0a] shadow-xl overflow-hidden mt-8 animate-fade-in">
      {/* Terminal Header */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-[#141414] border-b border-neutral-800">
        <Terminal className="h-4 w-4 text-neutral-400" />
        <span className="text-xs font-medium text-neutral-400 font-mono uppercase tracking-wider">
          Execution Logs
        </span>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-neutral-700" />
            <div className="w-2.5 h-2.5 rounded-full bg-neutral-700" />
            <div className="w-2.5 h-2.5 rounded-full bg-neutral-700" />
          </div>
        </div>
      </div>

      {/* Terminal Body */}
      <div className="flex-1 h-64 p-4 overflow-y-auto font-mono text-[13px] leading-relaxed custom-scrollbar">
        {logs.map((log) => {
          let colorClass = "text-emerald-400"; // default success-ish green

          if (log.status === "FAILED_KERNEL_PANIC" || log.status === "FAILED") {
            colorClass = "text-rose-500 font-bold";
          } else if (log.status === "COMPLETED") {
            colorClass = "text-blue-400 font-bold";
          } else if (log.message.includes("[System]")) {
            colorClass = "text-neutral-400";
          }

          const timeString = new Date(log.timestamp).toLocaleTimeString([], {
            hour12: false,
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          });

          return (
            <div key={log.id} className="flex items-start gap-3 hover:bg-white/5 py-0.5 rounded px-1 -mx-1 transition-colors break-all">
              <span className="text-neutral-600 shrink-0 select-none">[{timeString}]</span>
              <span className={`${colorClass} flex-1`}>
                {log.message}
                {log.status ? ` (Status: ${log.status})` : ""}
                {log.score !== undefined ? ` (Score: ${log.score}/100)` : ""}
              </span>
            </div>
          );
        })}
        {logs.length === 0 && (
          <div className="text-neutral-500 italic">Waiting for execution engine...</div>
        )}
        <div ref={terminalEndRef} />
      </div>
    </div>
  );
}
