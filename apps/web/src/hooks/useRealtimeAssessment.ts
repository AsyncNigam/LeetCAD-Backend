import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type { AssessmentCompletedPayload } from "@leetcad/shared-types";

// ── Types ───────────────────────────────────────────────────

export type ConnectionStatus = "connecting" | "connected" | "disconnected" | "error";

export type SubmissionPhase =
  | "UPLOADED"
  | "PROCESSING"
  | "EVALUATING"
  | "COMPLETED"
  | "FAILED";

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  score: number;
}

export interface RealtimeState {
  connectionStatus: ConnectionStatus;
  phase: SubmissionPhase | null;
  assessment: AssessmentCompletedPayload | null;
  leaderboard: LeaderboardEntry[];
}

// ── Hook ────────────────────────────────────────────────────

const REALTIME_URL = import.meta.env.VITE_REALTIME_URL || "http://localhost:3001";
const POLL_INTERVAL_MS = 3000; // Poll every 3 seconds as fallback

export function useRealtimeAssessment(
  token: string | null,
  activeSubmissionId: string | null,
) {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("disconnected");
  const [phase, setPhase] = useState<SubmissionPhase | null>(null);
  const [assessment, setAssessment] = useState<AssessmentCompletedPayload | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

  const socketRef = useRef<Socket | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Helper: handle a completed/failed assessment
  const handleAssessmentResult = useCallback(
    (payload: AssessmentCompletedPayload) => {
      if (!activeSubmissionId || payload.submissionId === activeSubmissionId) {
        setAssessment(payload);
        setPhase(payload.status === "FAILED" ? "FAILED" : "COMPLETED");

        // Stop polling once we have a result
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      }
    },
    [activeSubmissionId],
  );

  // Reset phase when a new submission starts tracking
  useEffect(() => {
    if (activeSubmissionId) {
      setPhase("UPLOADED");
      setAssessment(null);

      // Simulate processing phase after a brief delay (the real event
      // would come from the backend; this provides immediate visual feedback)
      const t1 = setTimeout(() => setPhase("PROCESSING"), 1500);
      const t2 = setTimeout(() => setPhase("EVALUATING"), 8000);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
  }, [activeSubmissionId]);

  // ── Polling fallback ──────────────────────────────────────
  // Polls /api/submissions/:id every few seconds until status is COMPLETED/FAILED
  useEffect(() => {
    if (!token || !activeSubmissionId) return;

    const poll = async () => {
      try {
        const res = await fetch(`/api/submissions/${activeSubmissionId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;

        const data = await res.json();
        if (data.status === "COMPLETED" || data.status === "FAILED") {
          // Build an AssessmentCompletedPayload from the DB row
          const payload: AssessmentCompletedPayload = {
            submissionId: data.id,
            userId: data.userId,
            status: data.status,
            score: data.score ?? 0,
            aiReportId: data.aiReportId ?? "",
            metrics: data.metrics
              ? typeof data.metrics === "string"
                ? JSON.parse(data.metrics)
                : data.metrics
              : { volume: 0, surfaceArea: 0, centerOfMass: [0, 0, 0] },
            renderUrls: data.aiReportId
              ? [`renders/${data.id}.png`]
              : [],
          };
          handleAssessmentResult(payload);
        }
      } catch {
        // Silent fail — polling is best-effort
      }
    };

    // Start polling after a short delay (give WebSocket a chance first)
    const startDelay = setTimeout(() => {
      poll(); // Initial poll
      pollRef.current = setInterval(poll, POLL_INTERVAL_MS);
    }, 5000);

    return () => {
      clearTimeout(startDelay);
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [token, activeSubmissionId, handleAssessmentResult]);

  // ── Socket.io connection lifecycle ────────────────────────
  useEffect(() => {
    if (!token) {
      setConnectionStatus("disconnected");
      return;
    }

    setConnectionStatus("connecting");
    const socket = io(REALTIME_URL, {
      auth: { token },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("[realtime] WebSocket connected");
      setConnectionStatus("connected");
    });

    socket.on("connect_error", (err) => {
      console.warn("[realtime] WebSocket connect error:", err.message);
      setConnectionStatus("error");
    });

    socket.on("disconnect", () => {
      setConnectionStatus("disconnected");
    });

    socket.on("assessment.completed", (payload: AssessmentCompletedPayload) => {
      console.log("[realtime] assessment.completed received via WS:", payload);
      handleAssessmentResult(payload);
    });

    socket.on("leaderboard.updated", (entries: LeaderboardEntry[]) => {
      setLeaderboard(entries);
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, handleAssessmentResult]);

  const resetAssessment = useCallback(() => {
    setPhase(null);
    setAssessment(null);
  }, []);

  return {
    connectionStatus,
    phase,
    assessment,
    leaderboard,
    resetAssessment,
  };
}
