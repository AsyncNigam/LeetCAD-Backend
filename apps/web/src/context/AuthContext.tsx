import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  loginWithDevMode: () => Promise<void>;
  loginWithGoogle: (credential: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

const TOKEN_KEY = "leetcad_token";
const USER_KEY = "leetcad_user";

function loadPersistedAuth(): { token: string | null; user: AuthUser | null } {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const userRaw = localStorage.getItem(USER_KEY);
    const user = userRaw ? (JSON.parse(userRaw) as AuthUser) : null;
    return { token, user };
  } catch {
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Hydrate from localStorage on mount
  useEffect(() => {
    const persisted = loadPersistedAuth();
    if (persisted.token && persisted.user) {
      setToken(persisted.token);
      setUser(persisted.user);
    }
    setInitialized(true);
  }, []);

  const handleAuthResponse = useCallback(
    (data: { accessToken: string; user: AuthUser }) => {
      setToken(data.accessToken);
      setUser(data.user);
      persistAuth(data.accessToken, data.user);
    },
    [],
  );

  const loginWithDevMode = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/dev-login", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `Dev login failed (${res.status})`);
      }
      const data = await res.json();
      handleAuthResponse(data);
    } finally {
      setIsLoading(false);
    }
  }, [handleAuthResponse]);

  const loginWithGoogle = useCallback(
    async (credential: string) => {
      setIsLoading(true);
      try {
        const res = await fetch("/api/auth/google", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: credential }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.message || `Google login failed (${res.status})`);
        }
        const data = await res.json();
        handleAuthResponse(data);
      } finally {
        setIsLoading(false);
      }
    },
    [handleAuthResponse],
  );

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    clearPersistedAuth();
  }, []);

  const value = useMemo<AuthState>(
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

  if (!initialized) return null;

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an <AuthProvider>");
  }
  return ctx;
}
