import { Award, Medal, Trophy } from "lucide-react";
import type { LeaderboardEntry } from "../hooks/useRealtimeAssessment";

// ── Rank Badge ──────────────────────────────────────────────

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-amber-500/20">
        <Trophy className="h-4 w-4 text-amber-400" />
      </div>
    );
  }
  if (rank === 2) {
    return (
      <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-slate-300/10">
        <Medal className="h-4 w-4 text-slate-300" />
      </div>
    );
  }
  if (rank === 3) {
    return (
      <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-orange-500/15">
        <Award className="h-4 w-4 text-orange-400" />
      </div>
    );
  }
  return (
    <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-surface-700/40">
      <span className="text-xs font-bold text-surface-200">#{rank}</span>
    </div>
  );
}

// ── Score Pill ───────────────────────────────────────────────

function ScorePill({ score }: { score: number }) {
  const color =
    score >= 80
      ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25"
      : score >= 60
        ? "bg-amber-500/15 text-amber-400 border-amber-500/25"
        : "bg-red-500/15 text-red-400 border-red-500/25";

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold tabular-nums border ${color}`}>
      {Math.round(score)}
    </span>
  );
}

// ── Main Component ──────────────────────────────────────────

interface LeaderboardProps {
  entries: LeaderboardEntry[];
}

export function Leaderboard({ entries }: LeaderboardProps) {
  if (entries.length === 0) {
    return (
      <div className="glass p-8 text-center">
        <Trophy className="h-8 w-8 text-surface-700 mx-auto mb-3" />
        <p className="text-sm text-surface-200">
          No leaderboard entries yet. Upload a CAD file to compete!
        </p>
      </div>
    );
  }

  return (
    <div className="glass overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="px-5 py-3 border-b border-surface-700/50 flex items-center gap-2">
        <Trophy className="h-4 w-4 text-amber-400" />
        <span className="text-sm font-semibold text-white">Global Leaderboard</span>
        <span className="ml-auto text-xs text-surface-200">
          Top {entries.length}
        </span>
      </div>

      {/* Table */}
      <div className="divide-y divide-surface-700/30">
        {/* Column headers */}
        <div className="grid grid-cols-[auto_1fr_auto] gap-4 px-5 py-2 text-xs font-medium text-surface-200 uppercase tracking-wider">
          <span className="w-7 text-center">Rank</span>
          <span>User</span>
          <span>Score</span>
        </div>

        {/* Rows */}
        {entries.map((entry) => (
          <div
            key={`${entry.rank}-${entry.userId}`}
            className={`grid grid-cols-[auto_1fr_auto] gap-4 items-center px-5 py-3 transition-colors hover:bg-surface-700/20 ${
              entry.rank <= 3 ? "bg-surface-800/30" : ""
            }`}
          >
            <RankBadge rank={entry.rank} />
            <div className="min-w-0">
              <span className="text-sm text-white font-medium truncate block">
                {entry.userId.length > 16
                  ? `${entry.userId.slice(0, 8)}…${entry.userId.slice(-4)}`
                  : entry.userId}
              </span>
            </div>
            <ScorePill score={entry.score} />
          </div>
        ))}
      </div>
    </div>
  );
}
