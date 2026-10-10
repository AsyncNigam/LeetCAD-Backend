import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Trophy, Medal, Loader2, Award } from "lucide-react";

interface LeaderboardEntry {
  userId: string;
  userName: string;
  totalSolved: number;
  bestAvgScore: number;
  totalSubmissions: number;
}

const API_BASE = import.meta.env.VITE_API_URL || "/api";

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <div className="h-8 w-8 rounded-full bg-amber-100 border border-amber-300 flex items-center justify-center">
        <Trophy className="h-4 w-4 text-amber-600" />
      </div>
    );
  }
  if (rank === 2) {
    return (
      <div className="h-8 w-8 rounded-full bg-slate-100 border border-slate-300 flex items-center justify-center">
        <Medal className="h-4 w-4 text-slate-500" />
      </div>
    );
  }
  if (rank === 3) {
    return (
      <div className="h-8 w-8 rounded-full bg-orange-100 border border-orange-300 flex items-center justify-center">
        <Medal className="h-4 w-4 text-orange-700" />
      </div>
    );
  }
  return (
    <div className="h-8 w-8 rounded-full bg-surface-subtle border border-border flex items-center justify-center text-xs font-bold text-text-muted">
      #{rank}
    </div>
  );
}

export function Leaderboard() {
  const { token } = useAuth();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE}/leaderboard`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        setLeaderboard(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch leaderboard:", err);
        setLoading(false);
      });
  }, [token]);

  return (
    <div className="max-w-4xl mx-auto w-full px-4 sm:px-6 py-8 animate-fade-in">
      <div className="mb-8 flex flex-col items-center text-center">
        <div className="h-16 w-16 rounded-full bg-brand-forest/10 flex items-center justify-center mb-4">
          <Award className="h-8 w-8 text-brand-forest" />
        </div>
        <h1 className="text-3xl font-bold text-text-primary tracking-tight mb-2">
          Global Leaderboard
        </h1>
        <p className="text-text-muted max-w-lg">
          Rankings are based on total problems solved (score ≥ 60), tie-broken by average score across all submissions.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 text-brand-mint animate-spin" />
        </div>
      ) : leaderboard.length === 0 ? (
        <div className="panel text-center py-16">
          <Trophy className="h-10 w-10 text-text-faint mx-auto mb-4" />
          <p className="text-text-muted text-sm">
            No rankings yet. Be the first to solve a challenge!
          </p>
        </div>
      ) : (
        <div className="panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-subtle">
                  <th className="text-center py-4 px-4 w-16">Rank</th>
                  <th className="text-left py-4 px-4 text-xs font-semibold text-text-muted uppercase tracking-wider">Engineer</th>
                  <th className="text-center py-4 px-4 text-xs font-semibold text-text-muted uppercase tracking-wider">Solved</th>
                  <th className="text-center py-4 px-4 text-xs font-semibold text-text-muted uppercase tracking-wider">Avg Score</th>
                  <th className="text-center py-4 px-4 text-xs font-semibold text-text-muted uppercase tracking-wider hidden sm:table-cell">Submissions</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((entry, idx) => (
                  <tr
                    key={entry.userId}
                    className="border-b border-border/50 hover:bg-surface-subtle/50 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="flex justify-center">
                        <RankBadge rank={idx + 1} />
                      </div>
                    </td>
                    <td className="py-3 px-4 text-text-primary font-medium">{entry.userName}</td>
                    <td className="py-3 px-4 text-center font-bold text-brand-forest">
                      {entry.totalSolved}
                    </td>
                    <td className="py-3 px-4 text-center font-mono">
                      {entry.bestAvgScore.toFixed(1)}
                    </td>
                    <td className="py-3 px-4 text-center text-text-muted hidden sm:table-cell">
                      {entry.totalSubmissions}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
