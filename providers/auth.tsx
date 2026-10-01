"use client";

import { createContext, useContext, type ReactNode } from "react";

interface AuthContextType {
  adminId: string;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

interface AuthProviderProps extends AuthContextType {
  children: ReactNode;
}

export function AuthProvider({ children, adminId, logout }: AuthProviderProps) {
  return (
    <AuthContext.Provider value={{ adminId, logout }}>
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
