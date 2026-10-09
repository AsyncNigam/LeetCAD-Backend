import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ChevronRight, Database, Ruler } from "lucide-react";

type Problem = {
  id: string;
  title: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  description: string;
  targetVolume: number;
  tolerance: number;
};

const API_BASE = import.meta.env.VITE_API_URL || "/api";

/** Convert a problem title to a URL-friendly slug */
function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function ProblemList() {
  const [problems, setProblems] = useState<Problem[]>([]);
  const [loading, setLoading] = useState(true);
  const { token } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetch(`${API_BASE}/problems`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => {
        setProblems(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch problems", err);
        setLoading(false);
      });
  }, [token]);

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "EASY": return "text-emerald-400 bg-emerald-400/10 ring-emerald-400/20";
      case "MEDIUM": return "text-amber-400 bg-amber-400/10 ring-amber-400/20";
      case "HARD": return "text-rose-400 bg-rose-400/10 ring-rose-400/20";
      default: return "text-gray-400 bg-gray-400/10 ring-gray-400/20";
    }
  };

  return (
    <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 py-8 animate-fade-in">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-text-primary tracking-tight mb-2">Challenge Library</h1>
        <p className="text-text-muted">Select an engineering challenge to begin your automated CAD review.</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-brand-mint border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {problems.map((problem) => (
            <div
              key={problem.id}
              onClick={() => navigate(`/problems/${slugify(problem.title)}`)}
              className="panel-hover p-5 cursor-pointer group flex flex-col"
            >
              <div className="flex justify-between items-start mb-3">
                <h3 className="font-semibold text-lg text-text-primary group-hover:text-brand-mint transition-colors">
                  {problem.title}
                </h3>
                <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded ring-1 ring-inset ${getDifficultyColor(problem.difficulty)}`}>
                  {problem.difficulty}
                </span>
              </div>
              <p className="text-sm text-text-muted line-clamp-3 mb-6 flex-1">
                {problem.description}
              </p>
              
              <div className="flex items-center gap-4 text-xs text-text-faint pt-4 border-t border-border mt-auto">
                <div className="flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5" />
                  <span>{problem.targetVolume.toLocaleString()} mm³</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Ruler className="w-3.5 h-3.5" />
                  <span>±{(problem.tolerance * 100).toFixed(1)}%</span>
                </div>
                <div className="ml-auto">
                  <ChevronRight className="w-4 h-4 text-border-strong group-hover:text-brand-mint transition-colors" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
