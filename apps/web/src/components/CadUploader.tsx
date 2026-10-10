import { useCallback, useRef, useState, type DragEvent } from "react";
import {
  AlertCircle,
  CheckCircle2,
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

interface CadUploaderProps {
  problemId: string;
  onSubmissionCreated?: (submissionId: string) => void;
}

// ── Constants ───────────────────────────────────────────────

const API_BASE = import.meta.env.VITE_API_URL || "/api";


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
  fields: Record<string, string>,
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

export function CadUploader({ problemId, onSubmissionCreated }: CadUploaderProps) {
  const { token } = useAuth();

  const [phase, setPhase] = useState<UploadPhase>("IDLE");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SubmissionResult | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

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

      if (!problemId) {
        setError("Missing problem statement ID.");
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
        const presignRes = await fetch(`${API_BASE}/storage/presigned-url`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            filename: selectedFile.name,
            contentType: selectedFile.type || "application/octet-stream",
            problemId: problemId,
          }),
        });

        if (!presignRes.ok) {
          if (presignRes.status === 401 || presignRes.status === 403) {
            throw new Error("Unauthorized: Invalid or expired session.");
          }
          const body = await presignRes.json().catch(() => ({}));
          throw new Error(body.message || `Failed to get upload URL (${presignRes.status})`);
        }

        const { url: uploadUrl, fields, fileKey } = await presignRes.json();

        // Step 2: Direct POST to storage
        setPhase("UPLOADING_TO_STORAGE");
        await putToStorage(uploadUrl, fields, selectedFile, setProgress);

        // Step 3: Notify backend with problemId
        setPhase("NOTIFYING_BACKEND");
        const completeRes = await fetch(`${API_BASE}/submissions/complete`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ fileKey, problemId: problemId }),
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
    [token, problemId, onSubmissionCreated],
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
  const dropzoneDisabled = !problemId;
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
    <div className="w-full mx-auto animate-fade-in">
      {/* ── IDLE / ERROR: Dropzone ── */}
      {(phase === "IDLE" || phase === "ERROR") && (
        <div className="flex flex-col w-full h-48">
          {/* ── Dropzone ─────────────────────────── */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={dropzoneDisabled ? (e) => { e.preventDefault(); setError("Missing problem statement ID."); setPhase("ERROR"); } : handleDrop}
            onClick={dropzoneDisabled ? () => { setError("Missing problem statement ID."); setPhase("ERROR"); } : () => inputRef.current?.click()}
            className={`relative flex flex-col items-center justify-center w-full h-full p-8
              border-dashed border-2 rounded-xl transition-colors cursor-pointer
              ${dropzoneDisabled
                ? "border-border/50 bg-surface opacity-50 cursor-not-allowed"
                : isDragOver
                  ? "border-brand-forest bg-brand-mint/30"
                  : "border-border bg-surface hover:border-border-strong drafting-grid"
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
              strokeWidth={1.5}
              className={`h-8 w-8 mb-4 transition-colors ${
                dropzoneDisabled
                  ? "text-text-faint/40"
                  : isDragOver ? "text-brand-forest" : "text-text-muted"
              }`}
            />

            <div className="text-center">
              <p className={`text-sm font-medium tracking-tight mb-1 ${
                dropzoneDisabled ? "text-text-faint" : "text-text-primary"
              }`}>
                {dropzoneDisabled
                  ? "Unable to upload"
                  : isDragOver
                    ? "Drop file to upload"
                    : "Select or drop CAD file"}
              </p>
              <p className="text-xs text-text-muted tracking-tight">
                <span className="font-mono text-text-primary">.step</span>,{" "}
                <span className="font-mono text-text-primary">.stp</span>,{" "}
                <span className="font-mono text-text-primary">.stl</span> up to 50MB
              </p>
            </div>
          </div>

          {/* Error Banner */}
          {phase === "ERROR" && error && (
            <div className="flex items-start gap-3 mt-4 p-4 rounded-xl bg-red-50 border border-red-200 animate-fade-in shrink-0">
              <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-red-800 tracking-tight">{error}</p>
              </div>
              <button
                onClick={reset}
                className="text-xs text-red-600 hover:text-red-800 font-medium tracking-tight transition-colors"
              >
                Reset
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── PROCESSING: Upload Progress ─────────────── */}
      {isProcessing && (
        <div className="panel p-6 space-y-6 animate-fade-in">
          {/* File info */}
          {file && (
            <div className="flex items-center gap-3 p-4 rounded-lg bg-surface-subtle border border-border">
              <FileCode className="h-5 w-5 text-brand-forest shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-mono text-sm text-text-primary truncate tracking-tight">{file.name}</p>
                <p className="text-xs text-text-muted tracking-tight mt-0.5">{formatBytes(file.size)}</p>
              </div>
              <Loader2 className="h-4 w-4 text-brand-forest animate-spin shrink-0" />
            </div>
          )}

          {/* Progress bar */}
          {phase === "UPLOADING_TO_STORAGE" && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-text-muted tracking-tight uppercase">
                  {PHASE_MONO[phase]}: {progress}%
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-surface-subtle border border-border overflow-hidden">
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
              <Loader2 className="h-4 w-4 text-brand-forest animate-spin" />
              <span className="text-xs font-medium text-text-muted tracking-tight uppercase">
                {PHASE_MONO[phase]}
              </span>
            </div>
          )}

          {/* Step indicators */}
          <div className="space-y-3 pt-4 border-t border-border">
            {steps.map((label, i) => {
              const isActive = i === stepIndex;
              const isDone = i < stepIndex;
              return (
                <div key={label} className="flex items-center gap-3">
                  {isDone ? (
                    <CheckCircle2 className="h-4 w-4 text-brand-mint-dark shrink-0" />
                  ) : isActive ? (
                    <Loader2 className="h-4 w-4 text-brand-forest animate-spin shrink-0" />
                  ) : (
                    <div className="h-4 w-4 rounded-full border border-border shrink-0" />
                  )}
                  <span
                    className={`text-sm tracking-tight ${
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
        <div className="panel p-8 space-y-6 animate-fade-in flex flex-col justify-center">
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="rounded-full p-4 bg-brand-mint/20 border border-brand-mint">
              <CheckCircle2 className="h-6 w-6 text-brand-mint-dark" />
            </div>
            <div className="text-center">
              <p className="text-lg font-medium tracking-tight text-text-primary">Upload Complete</p>
              <p className="text-sm text-text-muted tracking-tight mt-1">
                Your CAD file is queued for AI assessment.
              </p>
            </div>
          </div>

          {/* Submission details */}
          <div className="rounded-lg bg-surface-subtle border border-border p-5 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-muted tracking-tight">Submission ID</span>
              <span className="font-mono text-xs text-brand-forest">{result.id}</span>
            </div>
            {file && (
              <div className="flex items-center justify-between text-sm pt-3 border-t border-border">
                <span className="text-text-muted tracking-tight">File</span>
                <span className="text-text-primary font-mono text-xs truncate max-w-[180px]">{file.name}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-sm pt-3 border-t border-border">
              <span className="text-text-muted tracking-tight">Status</span>
              <span className="pill-mint">{result.status}</span>
            </div>
          </div>

          <button onClick={reset} className="btn-primary w-full mt-2">
            <RotateCcw className="h-4 w-4" />
            Upload Another File
          </button>
        </div>
      )}
    </div>
  );
}
