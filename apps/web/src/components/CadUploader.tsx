import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  FileCode,
  Loader2,
  RotateCcw,
  UploadCloud,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

// ── Types ───────────────────────────────────────────────────

type UploadPhase =
  | "IDLE"
  | "REQUESTING_URL"
  | "UPLOADING_TO_STORAGE"
  | "NOTIFYING_BACKEND"
  | "UPLOAD_SUCCESS"
  | "ERROR";

interface SubmissionResult {
  id: string;
  fileKey: string;
  status: string;
  createdAt: string;
}

interface ProblemOption {
  id: string;
  title: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  description: string;
  targetVolume: number;
  tolerance: number;
}

interface CadUploaderProps {
  onSubmissionCreated?: (submissionId: string) => void;
}

// ── Constants ───────────────────────────────────────────────

const ALLOWED_EXTENSIONS = [".step", ".stp", ".stl"];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

const PHASE_MONO: Record<UploadPhase, string> = {
  IDLE: "READY",
  REQUESTING_URL: "REQUESTING PRESIGNED URL",
  UPLOADING_TO_STORAGE: "STREAMING TO S3",
  NOTIFYING_BACKEND: "REGISTERING SUBMISSION",
  UPLOAD_SUCCESS: "COMPLETE",
  ERROR: "ERROR",
};

const DIFFICULTY_BADGE: Record<string, { bg: string; text: string; border: string }> = {
  EASY: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  MEDIUM: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  HARD: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
};

// ── Helpers ─────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function getExtension(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot >= 0 ? filename.slice(dot).toLowerCase() : "";
}

function validateFile(file: File): string | null {
  const ext = getExtension(file.name);
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return `Invalid file format "${ext}". Upload .step, .stp, or .stl files.`;
  }
  if (file.size > MAX_FILE_SIZE) {
    return `File exceeds 50 MB limit (${formatBytes(file.size)}).`;
  }
  return null;
}

// ── Upload with XHR (for progress) ──────────────────────────

