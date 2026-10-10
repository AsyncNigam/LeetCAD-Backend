import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Terminal, Copy, Check, Key } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || "/api";

export function DeveloperSettings() {
  const { token } = useAuth();
  const [cliToken, setCliToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCliToken = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/auth/cli-token`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        throw new Error("Failed to generate CLI token");
      }
      const data = await res.json();
      setCliToken(data.cliToken);
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (cliToken) {
      navigator.clipboard.writeText(cliToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="max-w-4xl mx-auto w-full px-4 sm:px-6 py-8 animate-fade-in">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <Terminal className="h-5 w-5 text-brand-forest" />
          <h1 className="text-3xl font-bold text-text-primary tracking-tight">
            Developer Settings
          </h1>
        </div>
        <p className="text-text-muted">
          Manage your CLI integration and developer API keys.
        </p>
      </div>

      <div className="panel p-6 mb-8">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
              <Key className="h-4 w-4 text-brand-forest" />
              CLI Integration Token
            </h2>
            <p className="text-sm text-text-muted mt-1">
              Generate a long-lived token to authenticate the LeetCAD CLI tool on your local machine.
            </p>
          </div>
          {!cliToken && (
            <button
              onClick={fetchCliToken}
              disabled={loading}
              className="btn-primary"
            >
              {loading ? "Generating..." : "Generate Token"}
            </button>
          )}
        </div>

        {error && (
          <div className="p-3 mb-4 rounded bg-red-50 text-red-700 text-sm border border-red-200">
            {error}
          </div>
        )}

        {cliToken && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Your Token</span>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 p-3 bg-surface-subtle border border-border rounded-lg text-xs text-text-primary font-mono break-all">
                {cliToken}
              </code>
              <button
                onClick={copyToClipboard}
                className="btn-ghost flex-shrink-0 !p-3"
                title="Copy to clipboard"
              >
                {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4 text-text-muted" />}
              </button>
            </div>
          </div>
        )}

        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-text-primary mb-2">1. Login to CLI</h3>
            <p className="text-xs text-text-muted mb-2">
              Run this command in your terminal and paste your token when prompted, or pass it directly:
            </p>
            <div className="relative group">
              <pre className="p-4 bg-cad-viewport border border-border rounded-lg overflow-x-auto text-xs text-text-primary font-mono">
                {`npx @nigam_developer/leetcad login ${cliToken ? cliToken : "<PASTE_YOUR_TOKEN_HERE>"}`}
              </pre>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-text-primary mb-2">2. Submit a Problem</h3>
            <p className="text-xs text-text-muted mb-2">
              Submit your local CAD file directly to a challenge for evaluation:
            </p>
            <div className="relative group">
              <pre className="p-4 bg-cad-viewport border border-border rounded-lg overflow-x-auto text-xs text-text-primary font-mono">
                {`npx @nigam_developer/leetcad submit <problem-slug> ./file.step`}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
