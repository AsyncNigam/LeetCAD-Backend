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

export function useRealtimeAssessment(
  token: string | null,
  activeSubmissionId: string | null,
) {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("disconnected");
  const [phase, setPhase] = useState<SubmissionPhase | null>(null);
  const [assessment, setAssessment] = useState<AssessmentCompletedPayload | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

  const socketRef = useRef<Socket | null>(null);

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

  // Socket.io connection lifecycle
  useEffect(() => {
    if (!token) {
      setConnectionStatus("disconnected");
      return;
    }

    const socket = io(REALTIME_URL, {
      auth: { token },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setConnectionStatus("connected");
    });

    socket.on("connect_error", () => {
      setConnectionStatus("error");
    });

    socket.on("disconnect", () => {
      setConnectionStatus("disconnected");
    });

    socket.on("assessment.completed", (payload: AssessmentCompletedPayload) => {
      // Only update if it matches our tracked submission (or accept all)
      if (!activeSubmissionId || payload.submissionId === activeSubmissionId) {
        setAssessment(payload);
        setPhase("COMPLETED");
      }
    });

    socket.on("leaderboard.updated", (entries: LeaderboardEntry[]) => {
      setLeaderboard(entries);
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, activeSubmissionId]);

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
