import jwt, { type JwtPayload } from "jsonwebtoken";
import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import {
  JWT_ACCESS_SECRET,
  JWT_REFRESH_SECRET,
  IS_PRODUCTION
} from "@/lib/env";

export interface AccessTokenPayload extends JwtPayload {
  adminId?: string;
  staffId?: string;
  actorType?: "admin" | "staff";
  email?: string;
  name?: string;
  roleId?: string;
  roleName?: string;
  permissions?: number[];
}

export interface RefreshTokenPayload extends JwtPayload {
  adminId?: string;
  staffId?: string;
  actorType?: "admin" | "staff";
  tokenId: string;
}

export const ACCESS_TOKEN_EXPIRY = "15m";
export const REFRESH_TOKEN_EXPIRY = "7d";

export const ACCESS_TOKEN_COOKIE_NAME = "accessToken";
export const REFRESH_TOKEN_COOKIE_NAME = "refreshToken";
export const ADMIN_ID_HEADER = "x-admin-id";
export const STAFF_ID_HEADER = "x-staff-id";
export const ACTOR_TYPE_HEADER = "x-actor-type";

export const ACCESS_TOKEN_MAX_AGE = 15 * 60;
export const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60;

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

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

export function generateAccessToken(
  input:
    | string
    | {
        adminId?: string;
        staffId?: string;
        actorType?: "admin" | "staff";
        email?: string;
        name?: string;
        roleId?: string;
        roleName?: string;
        permissions?: number[];
      }
) {
  const payload =
    typeof input === "string"
      ? { adminId: input, actorType: "admin" as const }
      : input;
  return jwt.sign(payload, JWT_ACCESS_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY
  });
}

export function generateRefreshToken(
  input:
    | string
    | {
        adminId?: string;
        staffId?: string;
        actorType?: "admin" | "staff";
        tokenId: string;
      },
  optionalTokenId?: string
) {
  const payload =
    typeof input === "string"
      ? {
          adminId: input,
          tokenId: optionalTokenId!,
          actorType: "admin" as const
        }
      : input;
  return jwt.sign(payload, JWT_REFRESH_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRY
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_ACCESS_SECRET);

    if (
      typeof decoded === "object" &&
      decoded !== null &&
      (typeof (decoded as AccessTokenPayload).adminId === "string" ||
        typeof (decoded as AccessTokenPayload).staffId === "string")
    ) {
      return decoded as AccessTokenPayload;
    }

    return null;
  } catch {
    return null;
  }
}

export function verifyRefreshToken(token: string): RefreshTokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_REFRESH_SECRET);

    if (
      typeof decoded === "object" &&
      decoded !== null &&
      (typeof (decoded as RefreshTokenPayload).adminId === "string" ||
        typeof (decoded as RefreshTokenPayload).staffId === "string") &&
      typeof (decoded as RefreshTokenPayload).tokenId === "string"
    ) {
      return decoded as RefreshTokenPayload;
    }

    return null;
  } catch {
    return null;
  }
}

export function getAdminId(request: NextRequest): string {
  const adminId = request.headers.get(ADMIN_ID_HEADER);

  if (!adminId) {
    throw new Error("Missing authenticated admin");
  }

  return adminId;
}
