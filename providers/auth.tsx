"use client";

import type { CurrentUserSession } from "@/utils/auth";
import {
  createContext,
  useContext,
  type ReactNode,
  useCallback,
  useState,
  useEffect
} from "react";
import {
  PERMISSIONS,
  hasPermission as checkHasPermission,
  hasAnyPermission as checkHasAnyPermission,
  hasAllPermissions as checkHasAllPermissions
} from "@/lib/permissions";

interface AuthContextType {
  user: CurrentUserSession;
  /** Backwards compatibility alias for components using admin */
  admin: CurrentUserSession;
  isOwner: boolean;
  logout: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
  hasPermission: (permission: PERMISSIONS) => boolean;
  hasAnyPermission: (permissions: PERMISSIONS[]) => boolean;
  hasAllPermissions: (permissions: PERMISSIONS[]) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

interface AuthProviderProps {
  children: ReactNode;
  user: CurrentUserSession;
  logout: () => Promise<void>;
}

// In-flight refresh promise singleton to prevent duplicate concurrent refresh requests
let inFlightRefreshPromise: Promise<boolean> | null = null;

async function executeRefresh(): Promise<boolean> {
  if (inFlightRefreshPromise) {
    return inFlightRefreshPromise;
  }

  inFlightRefreshPromise = (async () => {
    try {
      const res = await window.fetch("/api/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      return res.ok;
    } catch {
      return false;
    } finally {
      inFlightRefreshPromise = null;
    }
  })();

  return inFlightRefreshPromise;
}

export function AuthProvider({
  children,
  user: initialUser,
  logout
}: AuthProviderProps) {
  const [user] = useState<CurrentUserSession>(initialUser);
  const isOwner = user.isOwner;

  const refreshSession = useCallback(async () => {
    const success = await executeRefresh();
    return success;
  }, []);

  const hasPermission = useCallback(
    (permission: PERMISSIONS) => {
      if (isOwner) return true;
      return checkHasPermission(user.permissions, permission);
    },
    [isOwner, user.permissions]
  );

  const hasAnyPermission = useCallback(
    (permissions: PERMISSIONS[]) => {
      if (isOwner) return true;
      return checkHasAnyPermission(user.permissions, permissions);
    },
    [isOwner, user.permissions]
  );

  const hasAllPermissions = useCallback(
    (permissions: PERMISSIONS[]) => {
      if (isOwner) return true;
      return checkHasAllPermissions(user.permissions, permissions);
    },
    [isOwner, user.permissions]
  );

  // Set up global fetch interceptor & proactive periodic refresh
  useEffect(() => {
    if (typeof window === "undefined") return;

    // 1. Proactively ensure we have a fresh cookie on mount
    executeRefresh();

    // 2. Refresh on tab focus / visibilitychange
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        executeRefresh();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // 3. Periodic refresh every 4 minutes (default access token is 15 minutes)
    const intervalId = setInterval(
      () => {
        executeRefresh();
      },
      4 * 60 * 1000
    );

    // 4. Intercept window.fetch to automatically catch 401s and retry after refreshing
    const originalFetch = window.fetch;

    window.fetch = async function (
      input: RequestInfo | URL,
      init?: RequestInit
    ): Promise<Response> {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;

      // Don't intercept auth-related calls to avoid infinite loops
      const isAuthCall =
        url.includes("/api/auth/refresh") ||
        url.includes("/api/auth/signin") ||
        url.includes("/api/auth/signout");

      const response = await originalFetch(input, init);

      if (response.status === 401 && !isAuthCall) {
        // Attempt transparent token refresh
        const refreshed = await executeRefresh();
        if (refreshed) {
          // Retry the original request once with fresh credentials/cookie
          return originalFetch(input, init);
        }
      }

      return response;
    };

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      clearInterval(intervalId);
      window.fetch = originalFetch;
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        admin: user,
        isOwner,
        logout,
        refreshSession,
        hasPermission,
        hasAnyPermission,
        hasAllPermissions
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}

export function usePermissions() {
  const { hasPermission, hasAnyPermission, hasAllPermissions, isOwner, user } =
    useAuth();

  return {
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    isOwner,
    roleName: user.roleName,
    permissions: user.permissions
  };
}
