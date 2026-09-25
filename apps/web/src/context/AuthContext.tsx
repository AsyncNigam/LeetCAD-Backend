import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

// ── Types ───────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

export interface AuthContextType {
  token: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  loginWithDevMode: () => Promise<void>;
  loginWithGoogle: (credential: string) => Promise<void>;
  logout: () => void;
}

// ── Constants ───────────────────────────────────────────────

const TOKEN_KEY = "leetcad_token";
const USER_KEY = "leetcad_user";
const API_BASE = "/api";

// ── JWT Helpers ─────────────────────────────────────────────

/**
 * Safely decode a JWT payload without a library dependency.
 * Returns `null` if the token is malformed.
 */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    // Base64url → Base64 → decode
    const base64 = parts[1]
      .replace(/-/g, "+")
      .replace(/_/g, "/");

    const json = atob(base64);
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Returns `true` if the JWT `exp` claim is in the past (or missing).
 * Adds a 30-second grace period to avoid edge-case clock drift.
 */
function isTokenExpired(token: string): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.exp !== "number") {
    // If we can't determine expiry, treat as expired for safety
    return true;
  }
  const expiryMs = payload.exp * 1000;
  const now = Date.now();
  const GRACE_MS = 30_000;
  return expiryMs - GRACE_MS < now;
}

// ── LocalStorage Persistence ────────────────────────────────

function loadPersistedAuth(): { token: string | null; user: AuthUser | null } {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const userRaw = localStorage.getItem(USER_KEY);
    const user = userRaw ? (JSON.parse(userRaw) as AuthUser) : null;

    // Validate that the persisted token hasn't expired
    if (token && isTokenExpired(token)) {
      clearPersistedAuth();
      return { token: null, user: null };
    }

    return { token, user };
  } catch {
    clearPersistedAuth();
    return { token: null, user: null };
  }
}

function persistAuth(token: string, user: AuthUser): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function clearPersistedAuth(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

// ── Context ─────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType | null>(null);

// ── Provider ────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // ── Hydrate from localStorage on mount ────────────────────
  useEffect(() => {
    const persisted = loadPersistedAuth();
    if (persisted.token && persisted.user) {
      setToken(persisted.token);
      setUser(persisted.user);
    }
    setInitialized(true);
  }, []);

  // ── Periodic expiry check (every 60s) ─────────────────────
  useEffect(() => {
    if (!token) return;

    const interval = setInterval(() => {
      if (isTokenExpired(token)) {
        setToken(null);
        setUser(null);
        clearPersistedAuth();
      }
    }, 60_000);

    return () => clearInterval(interval);
  }, [token]);

  // ── Shared response handler ───────────────────────────────
  const handleAuthResponse = useCallback(
    (data: { accessToken: string; user: AuthUser }) => {
      setToken(data.accessToken);
      setUser(data.user);
      persistAuth(data.accessToken, data.user);
    },
    [],
  );

  // ── Login: Dev Mode ───────────────────────────────────────
  const loginWithDevMode = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/dev-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as Record<string, string>).message ||
            `Dev login failed (HTTP ${res.status})`,
        );
      }

      const data = (await res.json()) as { accessToken: string; user: AuthUser };
      handleAuthResponse(data);
    } finally {
      setIsLoading(false);
    }
  }, [handleAuthResponse]);

  // ── Login: Google OAuth ───────────────────────────────────
  const loginWithGoogle = useCallback(
    async (credential: string) => {
      setIsLoading(true);
      try {
        const res = await fetch(`${API_BASE}/auth/google`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: credential }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(
            (body as Record<string, string>).message ||
              `Google login failed (HTTP ${res.status})`,
          );
        }

        const data = (await res.json()) as { accessToken: string; user: AuthUser };
        handleAuthResponse(data);
      } finally {
        setIsLoading(false);
      }
    },
    [handleAuthResponse],
  );

  // ── Logout ────────────────────────────────────────────────
  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    clearPersistedAuth();
  }, []);

  // ── Memoized context value ────────────────────────────────
  const value = useMemo<AuthContextType>(
    () => ({
      token,
      user,
      isAuthenticated: !!token && !!user,
      isLoading,
      loginWithDevMode,
      loginWithGoogle,
      logout,
    }),
    [token, user, isLoading, loginWithDevMode, loginWithGoogle, logout],
  );

  // Don't render children until hydration is complete
  if (!initialized) return null;

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ── Hook ────────────────────────────────────────────────────

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error(
      "useAuth() must be used within an <AuthProvider>. " +
        "Wrap your component tree with <AuthProvider> in App.tsx.",
    );
  }
  return ctx;
}
