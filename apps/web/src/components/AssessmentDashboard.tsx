import { useState } from "react";
import {
  AlertCircle,
  Box,
  CheckCircle2,
  Cpu,
  FileImage,
  Loader2,
  Maximize2,
  Ruler,
  Target,
  Upload,
} from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { AssessmentCompletedPayload } from "@leetcad/shared-types";
import type { SubmissionPhase } from "../hooks/useRealtimeAssessment";

// ── S3 URL builder ──────────────────────────────────────────

const S3_ENDPOINT = import.meta.env.VITE_S3_ENDPOINT || "http://localhost:9000";
const S3_BUCKET = import.meta.env.VITE_S3_BUCKET || "leetcad";

function s3Url(key: string): string {
  return `${S3_ENDPOINT}/${S3_BUCKET}/${key}`;
}

// ── Status Badge ────────────────────────────────────────────

function StatusBadge({ phase }: { phase: SubmissionPhase }) {
  switch (phase) {
    case "UPLOADED":
      return <span className="pill-muted">UPLOADED</span>;
    case "PROCESSING":
    case "EVALUATING":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border border-brand-forest text-brand-forest">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand-forest animate-pulse-slow" />
          {phase}
        </span>
      );
    case "COMPLETED":
      return <span className="pill-mint">COMPLETED</span>;
    case "FAILED":
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-800 border border-red-200">
          FAILED
        </span>
      );
    default:
      return <span className="pill-muted">{phase}</span>;
  }
}

// ── Score Gauge ─────────────────────────────────────────────

function ScoreGauge({ score }: { score: number }) {
  const tier =
    score >= 80 ? "high" : score >= 60 ? "mid" : "low";

  const colors = {
    high: "text-brand-mint-dark border-brand-mint-dark/20 bg-brand-mint",
    mid: "text-amber-700 border-amber-200 bg-amber-50",
    low: "text-red-700 border-red-200 bg-red-50",
  };

  return (
    <div className={`inline-flex flex-col items-center gap-1.5 p-6 rounded-xl border ${colors[tier]}`}>
      <span className="text-5xl font-bold tabular-nums font-mono">{Math.round(score)}</span>
      <span className="text-[10px] font-mono uppercase tracking-widest opacity-70">
        Quality Score
      </span>
    </div>
  );
}

// ── Pipeline Stepper ────────────────────────────────────────

const PIPELINE_STEPS: { key: SubmissionPhase; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "UPLOADED", label: "Uploaded", icon: Upload },
  { key: "PROCESSING", label: "Geometry Analysis", icon: Cpu },
  { key: "EVALUATING", label: "AI Evaluation", icon: Target },
  { key: "COMPLETED", label: "Completed", icon: CheckCircle2 },
];

const PHASE_ORDER: SubmissionPhase[] = ["UPLOADED", "PROCESSING", "EVALUATING", "COMPLETED", "FAILED"];

