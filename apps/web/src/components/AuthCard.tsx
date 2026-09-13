import { useState } from "react";
import { Loader2, LogIn, Shield, Zap } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export function AuthCard() {
  const { loginWithDevMode, loginWithGoogle, isLoading } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const handleDevLogin = async () => {
    setError(null);
    try {
      await loginWithDevMode();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Dev login failed");
    }
  };

  const handleGoogleLogin = async () => {
    setError(null);
    // If Google Sign-In SDK is loaded, use it; otherwise show info
    const google = (window as unknown as Record<string, unknown>).google as
      | { accounts?: { id?: { initialize: Function; prompt: Function } } }
      | undefined;

    if (google?.accounts?.id) {
      google.accounts.id.prompt();
    } else {
      // Fallback: prompt user that Google Sign-In requires GOOGLE_CLIENT_ID
      setError("Google Sign-In requires a GOOGLE_CLIENT_ID. Use Dev Mode for local testing.");
    }
  };

  return (
    <div className="w-full max-w-md mx-auto animate-slide-up">
      <div className="glass p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 shadow-lg shadow-brand-600/25 mb-4">
            <Shield className="h-7 w-7 text-white" />
          </div>
          <h2 className="text-xl font-bold text-white mb-1">Sign in to LeetCAD</h2>
          <p className="text-sm text-surface-200">
            Choose your authentication method
          </p>
        </div>

        <div className="space-y-3">
          {/* Dev Mode Button */}
          <button
            id="dev-login-btn"
            onClick={handleDevLogin}
            disabled={isLoading}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg
              bg-emerald-500/10 border border-emerald-500/25
              hover:bg-emerald-500/20 hover:border-emerald-500/40
              transition-all duration-200 group disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 text-emerald-400 animate-spin" />
            ) : (
              <Zap className="h-5 w-5 text-emerald-400" />
            )}
            <div className="flex-1 text-left">
              <div className="text-sm font-semibold text-white">
                Quick Reviewer Bypass
              </div>
              <div className="text-xs text-surface-200">
                Dev Mode — No GCP setup needed
              </div>
            </div>
            <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              Dev
            </span>
          </button>

          {/* Divider */}
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-surface-700/50" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-3 bg-surface-800/60 text-surface-200">or</span>
            </div>
          </div>

          {/* Google Sign-In Button */}
          <button
            id="google-login-btn"
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg
              bg-white/5 border border-surface-700
              hover:bg-white/10 hover:border-surface-200/30
              transition-all duration-200 group disabled:opacity-50"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
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
            <div className="flex-1 text-left">
              <div className="text-sm font-semibold text-white">
                Sign in with Google
              </div>
              <div className="text-xs text-surface-200">
                Requires Google Cloud credentials
              </div>
            </div>
            <LogIn className="h-4 w-4 text-surface-700 group-hover:text-surface-200 transition-colors" />
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/25 text-sm text-red-400 animate-fade-in">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
