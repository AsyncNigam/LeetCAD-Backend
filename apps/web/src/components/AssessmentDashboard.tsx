import { useState } from "react";
import {
  AlertCircle,
  Box,
  CheckCircle2,
  Cpu,
  FileCode,
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

// ── Score Gauge ─────────────────────────────────────────────

function ScoreGauge({ score }: { score: number }) {
  const color =
    score >= 80
      ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
      : score >= 60
        ? "text-amber-400 border-amber-500/30 bg-amber-500/10"
        : "text-red-400 border-red-500/30 bg-red-500/10";

  const glowColor =
    score >= 80
      ? "shadow-emerald-500/20"
      : score >= 60
        ? "shadow-amber-500/20"
        : "shadow-red-500/20";

  return (
    <div className={`inline-flex flex-col items-center gap-2 p-6 rounded-2xl border ${color} shadow-lg ${glowColor}`}>
      <span className="text-5xl font-bold tabular-nums">{Math.round(score)}</span>
      <span className="text-xs font-medium uppercase tracking-wider opacity-80">
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
    <div className="glass p-5">
      <div className="flex items-center justify-between gap-2">
        {PIPELINE_STEPS.map((step, i) => {
          const Icon = step.icon;
          const isDone = currentIndex > i;
          const isActive = step.key === phase;
          const isCurrent = isActive && !isFailed;

          return (
            <div key={step.key} className="flex items-center gap-2 flex-1">
              <div
                className={`flex items-center justify-center h-9 w-9 rounded-lg shrink-0 transition-all duration-300 ${
                  isDone
                    ? "bg-emerald-500/20 text-emerald-400"
                    : isCurrent
                      ? "bg-brand-600/20 text-brand-400"
                      : "bg-surface-700/40 text-surface-700"
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
                    ? "text-emerald-400"
                    : isCurrent
                      ? "text-white"
                      : "text-surface-700"
                }`}
              >
                {step.label}
              </span>
              {i < PIPELINE_STEPS.length - 1 && (
                <div
                  className={`flex-1 h-px mx-2 ${
                    isDone ? "bg-emerald-500/40" : "bg-surface-700/50"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {isFailed && (
        <div className="mt-4 flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/25">
          <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
          <span className="text-sm text-red-400">Assessment failed. Please try re-uploading the file.</span>
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
    <div className="glass p-4 animate-fade-in">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-4 w-4 text-brand-400" />
        <span className="text-xs font-medium text-surface-200 uppercase tracking-wider">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-xl font-bold text-white font-mono">{value}</span>
        {unit && <span className="text-xs text-surface-200">{unit}</span>}
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
    <div className="glass overflow-hidden">
      <div className="px-4 py-3 border-b border-surface-700/50 flex items-center gap-2">
        <FileCode className="h-4 w-4 text-brand-400" />
        <span className="text-sm font-medium text-white">3D Model Render</span>
      </div>
      <div className="relative aspect-video bg-surface-900 flex items-center justify-center">
        {url && !error ? (
          <>
            {!loaded && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="h-8 w-8 text-surface-700 animate-spin" />
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
          <div className="flex flex-col items-center gap-2 text-surface-700">
            <Box className="h-12 w-12" />
            <span className="text-xs">Render not available</span>
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
    <div className="glass overflow-hidden">
      <div className="px-4 py-3 border-b border-surface-700/50 flex items-center gap-2">
        <Target className="h-4 w-4 text-brand-400" />
        <span className="text-sm font-medium text-white">Engineering Review</span>
      </div>
      <div className="p-5 max-h-[500px] overflow-y-auto">
        {loading ? (
          <div className="flex items-center gap-2 text-surface-200">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading report…</span>
          </div>
        ) : (
          <div className="prose prose-invert prose-sm max-w-none
            prose-headings:text-white prose-headings:font-semibold
            prose-p:text-surface-200 prose-p:leading-relaxed
            prose-strong:text-white
            prose-code:text-brand-400 prose-code:bg-surface-700/50 prose-code:px-1 prose-code:py-0.5 prose-code:rounded
            prose-li:text-surface-200
            prose-hr:border-surface-700/50
            prose-a:text-brand-400 prose-a:no-underline hover:prose-a:underline
            prose-table:border-surface-700 prose-th:text-surface-100 prose-td:text-surface-200"
          >
            <Markdown remarkPlugins={[remarkGfm]}>{content ?? ""}</Markdown>
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
    <div className="space-y-6 animate-slide-up">
      {/* Pipeline stepper */}
      <PipelineStepper phase={phase} />

      {/* In-progress message */}
      {!isComplete && phase !== "FAILED" && (
        <div className="flex items-center justify-center gap-3 py-8">
          <Loader2 className="h-5 w-5 text-brand-400 animate-spin" />
          <span className="text-surface-200">
            {phase === "UPLOADED" && "Submission received. Queued for processing…"}
            {phase === "PROCESSING" && "Running CadQuery geometry analysis & PyVista rendering…"}
            {phase === "EVALUATING" && "Gemini Vision AI is evaluating your design…"}
          </span>
        </div>
      )}

      {/* Completed results */}
      {isComplete && (
        <div className="space-y-6">
          {/* Score + Metrics row */}
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Score */}
            <div className="flex items-center justify-center lg:justify-start">
              <ScoreGauge score={assessment.score} />
            </div>

            {/* Metrics grid */}
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

          {/* Render + Report row */}
          <div className="grid lg:grid-cols-2 gap-6">
            <RenderCard renderUrls={assessment.renderUrls} />
            <EngineeringReport reportKey={assessment.aiReportId} />
          </div>
        </div>
      )}
    </div>
  );
}
