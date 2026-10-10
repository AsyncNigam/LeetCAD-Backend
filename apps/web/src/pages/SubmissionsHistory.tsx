import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  FileCode,
  History,
} from "lucide-react";

// ── Types ───────────────────────────────────────────────────

interface SubmissionRecord {
  id: string;
  problemId: string;
  problemTitle: string;
  problemDifficulty: string;
  status: string;
  score: number | null;
  metrics: {
    volume: number;
    surfaceArea: number;
    centerOfMass: [number, number, number];
  } | null;
  createdAt: string;
}

const API_BASE = import.meta.env.VITE_API_URL || "/api";

// ── Helpers ─────────────────────────────────────────────────

function StatusBadge({ status, score }: { status: string; score: number | null }) {
  const isCompleted = status === "COMPLETED";
  const isPassed = isCompleted && score !== null && score >= 60;
  const isFailed = isCompleted && (score === null || score < 60);
  const isProcessing = status === "PROCESSING" || status === "UPLOADED";

  if (isPassed) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold px-2 py-1 rounded ring-1 ring-inset text-emerald-400 bg-emerald-400/10 ring-emerald-400/20">
        <CheckCircle2 className="h-3 w-3" /> Passed
      </span>
    );
  }
  if (isFailed) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold px-2 py-1 rounded ring-1 ring-inset text-rose-400 bg-rose-400/10 ring-rose-400/20">
        <XCircle className="h-3 w-3" /> Failed
      </span>
    );
  }
  if (isProcessing) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold px-2 py-1 rounded ring-1 ring-inset text-amber-400 bg-amber-400/10 ring-amber-400/20">
        <Loader2 className="h-3 w-3 animate-spin" /> Processing
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold px-2 py-1 rounded ring-1 ring-inset text-gray-400 bg-gray-400/10 ring-gray-400/20">
      <Clock className="h-3 w-3" /> {status}
    </span>
  );
}

function DifficultyBadge({ difficulty }: { difficulty: string }) {
  const color =
    difficulty === "EASY"
      ? "text-emerald-400 bg-emerald-400/10 ring-emerald-400/20"
      : difficulty === "HARD"
        ? "text-rose-400 bg-rose-400/10 ring-rose-400/20"
        : "text-amber-400 bg-amber-400/10 ring-amber-400/20";

  return (
    <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded ring-1 ring-inset ${color}`}>
      {difficulty}
    </span>
  );
}

function ScoreBar({ score }: { score: number | null }) {
  if (score === null) return <span className="text-text-faint text-xs">—</span>;
  const pct = Math.min(100, Math.max(0, score));
  const color =
    pct >= 80 ? "bg-emerald-500" : pct >= 60 ? "bg-amber-500" : "bg-rose-500";

  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-1.5 rounded-full bg-surface-subtle overflow-hidden">
        <div
          className={`h-full rounded-full ${color} transition-all duration-300`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-mono text-text-primary">{score}/100</span>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────

export function SubmissionsHistory() {
  const { token } = useAuth();
  const [submissions, setSubmissions] = useState<SubmissionRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE}/submissions/mine`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        setSubmissions(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch submissions:", err);
        setLoading(false);
      });
  }, [token]);

  return (
    <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 py-8 animate-fade-in">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <History className="h-5 w-5 text-brand-forest" />
          <h1 className="text-3xl font-bold text-text-primary tracking-tight">
            My Submissions
          </h1>
        </div>
        <p className="text-text-muted">
          Review your past CAD evaluation history and scores.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 text-brand-mint animate-spin" />
        </div>
      ) : submissions.length === 0 ? (
        <div className="panel text-center py-16">
          <FileCode className="h-10 w-10 text-text-faint mx-auto mb-4" />
          <p className="text-text-muted text-sm">
            No submissions yet. Head to a challenge and upload your first CAD file!
          </p>
        </div>
      ) : (
        <div className="panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-subtle">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-text-muted uppercase tracking-wider">Problem</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-text-muted uppercase tracking-wider">Difficulty</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-text-muted uppercase tracking-wider">Status</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-text-muted uppercase tracking-wider">Score</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-text-muted uppercase tracking-wider">Submitted</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((s) => (
                  <tr
                    key={s.id}
                    className="border-b border-border/50 hover:bg-surface-subtle/50 transition-colors"
                  >
                    <td className="py-3 px-4 text-text-primary font-medium">{s.problemTitle}</td>
                    <td className="py-3 px-4"><DifficultyBadge difficulty={s.problemDifficulty} /></td>
                    <td className="py-3 px-4"><StatusBadge status={s.status} score={s.score} /></td>
                    <td className="py-3 px-4"><ScoreBar score={s.score} /></td>
                    <td className="py-3 px-4 text-text-muted text-xs">
                      {new Date(s.createdAt).toLocaleString()}
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
