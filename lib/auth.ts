import jwt, { type JwtPayload } from "jsonwebtoken";
import bcrypt from "bcryptjs";
import {
  JWT_ACCESS_SECRET,
  JWT_REFRESH_SECRET,
  IS_PRODUCTION
} from "@/lib/env";

export interface AccessTokenPayload extends JwtPayload {
  adminId: string;
}

export interface RefreshTokenPayload extends JwtPayload {
  adminId: string;
  tokenId: string;
}

export const ACCESS_TOKEN_EXPIRY = "15m";
export const REFRESH_TOKEN_EXPIRY = "7d";

export const ACCESS_TOKEN_COOKIE_NAME = "accessToken";
export const REFRESH_TOKEN_COOKIE_NAME = "refreshToken";

export const ACCESS_TOKEN_MAX_AGE = 15 * 60; // 15 minutes
export const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60; // 7 days

export const AUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: IS_PRODUCTION,
  sameSite: "lax" as const,
  path: "/"
};

export const ACCESS_TOKEN_COOKIE_OPTIONS = {
  ...AUTH_COOKIE_OPTIONS,
  maxAge: ACCESS_TOKEN_MAX_AGE
};

export const REFRESH_TOKEN_COOKIE_OPTIONS = {
  ...AUTH_COOKIE_OPTIONS,
  maxAge: REFRESH_TOKEN_MAX_AGE
};

/**
 * Hash a plain password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

/**
 * Verify a plain password against a stored hash or legacy plain string
 */
export async function verifyPassword(
  password: string,
  storedHash: string
): Promise<boolean> {
  if (
    storedHash.startsWith("$2a$") ||
    storedHash.startsWith("$2b$") ||
    storedHash.startsWith("$2y$")
  ) {
    return bcrypt.compare(password, storedHash);
  }
  // Support legacy plain text entries during transition
  return password === storedHash;
}

/**
 * Generate a signed JWT access token containing adminId
 */
export function generateAccessToken(adminId: string): string {
  return jwt.sign({ adminId }, JWT_ACCESS_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY
  });
}

/**
 * Generate a signed JWT refresh token containing adminId and tokenId
 */
export function generateRefreshToken(adminId: string, tokenId: string): string {
  return jwt.sign({ adminId, tokenId }, JWT_REFRESH_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRY
  });
}

/**
 * Verify access token and return payload if valid, null otherwise
 */
export function verifyAccessToken(token: string): AccessTokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_ACCESS_SECRET) as AccessTokenPayload;
    if (typeof decoded === "object" && decoded?.adminId) {
      return decoded;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Verify refresh token and return payload if valid, null otherwise
 */
export function verifyRefreshToken(token: string): RefreshTokenPayload | null {
  try {
    const decoded = jwt.verify(
      token,
      JWT_REFRESH_SECRET
    ) as RefreshTokenPayload;
    if (typeof decoded === "object" && decoded?.adminId && decoded?.tokenId) {
      return decoded;
    }
    return null;
  } catch {
    return null;
  }
}
