import { LogOut, Shield } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import { StatusIndicator } from "./StatusIndicator";
import type { ConnectionStatus } from "../hooks/useRealtimeAssessment";

// ── User Menu ───────────────────────────────────────────────

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
        <div className="h-8 w-8 rounded-full bg-surface-subtle border border-border flex items-center justify-center text-xs font-mono font-semibold text-brand-forest">
          {initials}
        </div>
        <div className="hidden sm:block text-left">
          <div className="text-sm font-medium text-text-primary leading-tight">
            {user.name}
          </div>
          <div className="text-xs text-text-muted leading-tight">
            {user.email}
          </div>
        </div>
      </div>
      <button
        id="logout-btn"
        onClick={logout}
        className="btn-ghost !px-2 !py-1.5 text-text-faint hover:text-red-600 text-xs"
        title="Sign out"
      >
        <LogOut className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function GuestIndicator() {
  return (
    <span className="text-xs font-mono text-text-faint uppercase tracking-wider">
      Guest Session
    </span>
  );
}

// ── Navbar ──────────────────────────────────────────────────

interface NavbarProps {
  connectionStatus: ConnectionStatus;
}

export function Navbar({ connectionStatus }: NavbarProps) {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isAdmin = user?.role === "ADMIN" || user?.role === "OWNER";
  const isOnAdmin = location.pathname.startsWith("/admin");

  return (
    <header className="sticky top-0 z-50 bg-surface border-b border-border">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        {/* ── Brand ──────────────────────────── */}
        <div className="flex items-center gap-3">
          <h1
            className="text-lg font-bold tracking-tight text-brand-forest cursor-pointer"
            onClick={() => navigate("/problems")}
          >
            LeetCAD
          </h1>
          <span className="hidden sm:inline-flex text-[10px] font-mono text-text-faint border border-border rounded px-1.5 py-0.5 uppercase tracking-widest">
            v0.9-alpha / CAD Engine
          </span>
        </div>

        {/* ── Right Section ─────────────────── */}
        <div className="flex items-center gap-5">
          {isAuthenticated && isAdmin && (
            <button
              onClick={() => navigate(isOnAdmin ? "/problems" : "/admin")}
              className={`flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase transition-colors ${
                isOnAdmin
                  ? "text-brand-forest"
                  : "text-text-muted hover:text-text-primary"
              }`}
            >
              <Shield className="h-3.5 w-3.5" />
              {isOnAdmin ? "Challenges" : "Admin"}
            </button>
          )}
          <StatusIndicator status={connectionStatus} />
          <div className="h-4 w-px bg-border" />
          {isAuthenticated ? <UserMenu /> : <GuestIndicator />}
        </div>
      </div>
    </header>
  );
}

