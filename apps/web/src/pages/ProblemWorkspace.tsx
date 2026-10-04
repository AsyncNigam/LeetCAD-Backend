import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ChevronLeft, Database, Ruler, Target } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CadUploader } from "../components/CadUploader";
import { AssessmentDashboard } from "../components/AssessmentDashboard";
import { useRealtimeAssessment } from "../hooks/useRealtimeAssessment";
import { LiveTerminal } from "../components/LiveTerminal";

type Problem = {
  id: string;
  title: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  description: string;
  targetVolume: number;
  tolerance: number;
};

export function ProblemWorkspace() {
  const { id } = useParams<{ id: string }>();
  const [problem, setProblem] = useState<Problem | null>(null);
  const [loading, setLoading] = useState(true);
  const { token } = useAuth();
  const navigate = useNavigate();

  const [activeSubmissionId, setActiveSubmissionId] = useState<string | null>(null);

  const {
    phase,
    assessment,
  } = useRealtimeAssessment(token, activeSubmissionId);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetch(`/api/problems/${id}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => {
        if (!r.ok) throw new Error("Not found");
        return r.json();
      })
      .then(data => {
        setProblem(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch problem", err);
        navigate("/problems");
      });
  }, [id, token, navigate]);

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "EASY": return "text-emerald-400 bg-emerald-400/10 ring-emerald-400/20 ring-1 ring-inset";
      case "MEDIUM": return "text-amber-400 bg-amber-400/10 ring-amber-400/20 ring-1 ring-inset";
      case "HARD": return "text-rose-400 bg-rose-400/10 ring-rose-400/20 ring-1 ring-inset";
      default: return "text-gray-400 bg-gray-400/10 ring-gray-400/20 ring-1 ring-inset";
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 h-screen w-screen flex justify-center items-center bg-canvas">
        <div className="w-8 h-8 border-2 border-brand-mint border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!problem) return null;

  return (
    <div className="h-screen w-full flex overflow-hidden bg-canvas text-text-primary fixed inset-0 z-50">
      {/* ── Left Pane: Problem Details ──────────────────────────── */}
      <div className="w-full md:w-1/2 border-r border-border overflow-y-auto flex flex-col relative custom-scrollbar">
        {/* Header */}
        <div className="p-8 md:p-12 pb-6 border-b border-border sticky top-0 bg-canvas/95 backdrop-blur z-10">
          <button 
            onClick={() => navigate("/problems")}
            className="flex items-center gap-1.5 text-xs font-semibold text-text-muted hover:text-text-primary mb-6 transition-colors tracking-wider uppercase"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Library
          </button>
          <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-4">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-text-primary">
              {problem.title}
            </h1>
            <span className={`text-[10px] uppercase font-bold px-2.5 py-1 rounded-sm whitespace-nowrap mt-2 xl:mt-0 ${getDifficultyColor(problem.difficulty)}`}>
              {problem.difficulty}
            </span>
          </div>
        </div>

        {/* Specifications */}
        <div className="p-8 md:p-12 py-8 border-b border-border bg-surface-subtle">
          <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-4 flex items-center gap-2">
            <Target className="w-4 h-4" />
            Constraints
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-5 bg-canvas border-none shadow-sm rounded-xl">
              <div className="flex items-center gap-2 text-text-muted mb-2">
                <Database className="w-4 h-4" />
                <span className="text-xs font-medium tracking-wide">Target Volume</span>
              </div>
              <p className="text-xl font-mono text-text-primary tracking-tight">{problem.targetVolume.toLocaleString()} <span className="text-sm text-text-muted font-sans tracking-normal">mm³</span></p>
            </div>
            <div className="p-5 bg-canvas border-none shadow-sm rounded-xl">
              <div className="flex items-center gap-2 text-text-muted mb-2">
                <Ruler className="w-4 h-4" />
                <span className="text-xs font-medium tracking-wide">Tolerance</span>
              </div>
              <p className="text-xl font-mono text-text-primary tracking-tight">±{(problem.tolerance * 100).toFixed(1)}%</p>
            </div>
          </div>
        </div>

        {/* Description Markdown */}
        <div className="p-8 md:p-12 flex-1 prose prose-invert prose-brand max-w-none bg-canvas">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {problem.description}
          </ReactMarkdown>
        </div>
      </div>

      {/* ── Right Pane: Execution Environment ─────────────────── */}
      <div className="w-full md:w-1/2 overflow-y-auto flex flex-col bg-surface-subtle custom-scrollbar">
        <div className="flex-1 w-full flex flex-col gap-8 p-8 md:p-12">
          
          <div className="shrink-0">
            <CadUploader 
              problemId={problem.id} 
              onSubmissionCreated={setActiveSubmissionId} 
            />
            <LiveTerminal submissionId={activeSubmissionId} />
          </div>

          <div className="flex-1 min-h-[400px] flex flex-col">
            {activeSubmissionId ? (
              <AssessmentDashboard
                phase={phase}
                assessment={assessment}
                submissionId={activeSubmissionId}
              />
            ) : (
              <div className="flex-1 border-dashed border-2 border-border rounded-xl flex items-center justify-center bg-canvas/50">
                <div className="text-center p-8 max-w-xs">
                  <div className="w-12 h-12 rounded-full bg-canvas border border-border flex items-center justify-center mx-auto mb-4">
                    <Target className="w-5 h-5 text-text-muted" />
                  </div>
                  <p className="text-text-muted text-sm tracking-tight leading-relaxed">
                    Submit a valid CAD solution above to initialize the automated assessment engine.
                  </p>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
