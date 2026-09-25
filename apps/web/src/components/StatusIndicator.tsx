import type { ConnectionStatus } from "../hooks/useRealtimeAssessment";

interface StatusIndicatorProps {
  status: ConnectionStatus;
}

export function StatusIndicator({ status }: StatusIndicatorProps) {
  const isConnected = status === "connected";

  return (
    <div className="flex items-center gap-2">
      <span
        className={`inline-block h-1.5 w-1.5 rounded-full ${
          isConnected
            ? "bg-emerald-500"
            : "bg-amber-400 animate-pulse-slow"
        }`}
      />
      <span
        className={`text-xs font-mono uppercase tracking-wider ${
          isConnected
            ? "text-brand-forest"
            : "text-text-muted"
        }`}
      >
        {isConnected ? "Engine Online" : "Offline"}
      </span>
    </div>
  );
}
