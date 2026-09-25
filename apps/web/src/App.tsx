import { useState } from "react";
import { Activity, ChevronRight, Cpu, FileUp } from "lucide-react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Navbar } from "./components/Navbar";
import { AuthCard } from "./components/AuthCard";
import { CadUploader } from "./components/CadUploader";
import { AssessmentDashboard } from "./components/AssessmentDashboard";
import { Leaderboard } from "./components/Leaderboard";
import { useRealtimeAssessment } from "./hooks/useRealtimeAssessment";

// ── Feature Card (editorial style) ─────────────────────────

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
    <div className="panel-hover p-5 group cursor-default animate-fade-in">
      <div className="flex items-start gap-3.5">
        <div className="rounded-lg bg-brand-mint p-2 text-brand-forest group-hover:bg-brand-mint/80 transition-colors shrink-0">
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-text-primary text-sm mb-0.5">{title}</h3>
          <p className="text-xs text-text-muted leading-relaxed">
            {description}
          </p>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-border-strong group-hover:text-text-muted transition-colors mt-0.5 shrink-0" />
      </div>
    </div>
  );
}

// ── App Content ─────────────────────────────────────────────

function AppContent() {
  const { isAuthenticated, token } = useAuth();
  const [activeSubmissionId, setActiveSubmissionId] = useState<string | null>(null);

  const {
    connectionStatus,
    phase,
    assessment,
    leaderboard,
  } = useRealtimeAssessment(token, activeSubmissionId);

  return (
    <div className="min-h-screen bg-canvas text-text-primary flex flex-col">
      {/* ── Navbar ───────────────────────────────────── */}
      <Navbar connectionStatus={connectionStatus} />

      {/* ── Main Content ─────────────────────────────── */}
      <main className="flex-1">
        {/* Hero Section with Drafting Grid */}
        <section className="drafting-grid border-b border-border">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16 text-center animate-slide-up">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-brand-forest mb-3 text-balance">
              Automated Engineering
              <br />
              CAD Review
            </h2>
            <p className="text-text-muted text-sm sm:text-base max-w-xl mx-auto leading-relaxed">
              Upload STEP/STL models for geometric analysis, off-screen PyVista
              rendering, and Gemini Vision AI structural audits.
            </p>
          </div>
        </section>

        {/* Content Canvas */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
          {!isAuthenticated ? (
            /* ── Auth Gate ───────────────────────────── */
            <div className="max-w-md mx-auto">
              <AuthCard />
            </div>
          ) : (
            /* ── Authenticated Dashboard ─────────────── */
            <div className="space-y-8">
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

              {/* Condensed feature row (shown when idle) */}
              {!activeSubmissionId && (
                <>
                  <div className="divider" />
                  <div className="grid gap-3 sm:grid-cols-3 max-w-4xl mx-auto">
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
                </>
              )}
            </div>
          )}
        </div>
      </main>

      {/* ── Footer ───────────────────────────────────── */}
      <footer className="border-t border-border py-5">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-text-faint">
          <span>© {new Date().getFullYear()} LeetCAD</span>
          <span className="font-mono text-[10px] tracking-wide">
            Node.js · NestJS · RabbitMQ · CadQuery · Gemini 2.5 Flash Vision
          </span>
        </div>
      </footer>
    </div>
  );
}

// ── Root Export ──────────────────────────────────────────────

export function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