function putToStorage(
  url: string,
  file: File,
  onProgress: (pct: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url, true);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Storage upload failed (HTTP ${xhr.status})`));
      }
    });

    xhr.addEventListener("error", (evt: ProgressEvent) => {
      console.error("UPLOAD E2E FAILURE [Phase 2 – XHR PUT]:", {
        type: evt.type,
        loaded: evt.loaded,
        total: evt.total,
        targetUrl: url,
        readyState: xhr.readyState,
        status: xhr.status,
        statusText: xhr.statusText,
      });
      reject(new Error("Network error during storage upload"));
    });
    xhr.addEventListener("abort", () => reject(new Error("Storage upload aborted")));

    xhr.send(file);
  });
}

// ── Component ───────────────────────────────────────────────

export function CadUploader({ onSubmissionCreated }: CadUploaderProps) {
  const { token } = useAuth();

  const [phase, setPhase] = useState<UploadPhase>("IDLE");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SubmissionResult | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // ── Problem Selector State ──────────────────────────────
  const [problems, setProblems] = useState<ProblemOption[]>([]);
  const [selectedProblemId, setSelectedProblemId] = useState<string>("");
  const [problemsLoading, setProblemsLoading] = useState(true);

  const inputRef = useRef<HTMLInputElement>(null);

  // ── Fetch problems on mount ─────────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function fetchProblems() {
      try {
        const res = await fetch("/api/problems");
        if (res.ok) {
          const data: ProblemOption[] = await res.json();
          if (!cancelled) {
            setProblems(data);
            // Auto-select if only one problem exists
            if (data.length === 1) {
              setSelectedProblemId(data[0].id);
            }
          }
        }
      } catch (err) {
        console.warn("Failed to fetch problems:", err);
      } finally {
        if (!cancelled) setProblemsLoading(false);
      }
    }
    fetchProblems();
    return () => { cancelled = true; };
  }, []);

  const selectedProblem = problems.find((p) => p.id === selectedProblemId);

  const reset = useCallback(() => {
    setPhase("IDLE");
    setFile(null);
    setProgress(0);
    setError(null);
    setResult(null);
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  const startUpload = useCallback(
    async (selectedFile: File) => {
      if (!token) {
        setError("Authentication session expired. Please log in again.");
        setPhase("ERROR");
        return;
      }

      if (!selectedProblemId) {
        setError("Please select a problem statement before uploading.");
        setPhase("ERROR");
        return;
      }

      const validationError = validateFile(selectedFile);
      if (validationError) {
        setError(validationError);
        setPhase("ERROR");
        return;
      }

      setFile(selectedFile);
      setError(null);
      setProgress(0);

      try {
        // Step 1: Request presigned URL
        setPhase("REQUESTING_URL");
        const presignRes = await fetch("/api/storage/presigned-url", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            filename: selectedFile.name,
            contentType: selectedFile.type || "application/octet-stream",
            problemId: selectedProblemId,
          }),
        });

        if (!presignRes.ok) {
          if (presignRes.status === 401 || presignRes.status === 403) {
            throw new Error("Unauthorized: Invalid or expired session.");
          }
          const body = await presignRes.json().catch(() => ({}));
          throw new Error(body.message || `Failed to get upload URL (${presignRes.status})`);
        }

        const { url: uploadUrl, fileKey } = await presignRes.json();

        // Step 2: Direct PUT to storage
        setPhase("UPLOADING_TO_STORAGE");
        await putToStorage(uploadUrl, selectedFile, setProgress);

        // Step 3: Notify backend with problemId
        setPhase("NOTIFYING_BACKEND");
        const completeRes = await fetch("/api/submissions/complete", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ fileKey, problemId: selectedProblemId }),
        });

        if (!completeRes.ok) {
          if (completeRes.status === 401 || completeRes.status === 403) {
            throw new Error("Unauthorized: Invalid or expired session.");
          }
          const body = await completeRes.json().catch(() => ({}));
          throw new Error(body.message || `Failed to register submission (${completeRes.status})`);
        }

        const submission: SubmissionResult = await completeRes.json();
        setResult(submission);
        setPhase("UPLOAD_SUCCESS");
        onSubmissionCreated?.(submission.id);
      } catch (err) {
        console.error("UPLOAD E2E FAILURE:", {
          phase,
          error: err,
          message: err instanceof Error ? err.message : String(err),
          fileName: selectedFile.name,
          fileSize: selectedFile.size,
        });
        setError(err instanceof Error ? err.message : "Upload failed");
        setPhase("ERROR");
      }
    },
    [token, selectedProblemId, onSubmissionCreated],
  );

  // ── Drag & Drop Handlers ──────────────────────────────────

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      const dropped = e.dataTransfer.files[0];
      if (dropped) startUpload(dropped);
    },
    [startUpload],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = e.target.files?.[0];
      if (selected) startUpload(selected);
    },
    [startUpload],
  );

  // ── Derived state ─────────────────────────────────────────

  const isProcessing = ["REQUESTING_URL", "UPLOADING_TO_STORAGE", "NOTIFYING_BACKEND"].includes(phase);
  const dropzoneDisabled = !selectedProblemId;
  const stepIndex =
    phase === "REQUESTING_URL" ? 0
      : phase === "UPLOADING_TO_STORAGE" ? 1
        : phase === "NOTIFYING_BACKEND" ? 2
          : phase === "UPLOAD_SUCCESS" ? 3 : -1;

  const steps = [
    "Generating secure upload channel",
    "Streaming directly to storage",
    "Registering submission",
  ];

  // ── Render ────────────────────────────────────────────────

  return (
    <div className="w-full max-w-2xl mx-auto animate-fade-in">
      {/* ── IDLE / ERROR: Problem Selector + Dropzone ── */}
      {(phase === "IDLE" || phase === "ERROR") && (
        <div className="space-y-4">
          {/* ── Problem Selector ──────────────────── */}
          <div className="space-y-2">
            <label
              htmlFor="problem-select"
              className="block text-xs font-mono text-text-muted uppercase tracking-wider"
            >
              Problem Statement
            </label>
            <div className="relative">
              <select
                id="problem-select"
                value={selectedProblemId}
                onChange={(e) => {
                  setSelectedProblemId(e.target.value);
                  if (error === "Please select a problem statement before uploading.") {
                    setError(null);
                    setPhase("IDLE");
                  }
                }}
                disabled={problemsLoading}
                className={`
                  w-full appearance-none cursor-pointer
                  px-4 py-3 pr-10 rounded-xl
                  bg-surface border border-border
                  text-sm text-text-primary font-medium
                  transition-all duration-200
                  hover:border-border-strong
                  focus:outline-none focus:ring-2 focus:ring-brand-forest/20 focus:border-brand-forest
                  disabled:opacity-50 disabled:cursor-not-allowed
                  ${!selectedProblemId ? "text-text-faint" : ""}
                `}
              >
                <option value="">
                  {problemsLoading ? "Loading problems…" : "— Select a Problem —"}
                </option>
                {problems.map((p) => (
                  <option key={p.id} value={p.id}>
                    [{p.difficulty}] {p.title}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-faint pointer-events-none" />
            </div>

            {/* Selected problem details card */}
            {selectedProblem && (
              <div className="panel p-3 space-y-2 animate-fade-in">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                      DIFFICULTY_BADGE[selectedProblem.difficulty]?.bg ?? ""
                    } ${DIFFICULTY_BADGE[selectedProblem.difficulty]?.text ?? ""} ${
                      DIFFICULTY_BADGE[selectedProblem.difficulty]?.border ?? ""
                    }`}
                  >
                    {selectedProblem.difficulty}
                  </span>
                  <span className="text-sm font-semibold text-text-primary">
                    {selectedProblem.title}
                  </span>
                </div>
                <p className="text-xs text-text-muted leading-relaxed">
                  {selectedProblem.description}
                </p>
                <div className="flex items-center gap-4 pt-1 border-t border-border">
                  <span className="text-[10px] font-mono text-text-faint">
                    TARGET VOL: <span className="text-text-primary">{selectedProblem.targetVolume.toFixed(1)} mm³</span>
                  </span>
                  <span className="text-[10px] font-mono text-text-faint">
                    TOLERANCE: <span className="text-text-primary">±{selectedProblem.tolerance} mm³</span>
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* ── Dropzone ─────────────────────────── */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={dropzoneDisabled ? (e) => { e.preventDefault(); setError("Please select a problem statement before uploading."); setPhase("ERROR"); } : handleDrop}
            onClick={dropzoneDisabled ? () => { setError("Please select a problem statement before uploading."); setPhase("ERROR"); } : () => inputRef.current?.click()}
            className={`relative flex flex-col items-center justify-center gap-4 p-12
              rounded-xl cursor-pointer
              border-2 border-dashed
              transition-all duration-200
              ${dropzoneDisabled
                ? "border-border/50 opacity-60 cursor-not-allowed"
                : isDragOver
                  ? "border-brand-forest bg-brand-mint/30 shadow-md"
                  : "drafting-grid border-border hover:border-border-strong"
              }`}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".step,.stp,.stl"
              onChange={handleFileSelect}
              className="hidden"
              disabled={dropzoneDisabled}
            />

            <UploadCloud
              className={`h-10 w-10 transition-colors ${
                dropzoneDisabled
                  ? "text-text-faint/40"
                  : isDragOver ? "text-brand-forest" : "text-text-faint"
              }`}
            />

            <div className="text-center">
              <p className={`text-xl font-semibold mb-1 ${
                dropzoneDisabled ? "text-text-faint" : "text-brand-forest"
              }`}>
                {dropzoneDisabled
                  ? "Select a problem first"
                  : isDragOver
                    ? "Drop your CAD model here"
                    : "Drop your CAD model here"}
              </p>
              <p className="text-sm text-text-muted">
                Supports{" "}
                <span className="font-mono text-text-primary">.step</span>{" "}
                <span className="font-mono text-text-primary">.stp</span>{" "}
                <span className="font-mono text-text-primary">.stl</span>{" "}
                up to 50 MB
              </p>
            </div>
          </div>

          {/* Error Banner */}
          {phase === "ERROR" && error && (
            <div className="flex items-start gap-3 p-4 rounded-md bg-red-50 border border-red-200 animate-fade-in">
              <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-red-800">{error}</p>
              </div>
              <button
                onClick={reset}
                className="btn-ghost !px-2 !py-1 text-xs text-red-600 hover:text-red-800"
              >
                Reset
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── PROCESSING: Upload Progress ─────────────── */}
      {isProcessing && (
        <div className="panel p-6 space-y-5 animate-fade-in">
          {/* File info */}
          {file && (
            <div className="flex items-center gap-3 p-3 rounded-md bg-surface-subtle">
              <FileCode className="h-5 w-5 text-brand-forest shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-mono text-sm text-text-primary truncate">{file.name}</p>
                <p className="text-xs text-text-muted">{formatBytes(file.size)}</p>
              </div>
              <Loader2 className="h-4 w-4 text-brand-forest animate-spin shrink-0" />
            </div>
          )}

          {/* Progress bar */}
          {phase === "UPLOADING_TO_STORAGE" && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-mono text-text-muted uppercase tracking-wider">
                  {PHASE_MONO[phase]}: {progress}%
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-surface-subtle overflow-hidden">
                <div
                  className="h-full rounded-full bg-brand-forest transition-all duration-300 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Phase label for non-upload steps */}
          {phase !== "UPLOADING_TO_STORAGE" && (
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="h-3.5 w-3.5 text-brand-forest animate-spin" />
              <span className="text-xs font-mono text-text-muted uppercase tracking-wider">
                {PHASE_MONO[phase]}
              </span>
            </div>
          )}

          {/* Step indicators */}
          <div className="space-y-2 pt-2 border-t border-border">
            {steps.map((label, i) => {
              const isActive = i === stepIndex;
              const isDone = i < stepIndex;
              return (
                <div key={label} className="flex items-center gap-2.5">
                  {isDone ? (
                    <CheckCircle2 className="h-4 w-4 text-brand-mint-dark shrink-0" />
                  ) : isActive ? (
                    <Loader2 className="h-4 w-4 text-brand-forest animate-spin shrink-0" />
                  ) : (
                    <div className="h-4 w-4 rounded-full border border-border shrink-0" />
                  )}
                  <span
                    className={`text-sm ${
                      isDone
                        ? "text-brand-mint-dark"
                        : isActive
                          ? "text-text-primary font-medium"
                          : "text-text-faint"
                    }`}
                  >
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── SUCCESS: Submission Created ─────────────── */}
      {phase === "UPLOAD_SUCCESS" && result && (
        <div className="panel p-6 space-y-5 animate-fade-in">
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="rounded-full p-3 bg-brand-mint">
              <CheckCircle2 className="h-8 w-8 text-brand-mint-dark" />
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold text-text-primary">Upload Complete</p>
              <p className="text-sm text-text-muted mt-1">
                Your CAD file is now queued for AI assessment.
              </p>
            </div>
          </div>

          {/* Submission details */}
          <div className="rounded-md bg-surface-subtle p-4 space-y-2.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-muted">Submission ID</span>
              <span className="font-mono text-xs text-brand-forest">{result.id}</span>
            </div>
            {selectedProblem && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-text-muted">Problem</span>
                <span className="text-text-primary text-xs">{selectedProblem.title}</span>
              </div>
            )}
            {file && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-text-muted">File</span>
                <span className="text-text-primary font-mono text-xs truncate max-w-[200px]">{file.name}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-muted">Status</span>
              <span className="pill-mint">{result.status}</span>
            </div>
          </div>

          <button onClick={reset} className="btn-primary w-full">
            <RotateCcw className="h-4 w-4" />
            Upload Another File
          </button>
        </div>
      )}
    </div>
  );
}
