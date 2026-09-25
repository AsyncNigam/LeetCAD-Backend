import { Trophy } from "lucide-react";
import type { LeaderboardEntry } from "../hooks/useRealtimeAssessment";

// ── Rank Badge ──────────────────────────────────────────────

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <span className="inline-flex items-center justify-center h-7 min-w-[1.75rem] px-2 py-1 rounded-md bg-yellow-50 text-yellow-800 border border-yellow-200 font-mono text-xs font-bold">
        1
      </span>
    );
  }
  if (rank === 2) {
    return (
      <span className="inline-flex items-center justify-center h-7 min-w-[1.75rem] px-2 py-1 rounded-md bg-slate-50 text-slate-800 border border-slate-200 font-mono text-xs font-bold">
        2
      </span>
    );
  }
  if (rank === 3) {
    return (
      <span className="inline-flex items-center justify-center h-7 min-w-[1.75rem] px-2 py-1 rounded-md bg-orange-50 text-orange-800 border border-orange-200 font-mono text-xs font-bold">
        3
      </span>
    );
  }
  return (
    <span className="inline-flex items-center justify-center h-7 min-w-[1.75rem] text-text-muted font-mono text-sm">
      {rank}
    </span>
  );
}

// ── Score Cell ───────────────────────────────────────────────

function ScoreCell({ score }: { score: number }) {
  const rounded = Math.round(score);

  if (score >= 80) {
    return <span className="pill-mint">{rounded}</span>;
  }

  return (
    <span className="metric-value text-sm">{rounded}</span>
  );
}

// ── Main Component ──────────────────────────────────────────

interface LeaderboardProps {
  entries: LeaderboardEntry[];
}

export function Leaderboard({ entries }: LeaderboardProps) {
  if (entries.length === 0) {
    return (
      <div className="panel">
        <div className="bg-canvas border border-border rounded-xl p-10 text-center">
          <Trophy className="h-8 w-8 text-text-faint mx-auto mb-3" />
          <p className="text-sm text-text-muted">
            No submissions yet. Be the first to run an analysis.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="panel overflow-hidden animate-fade-in">
      {/* ── Header ────────────────────────────────── */}
      <div className="bg-surface-subtle px-5 py-4 border-b border-border flex items-center gap-2.5">
        <Trophy className="h-4 w-4 text-brand-forest" />
        <h3 className="text-lg font-bold text-brand-forest">Global Rankings</h3>
        <span className="inline-flex items-center gap-1.5 ml-2 text-[10px] font-mono text-brand-forest uppercase tracking-widest">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand-forest animate-pulse-slow" />
          Live
        </span>
        <span className="ml-auto text-xs text-text-faint font-mono">
          {entries.length} {entries.length === 1 ? "entry" : "entries"}
        </span>
      </div>

      {/* ── Table ─────────────────────────────────── */}
      <table className="w-full">
        <thead>
          <tr className="bg-canvas">
            <th className="w-16 px-5 py-2.5 text-left text-xs uppercase tracking-wider text-text-muted font-semibold">
              Rank
            </th>
            <th className="px-4 py-2.5 text-left text-xs uppercase tracking-wider text-text-muted font-semibold">
              Engineer
            </th>
            <th className="w-24 px-5 py-2.5 text-right text-xs uppercase tracking-wider text-text-muted font-semibold">
              Score
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {entries.map((entry) => (
            <tr
              key={`${entry.rank}-${entry.userId}`}
              className="bg-surface hover:bg-surface-subtle transition-colors"
            >
              <td className="px-5 py-3">
                <RankBadge rank={entry.rank} />
              </td>
              <td className="px-4 py-3">
                <span className="text-sm font-medium text-text-primary truncate block">
                  {entry.userId.length > 16
                    ? `${entry.userId.slice(0, 8)}…${entry.userId.slice(-4)}`
                    : entry.userId}
                </span>
              </td>
              <td className="px-5 py-3 text-right">
                <ScoreCell score={entry.score} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
