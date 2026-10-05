"use client";

import { Admin } from "@prisma/client";
import { createContext, useContext, type ReactNode } from "react";

interface AuthContextType {
  admin: Admin;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

interface AuthProviderProps extends AuthContextType {
  children: ReactNode;
}

export function AuthProvider({ children, admin, logout }: AuthProviderProps) {
  return (
    <AuthContext.Provider value={{ admin, logout }}>
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
