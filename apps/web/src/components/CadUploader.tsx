import { useCallback, useRef, useState, type DragEvent } from "react";
import {
  AlertCircle,
  CheckCircle2,
  FileCode,
  Loader2,
  RotateCcw,
  UploadCloud,
  X,
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
  onSubmissionCreated?: (submissionId: string) => void;
}

// ── Constants ───────────────────────────────────────────────

const ALLOWED_EXTENSIONS = [".step", ".stp", ".stl"];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

const PHASE_LABELS: Record<UploadPhase, string> = {
  IDLE: "Ready to upload",
  REQUESTING_URL: "Generating secure upload channel…",
  UPLOADING_TO_STORAGE: "Streaming directly to storage (bypassing API)…",
  NOTIFYING_BACKEND: "Registering submission & outbox event…",
  UPLOAD_SUCCESS: "Upload complete!",
  ERROR: "Upload failed",
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

    xhr.addEventListener("error", () => reject(new Error("Network error during storage upload")));
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
        setError("Not authenticated. Please sign in first.");
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
          }),
        });

        if (!presignRes.ok) {
          const body = await presignRes.json().catch(() => ({}));
          throw new Error(body.message || `Failed to get upload URL (${presignRes.status})`);
        }

        const { url: uploadUrl, fileKey } = await presignRes.json();

        // Step 2: Direct PUT to storage
        setPhase("UPLOADING_TO_STORAGE");
        await putToStorage(uploadUrl, selectedFile, setProgress);

        // Step 3: Notify backend
        setPhase("NOTIFYING_BACKEND");
        const completeRes = await fetch("/api/submissions/complete", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ fileKey }),
        });

        if (!completeRes.ok) {
          const body = await completeRes.json().catch(() => ({}));
          throw new Error(body.message || `Failed to register submission (${completeRes.status})`);
        }

        const submission: SubmissionResult = await completeRes.json();
        setResult(submission);
        setPhase("UPLOAD_SUCCESS");
        onSubmissionCreated?.(submission.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
        setPhase("ERROR");
      }
    },
    [token, onSubmissionCreated],
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
      <div className="glass p-6">
        {/* Dropzone */}
        {(phase === "IDLE" || phase === "ERROR") && (
          <>
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
              className={`relative flex flex-col items-center justify-center gap-4 p-10
                border-2 border-dashed rounded-xl cursor-pointer
                transition-all duration-200
                ${isDragOver
                  ? "border-brand-400 bg-brand-600/10 scale-[1.01]"
                  : "border-surface-700 hover:border-surface-200/40 hover:bg-surface-800/40"
                }`}
            >
              <input
                ref={inputRef}
                type="file"
                accept=".step,.stp,.stl"
                onChange={handleFileSelect}
                className="hidden"
              />

              <div
                className={`rounded-2xl p-4 transition-colors ${
                  isDragOver
                    ? "bg-brand-600/20 text-brand-400"
                    : "bg-surface-700/40 text-surface-200"
                }`}
              >
                <UploadCloud className="h-8 w-8" />
              </div>

              <div className="text-center">
                <p className="text-sm font-medium text-white mb-1">
                  {isDragOver ? "Drop your CAD file here" : "Drag & drop a CAD file, or click to browse"}
                </p>
                <p className="text-xs text-surface-200">
                  Accepts <span className="font-mono text-brand-400">.step</span>{" "}
                  <span className="font-mono text-brand-400">.stp</span>{" "}
                  <span className="font-mono text-brand-400">.stl</span>{" "}
                  up to 50 MB
                </p>
              </div>
            </div>

            {/* Error Banner */}
            {phase === "ERROR" && error && (
              <div className="mt-4 flex items-start gap-3 p-3 rounded-lg bg-red-500/10 border border-red-500/25 animate-fade-in">
                <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-red-400">{error}</p>
                </div>
                <button onClick={reset} className="text-red-400 hover:text-red-300">
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
          </>
        )}

        {/* Upload In-Progress */}
        {isProcessing && (
          <div className="space-y-5 animate-fade-in">
            {/* File info */}
            {file && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-surface-700/30">
                <FileCode className="h-5 w-5 text-brand-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{file.name}</p>
                  <p className="text-xs text-surface-200">{formatBytes(file.size)}</p>
                </div>
                <Loader2 className="h-4 w-4 text-brand-400 animate-spin shrink-0" />
              </div>
            )}

            {/* Progress bar */}
            {phase === "UPLOADING_TO_STORAGE" && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-surface-200">Uploading…</span>
                  <span className="text-xs font-mono text-brand-400">{progress}%</span>
                </div>
                <div className="h-2 rounded-full bg-surface-700 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-400 transition-all duration-300 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Step indicators */}
            <div className="space-y-2">
              {steps.map((label, i) => {
                const isActive = i === stepIndex;
                const isDone = i < stepIndex;
                return (
                  <div key={label} className="flex items-center gap-2.5">
                    {isDone ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    ) : isActive ? (
                      <Loader2 className="h-4 w-4 text-brand-400 animate-spin shrink-0" />
                    ) : (
                      <div className="h-4 w-4 rounded-full border border-surface-700 shrink-0" />
                    )}
                    <span
                      className={`text-sm ${
                        isDone
                          ? "text-emerald-400"
                          : isActive
                            ? "text-white font-medium"
                            : "text-surface-700"
                      }`}
                    >
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>

            <p className="text-xs text-surface-200 text-center">
              {PHASE_LABELS[phase]}
            </p>
          </div>
        )}

        {/* Success State */}
        {phase === "UPLOAD_SUCCESS" && result && (
          <div className="space-y-5 animate-fade-in">
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="rounded-full p-3 bg-emerald-500/15">
                <CheckCircle2 className="h-8 w-8 text-emerald-400" />
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold text-white">Upload Complete</p>
                <p className="text-sm text-surface-200 mt-1">
                  Your CAD file is now queued for AI assessment.
                </p>
              </div>
            </div>

            {/* Submission details */}
            <div className="rounded-lg bg-surface-700/30 p-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-surface-200">Submission ID</span>
                <span className="font-mono text-xs text-brand-400">{result.id}</span>
              </div>
              {file && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-surface-200">File</span>
                  <span className="text-white truncate max-w-[200px]">{file.name}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-sm">
                <span className="text-surface-200">Status</span>
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/15 text-amber-400 border border-amber-500/25">
                  {result.status}
                </span>
              </div>
            </div>

            <button
              onClick={reset}
              className="btn-primary w-full"
            >
              <RotateCcw className="h-4 w-4" />
              Upload Another File
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
