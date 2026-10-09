"use server";

import {
  verifyAccessToken,
  verifyRefreshToken,
  ACCESS_TOKEN_COOKIE_OPTIONS,
  ACCESS_TOKEN_COOKIE_NAME,
  REFRESH_TOKEN_COOKIE_NAME
} from "@/lib/auth";
import { ALL_PERMISSIONS, PERMISSIONS } from "@/lib/permissions";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import { refreshSessionFromToken } from "@/server/auth/service";

export interface CurrentUserSession {
  id: string;
  email: string;
  name: string;
  phone?: string | null;
  isOwner: boolean;
  actorType: "admin" | "staff";
  roleName: string;
  permissions: PERMISSIONS[];
}

export type CheckAuthResponse =
  | {
      authenticated: true;
      error: null;
      adminId?: string;
      staffId?: string;
      actorType: "admin" | "staff";
      actor: CurrentUserSession;
    }
  | {
      authenticated: false;
      error: string;
      adminId: null;
      staffId: null;
      actorType: null;
      actor: null;
    };

export async function checkAuth(): Promise<CheckAuthResponse> {
  const cookieSet = await cookies();
  const accessToken = cookieSet.get(ACCESS_TOKEN_COOKIE_NAME)?.value;
  const refreshToken = cookieSet.get(REFRESH_TOKEN_COOKIE_NAME)?.value;

  if (!accessToken && !refreshToken) {
    return {
      authenticated: false,
      error: "No tokens",
      adminId: null,
      staffId: null,
      actorType: null,
      actor: null
    };
  }

  // 1. Check access token
  if (accessToken) {
    const payload = verifyAccessToken(accessToken);
    if (payload?.adminId || payload?.actorType === "admin") {
      const admin = await prisma.admin.findUnique({
        where: { id: payload.adminId }
      });
      if (admin) {
        return {
          authenticated: true,
          error: null,
          adminId: admin.id,
          actorType: "admin",
          actor: {
            id: admin.id,
            email: admin.email,
            name: admin.name,
            isOwner: true,
            actorType: "admin",
            roleName: "Administrator",
            permissions: ALL_PERMISSIONS
          }
        };
      }
    } else if (payload?.staffId || payload?.actorType === "staff") {
      const staff = await prisma.staff.findUnique({
        where: { id: payload.staffId },
        include: { role: true }
      });
      if (staff && staff.isActive) {
        return {
          authenticated: true,
          error: null,
          staffId: staff.id,
          actorType: "staff",
          actor: {
            id: staff.id,
            email: staff.email,
            name: staff.name,
            phone: staff.phone,
            isOwner: false,
            actorType: "staff",
            roleName: staff.role.name,
            permissions: staff.role.permissions as PERMISSIONS[]
          }
        };
      }
    }
  }

  // 2. Check refresh token if access token missing or expired
  if (refreshToken) {
    const refreshResult = await refreshSessionFromToken(refreshToken);
    if (
      refreshResult.success &&
      refreshResult.actor &&
      refreshResult.newAccessToken
    ) {
      try {
        cookieSet.set(
          ACCESS_TOKEN_COOKIE_NAME,
          refreshResult.newAccessToken,
          ACCESS_TOKEN_COOKIE_OPTIONS
        );
      } catch {
        // RSC render context cannot mutate cookies directly
      }

      return {
        authenticated: true,
        error: null,
        adminId:
          refreshResult.actor.actorType === "admin"
            ? refreshResult.actor.id
            : undefined,
        staffId:
          refreshResult.actor.actorType === "staff"
            ? refreshResult.actor.id
            : undefined,
        actorType: refreshResult.actor.actorType,
        actor: {
          id: refreshResult.actor.id,
          email: refreshResult.actor.email,
          name: refreshResult.actor.name,
          phone: refreshResult.actor.phone,
          isOwner: refreshResult.actor.isOwner,
          actorType: refreshResult.actor.actorType,
          roleName: refreshResult.actor.roleName || "Staff",
          permissions: refreshResult.actor.permissions
        }
      };
    }
  }

  return {
    authenticated: false,
    error: "Invalid or expired session",
    adminId: null,
    staffId: null,
    actorType: null,
    actor: null
  };
}

export async function logoutAdmin(): Promise<void> {
  const cookieSet = await cookies();
  const refreshToken = cookieSet.get(REFRESH_TOKEN_COOKIE_NAME)?.value;

  if (refreshToken) {
    const payload = verifyRefreshToken(refreshToken);
    if (payload?.tokenId) {
      if (payload.adminId) {
        await prisma.token
          .deleteMany({
            where: { id: payload.tokenId }
          })
          .catch(() => {});
      } else if (payload.staffId) {
        await prisma.staffToken
          .deleteMany({
            where: { id: payload.tokenId }
          })
          .catch(() => {});
      }
    }
  }

  cookieSet.delete(ACCESS_TOKEN_COOKIE_NAME);
  cookieSet.delete(REFRESH_TOKEN_COOKIE_NAME);
}
