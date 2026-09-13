import { useState } from "react";
import {
  Activity,
  Box,
  ChevronRight,
  Cpu,
  FileUp,
  Layers,
  LogOut,
  Zap,
} from "lucide-react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { AuthCard } from "./components/AuthCard";
import { CadUploader } from "./components/CadUploader";
import { AssessmentDashboard } from "./components/AssessmentDashboard";
import { Leaderboard } from "./components/Leaderboard";
import { useRealtimeAssessment } from "./hooks/useRealtimeAssessment";

function StatusIndicator({ connected }: { connected: boolean }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span
        className={`inline-block h-2 w-2 rounded-full ${
          connected
            ? "bg-emerald-400 shadow-[0_0_6px_theme(colors.emerald.400)]"
            : "bg-red-400 shadow-[0_0_6px_theme(colors.red.400)] animate-pulse-slow"
        }`}
      />
      <span className="text-surface-200">
        {connected ? "Connected" : "Disconnected"}
      </span>
    </div>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  if (!user) return null;

  const initials = user.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2.5">
        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-xs font-bold text-white shadow-md shadow-brand-600/20">
          {initials}
        </div>
        <div className="hidden sm:block text-left">
          <div className="text-sm font-medium text-white leading-tight">
            {user.name}
          </div>
          <div className="text-xs text-surface-200 leading-tight">
            {user.email}
          </div>
        </div>
      </div>
      <button
        id="logout-btn"
        onClick={logout}
        className="btn-ghost !px-2 !py-1.5 text-surface-200 hover:text-red-400"
        title="Sign out"
      >
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="glass-hover p-6 group cursor-default animate-fade-in">
      <div className="flex items-start gap-4">
        <div className="rounded-lg bg-brand-600/20 p-2.5 text-brand-400 group-hover:bg-brand-600/30 transition-colors">
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-white mb-1">{title}</h3>
          <p className="text-sm text-surface-200 leading-relaxed">
            {description}
          </p>
        </div>
        <ChevronRight className="h-4 w-4 text-surface-700 group-hover:text-surface-200 transition-colors mt-1" />
      </div>
    </div>
  );
}

function AppContent() {
  const { isAuthenticated, token } = useAuth();
  const [activeSubmissionId, setActiveSubmissionId] = useState<string | null>(null);

  const {
    connectionStatus,
    phase,
    assessment,
    leaderboard,
  } = useRealtimeAssessment(token, activeSubmissionId);

  const isConnected = connectionStatus === "connected";

  return (
    <div className="min-h-screen flex flex-col">
      {/* ── Navigation Bar ───────────────────────────── */}
      <header className="sticky top-0 z-50 glass border-b border-surface-700/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 shadow-lg shadow-brand-600/25">
              <Box className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-white to-surface-200 bg-clip-text text-transparent">
                LeetCAD
              </h1>
            </div>
          </div>

          {isAuthenticated && (
            <nav className="hidden md:flex items-center gap-1">
              <button className="btn-ghost text-sm">
                <Layers className="h-4 w-4" />
                Dashboard
              </button>
              <button className="btn-ghost text-sm">
                <FileUp className="h-4 w-4" />
                Submissions
              </button>
              <button className="btn-ghost text-sm">
                <Activity className="h-4 w-4" />
                Leaderboard
              </button>
            </nav>
          )}

          <div className="flex items-center gap-4">
            <StatusIndicator connected={isConnected} />
            {isAuthenticated && <UserMenu />}
          </div>
        </div>
      </header>

      {/* ── Main Content ─────────────────────────────── */}
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          {/* Hero */}
          <div className="text-center mb-16 animate-slide-up">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-600/15 text-brand-400 text-xs font-medium mb-6 border border-brand-600/25">
              <Zap className="h-3.5 w-3.5" />
              AI-Powered Engineering Review
            </div>
            <h2 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
              <span className="bg-gradient-to-r from-white via-surface-100 to-surface-200 bg-clip-text text-transparent">
                Automated CAD
              </span>
              <br />
              <span className="bg-gradient-to-r from-brand-400 to-brand-600 bg-clip-text text-transparent">
                Design Assessment
              </span>
            </h2>
            <p className="text-surface-200 text-lg max-w-2xl mx-auto leading-relaxed">
              Upload STEP files, receive AI-powered structural analysis,
              manufacturability scoring, and detailed engineering reports in
              seconds.
            </p>
          </div>

          {/* Auth Gate or Dashboard */}
          {!isAuthenticated ? (
            <AuthCard />
          ) : (
            <div className="space-y-10">
              {/* CAD Uploader */}
              <CadUploader onSubmissionCreated={setActiveSubmissionId} />

              {/* Real-time Assessment Dashboard */}
              <AssessmentDashboard
                phase={phase}
                assessment={assessment}
                submissionId={activeSubmissionId}
              />

              {/* Global Leaderboard */}
              <Leaderboard entries={leaderboard} />

              {/* Condensed feature row */}
              {!activeSubmissionId && (
                <div className="grid gap-4 sm:grid-cols-3 max-w-4xl mx-auto">
                  <FeatureCard
                    icon={FileUp}
                    title="STEP File Upload"
                    description="Drag-and-drop STEP file ingestion with automatic geometry extraction."
                  />
                  <FeatureCard
                    icon={Cpu}
                    title="AI Assessment"
                    description="Gemini Vision evaluates geometry, symmetry, and manufacturability."
                  />
                  <FeatureCard
                    icon={Activity}
                    title="Real-time Results"
                    description="WebSocket-powered live updates push scores and reports instantly."
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* ── Footer ───────────────────────────────────── */}
      <footer className="border-t border-surface-700/50 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between text-xs text-surface-200">
          <span>© {new Date().getFullYear()} LeetCAD</span>
          <span className="font-mono text-surface-700">v0.1.0-alpha</span>
        </div>
      </footer>
    </div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