function PipelineStepper({ phase }: { phase: SubmissionPhase }) {
  const currentIndex = PHASE_ORDER.indexOf(phase);
  const isFailed = phase === "FAILED";

  return (
    <div className="bg-surface-subtle rounded-xl p-4 border border-border">
      <div className="flex items-center justify-between gap-2">
        {PIPELINE_STEPS.map((step, i) => {
          const Icon = step.icon;
          const isDone = currentIndex > i;
          const isActive = step.key === phase;
          const isCurrent = isActive && !isFailed;

          return (
            <div key={step.key} className="flex items-center gap-2 flex-1">
              <div
                className={`flex items-center justify-center h-8 w-8 rounded-lg shrink-0 transition-all duration-300 ${
                  isDone
                    ? "bg-brand-mint text-brand-mint-dark"
                    : isCurrent
                      ? "bg-brand-forest/10 text-brand-forest"
                      : "bg-canvas text-text-faint border border-border"
                }`}
              >
                {isCurrent ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isDone ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
              </div>
              <span
                className={`text-xs font-medium hidden sm:block ${
                  isDone
                    ? "text-brand-mint-dark"
                    : isCurrent
                      ? "text-text-primary"
                      : "text-text-faint"
                }`}
              >
                {step.label}
              </span>
              {i < PIPELINE_STEPS.length - 1 && (
                <div
                  className={`flex-1 h-px mx-2 ${
                    isDone ? "bg-brand-mint-dark/30" : "bg-border"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {isFailed && (
        <div className="mt-4 flex items-center gap-2 p-3 rounded-md bg-red-50 border border-red-200">
          <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
          <span className="text-sm text-red-800">Assessment failed. Please try re-uploading the file.</span>
        </div>
      )}
    </div>
  );
}

// ── Metric Card ─────────────────────────────────────────────

function MetricCard({
  icon: Icon,
  label,
  value,
  unit,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  unit?: string;
}) {
  return (
    <div className="bg-canvas rounded-lg p-4 border border-border animate-fade-in">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-3.5 w-3.5 text-text-muted" />
        <span className="text-xs uppercase tracking-wider text-text-muted">{label}</span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="metric-value text-lg">{value}</span>
        {unit && <span className="text-xs text-text-muted">{unit}</span>}
      </div>
    </div>
  );
}

// ── Render Card ─────────────────────────────────────────────

function RenderCard({ renderUrls }: { renderUrls: string[] }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const url = renderUrls[0] ? s3Url(renderUrls[0]) : null;

  return (
    <div className="panel overflow-hidden">
      <div className="px-4 py-3 bg-surface-subtle border-b border-border flex items-center gap-2">
        <FileImage className="h-4 w-4 text-text-muted" />
        <span className="text-sm font-semibold text-text-primary">3D Model Render</span>
      </div>
      <div className="cad-viewport relative aspect-video rounded-none flex items-center justify-center">
        {url && !error ? (
          <>
            {!loaded && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="h-8 w-8 text-text-faint/40 animate-spin" />
              </div>
            )}
            <img
              src={url}
              alt="CAD model render"
              className={`w-full h-full object-contain transition-opacity duration-300 ${
                loaded ? "opacity-100" : "opacity-0"
              }`}
              onLoad={() => setLoaded(true)}
              onError={() => setError(true)}
            />
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 text-text-faint/50">
            <FileImage className="h-12 w-12" />
            <span className="text-xs font-mono">Render not available</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Engineering Report ──────────────────────────────────────

function EngineeringReport({ reportKey }: { reportKey: string }) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch markdown report from S3
  useState(() => {
    const url = s3Url(reportKey);
    fetch(url)
      .then((res) => (res.ok ? res.text() : Promise.reject(new Error("Failed to load report"))))
      .then(setContent)
      .catch(() => setContent("*Report could not be loaded.*"))
      .finally(() => setLoading(false));
  });

  return (
    <div className="panel overflow-hidden">
      <div className="px-4 py-3 bg-surface-subtle border-b border-border flex items-center gap-2">
        <Target className="h-4 w-4 text-text-muted" />
        <span className="text-sm font-semibold text-text-primary">Engineering Review</span>
      </div>
      <div className="p-5 max-h-[500px] overflow-y-auto">
        {loading ? (
          <div className="flex items-center gap-2 text-text-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading report…</span>
          </div>
        ) : (
          <div className="panel-subtle border-dashed p-5">
            <div className="prose prose-sm max-w-none
              prose-headings:text-brand-forest prose-headings:font-semibold
              prose-p:text-text-primary prose-p:leading-relaxed
              prose-strong:text-text-primary
              prose-code:text-brand-forest prose-code:bg-surface-subtle prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs
              prose-li:text-text-primary prose-li:marker:text-text-faint
              prose-hr:border-border
              prose-a:text-brand-forest prose-a:no-underline hover:prose-a:underline
              prose-table:border-border prose-th:text-text-primary prose-td:text-text-primary"
            >
              <Markdown remarkPlugins={[remarkGfm]}>{content ?? ""}</Markdown>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Dashboard ──────────────────────────────────────────

interface AssessmentDashboardProps {
  phase: SubmissionPhase | null;
  assessment: AssessmentCompletedPayload | null;
  submissionId: string | null;
}

export function AssessmentDashboard({ phase, assessment, submissionId }: AssessmentDashboardProps) {
  if (!phase || !submissionId) return null;

  const isComplete = phase === "COMPLETED" && assessment;

  return (
    <div className="panel divide-y divide-border animate-slide-up">
      {/* ── Header ────────────────────────────────── */}
      <div className="bg-surface-subtle px-5 py-4 flex items-center justify-between rounded-t-xl">
        <div>
          <h3 className="text-xl font-bold text-brand-forest">Assessment Pipeline</h3>
          <span className="font-mono text-xs text-text-faint">{submissionId}</span>
        </div>
        <StatusBadge phase={phase} />
      </div>

      {/* ── Stepper ───────────────────────────────── */}
      <div className="p-5">
        <PipelineStepper phase={phase} />
      </div>

      {/* ── In-progress message ───────────────────── */}
      {!isComplete && phase !== "FAILED" && (
        <div className="flex items-center justify-center gap-3 px-5 py-10">
          <Loader2 className="h-5 w-5 text-brand-forest animate-spin" />
          <span className="text-text-muted text-sm">
            {phase === "UPLOADED" && "Submission received. Queued for processing…"}
            {phase === "PROCESSING" && "Running CadQuery geometry analysis & PyVista rendering…"}
            {phase === "EVALUATING" && "Gemini Vision AI is evaluating your design…"}
          </span>
        </div>
      )}

      {/* ── Completed Results ─────────────────────── */}
      {isComplete && (
        <>
          {/* Score + Metrics */}
          <div className="p-5">
            <div className="flex flex-col lg:flex-row gap-5">
              <div className="flex items-center justify-center lg:justify-start shrink-0">
                <ScoreGauge score={assessment.score} />
              </div>
              <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-3">
                <MetricCard
                  icon={Box}
                  label="Volume"
                  value={assessment.metrics.volume.toFixed(1)}
                  unit="mm³"
                />
                <MetricCard
                  icon={Ruler}
                  label="Surface Area"
                  value={assessment.metrics.surfaceArea.toFixed(1)}
                  unit="mm²"
                />
                <MetricCard
                  icon={Target}
                  label="Center of Mass"
                  value={assessment.metrics.centerOfMass.map((v) => v.toFixed(1)).join(", ")}
                />
                <MetricCard
                  icon={Maximize2}
                  label="SV Ratio"
                  value={
                    assessment.metrics.surfaceArea > 0
                      ? (assessment.metrics.volume / assessment.metrics.surfaceArea).toFixed(3)
                      : "N/A"
                  }
                />
              </div>
            </div>
          </div>

          {/* Render + Report */}
          <div className="p-5">
            <div className="grid lg:grid-cols-2 gap-5">
              <RenderCard renderUrls={assessment.renderUrls} />
              <EngineeringReport reportKey={assessment.aiReportId} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
