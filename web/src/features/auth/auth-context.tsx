import { getAuthSession, login as loginRequest, logout as logoutRequest } from "@/api/auth";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  enabled: boolean;
  status: AuthStatus;
  isLoggingIn: boolean;
  isLoggingOut: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

interface AuthSessionState {
  enabled: boolean;
  authenticated: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const AUTH_DISABLED_STATE: AuthSessionState = {
  enabled: false,
  authenticated: true,
};

function computeStatus(session: AuthSessionState): AuthStatus {
  if (!session.enabled) return "authenticated";
  return session.authenticated ? "authenticated" : "unauthenticated";
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSessionState>(AUTH_DISABLED_STATE);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [mutations, setMutations] = useState({
    loggingIn: false,
    loggingOut: false,
  });

  const applySession = useCallback((next: AuthSessionState) => {
    setSession(next);
    setStatus(computeStatus(next));
  }, []);

  const refreshSession = useCallback(async () => {
    try {
      const next = await getAuthSession();
      applySession(next);
    } catch {
      applySession({ enabled: true, authenticated: false });
    }
  }, [applySession]);

  useEffect(() => {
    refreshSession().catch(() => {
      // handled in refresh
    });
  }, [refreshSession]);

  useEffect(() => {
    if (!session.enabled || typeof window === "undefined") {
      return;
    }

    const originalFetch = window.fetch;
    const wrappedFetch = (async (...args: Parameters<typeof window.fetch>) => {
      const response = await originalFetch(...args);
      if (response.status === 401) {
        applySession({ enabled: true, authenticated: false });
      }
      return response;
    }) as typeof window.fetch;
    Object.assign(wrappedFetch, originalFetch);
    window.fetch = wrappedFetch;

    return () => {
      window.fetch = originalFetch;
    };
  }, [session.enabled, applySession]);

  const login = useCallback(
    async (username: string, password: string) => {
      if (!session.enabled) return true;

      setMutations((prev) => ({ ...prev, loggingIn: true }));
      try {
        const success = await loginRequest(username, password);
        if (success) {
          await refreshSession();
        }
        return success;
      } catch {
        return false;
      } finally {
        setMutations((prev) => ({ ...prev, loggingIn: false }));
      }
    },
    [session.enabled, refreshSession],
  );

  const logout = useCallback(async () => {
    if (!session.enabled) return;

    setMutations((prev) => ({ ...prev, loggingOut: true }));
    try {
      await logoutRequest();
    } catch {
      // Ignore, we'll still reset session below
    } finally {
      setMutations((prev) => ({ ...prev, loggingOut: false }));
    }
    await refreshSession();
  }, [session.enabled, refreshSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      enabled: session.enabled,
      status,
      isLoggingIn: mutations.loggingIn,
      isLoggingOut: mutations.loggingOut,
      login,
      logout,
      refresh: refreshSession,
    }),
    [session.enabled, status, mutations, login, logout, refreshSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
