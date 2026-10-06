import { useState, useEffect } from "react";
import { Loader2, LogIn } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export function AuthCard() {
  const { isLoading, loginWithGoogle } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!document.querySelector('script[src="https://accounts.google.com/gsi/client"]')) {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
    }
  }, []);

  const handleGoogleLogin = async () => {
    setError(null);
    const google = (window as unknown as Record<string, unknown>).google as
      | { accounts?: { id?: { initialize: Function; prompt: Function } } }
      | undefined;

    if (google?.accounts?.id) {
      google.accounts.id.initialize({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID || "mock_google_id",
        callback: (response: any) => {
          loginWithGoogle(response.credential).catch(err => {
            setError(err instanceof Error ? err.message : "Google login failed");
          });
        }
      });
      google.accounts.id.prompt();
    } else {
      setError("Google Sign-In is loading or blocked by your browser. Please try again.");
    }
  };

  return (
    <div className="w-full max-w-md mx-auto animate-slide-up">
      <div className="panel p-8">
        {/* ── Header ────────────────────────────── */}
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-brand-forest mb-1.5">
            System Authentication
          </h2>
          <p className="text-sm text-text-muted">
            Secure access for CAD ingestion and AI auditing.
          </p>
        </div>

        {/* ── Error Banner ──────────────────────── */}
        {error && (
          <div className="mb-5 p-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-800 animate-fade-in">
            {error}
          </div>
        )}

        <div className="space-y-3">
          {/* ── Google Sign-In ─────────────────── */}
          <button
            id="google-login-btn"
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-lg
              bg-surface border border-border
              hover:bg-surface-subtle
              transition-colors duration-150
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 text-text-muted animate-spin" />
            ) : (
              <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
            )}
            <span className="text-sm font-medium text-text-primary">
              Continue with Google
            </span>
            <LogIn className="h-4 w-4 text-text-faint shrink-0" />
          </button>


        </div>
      </div>
    </div>
  );
}
