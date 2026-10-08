"use client";

import { createContext, useContext, type ReactNode, useCallback } from "react";
import type { CurrentUserSession } from "@/utils/auth";
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

export function AuthProvider({ children, user, logout }: AuthProviderProps) {
  const isOwner = user.isOwner;

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

  return (
    <AuthContext.Provider
      value={{
        user,
        admin: user,
        isOwner,
        logout,
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
