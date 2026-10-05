"use server";

import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import {
  verifyAccessToken,
  verifyRefreshToken,
  generateAccessToken,
  ACCESS_TOKEN_COOKIE_OPTIONS,
  ACCESS_TOKEN_COOKIE_NAME,
  REFRESH_TOKEN_COOKIE_NAME
} from "@/lib/auth";

export type CheckAuthResponse =
  | {
      authenticated: true;
      error: null;
      adminId: string;
    }
  | {
      authenticated: false;
      error: string;
      adminId: null;
    };

export async function checkAuth(): Promise<CheckAuthResponse> {
  const cookieSet = await cookies();
  const accessToken = cookieSet.get(ACCESS_TOKEN_COOKIE_NAME)?.value;
  const refreshToken = cookieSet.get(REFRESH_TOKEN_COOKIE_NAME)?.value;

  if (!accessToken && !refreshToken) {
    return { authenticated: false, error: "No tokens", adminId: null };
  }

  // 1. Check access token
  if (accessToken) {
    const payload = verifyAccessToken(accessToken);
    if (payload?.adminId) {
      return { authenticated: true, error: null, adminId: payload.adminId };
    }
  }

  // 2. Check refresh token if access token missing or expired
  if (refreshToken) {
    const refreshPayload = verifyRefreshToken(refreshToken);
    if (refreshPayload?.adminId && refreshPayload?.tokenId) {
      const tokenRecord = await prisma.token.findFirst({
        where: {
          id: refreshPayload.tokenId,
          adminId: refreshPayload.adminId
        }
      });

      if (tokenRecord) {
        const newAccessToken = generateAccessToken(refreshPayload.adminId);
        try {
          cookieSet.set(
            ACCESS_TOKEN_COOKIE_NAME,
            newAccessToken,
            ACCESS_TOKEN_COOKIE_OPTIONS
          );
        } catch {
          // Cookies cannot be updated in RSC rendering phase,
          // but authentication is still valid for this request
        }
        return {
          authenticated: true,
          error: null,
          adminId: refreshPayload.adminId
        };
      }
    }
  }

  return {
    authenticated: false,
    error: "Invalid or expired session",
    adminId: null
  };
}

export async function logoutAdmin(): Promise<void> {
  const cookieSet = await cookies();
  const refreshToken = cookieSet.get(REFRESH_TOKEN_COOKIE_NAME)?.value;

  if (refreshToken) {
    const payload = verifyRefreshToken(refreshToken);
    if (payload?.tokenId) {
      await prisma.token
        .deleteMany({
          where: {
            id: payload.tokenId
          }
        })
        .catch(() => {});
    }
  }

  cookieSet.delete(ACCESS_TOKEN_COOKIE_NAME);
  cookieSet.delete(REFRESH_TOKEN_COOKIE_NAME);
}
