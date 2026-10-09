import {
  PERMISSIONS,
  ALL_PERMISSIONS,
  hasPermission,
  hasAnyPermission,
  PERMISSION_LABELS
} from "@/lib/permissions";
import {
  ACCESS_TOKEN_COOKIE_NAME,
  REFRESH_TOKEN_COOKIE_NAME,
  ACCESS_TOKEN_COOKIE_OPTIONS,
  verifyAccessToken
} from "@/lib/auth";
import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import { refreshSessionFromToken } from "@/server/auth/service";

export interface AuthActor {
  id: string;
  email: string;
  name: string;
  phone?: string | null;
  isOwner: boolean;
  actorType: "admin" | "staff";
  roleId?: string;
  roleName?: string;
  permissions: PERMISSIONS[];
}

export class UnauthorizedError extends Error {
  statusCode = 401;
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  statusCode = 403;
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export async function getAuthActor(request?: NextRequest): Promise<AuthActor> {
  let token: string | undefined;

  if (request) {
    token = request.cookies.get(ACCESS_TOKEN_COOKIE_NAME)?.value;
    if (!token) {
      const authHeader = request.headers.get("authorization");
      if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.substring(7);
      }
    }
  } else {
    try {
      const cookieStore = await cookies();
      token = cookieStore.get(ACCESS_TOKEN_COOKIE_NAME)?.value;
    } catch {
      // ignore
    }
  }

  // 1. If access token is present and valid, resolve the actor directly
  if (token) {
    const payload = verifyAccessToken(token);
    if (payload) {
      if (payload.adminId || payload.actorType === "admin") {
        const admin = await prisma.admin.findUnique({
          where: { id: payload.adminId }
        });

        if (admin) {
          return {
            id: admin.id,
            email: admin.email,
            name: admin.name,
            isOwner: true,
            actorType: "admin",
            roleName: "Administrator",
            permissions: ALL_PERMISSIONS
          };
        }
      } else if (payload.staffId || payload.actorType === "staff") {
        const staff = await prisma.staff.findUnique({
          where: { id: payload.staffId },
          include: { role: true }
        });

        if (staff && staff.isActive) {
          return {
            id: staff.id,
            email: staff.email,
            name: staff.name,
            phone: staff.phone,
            isOwner: false,
            actorType: "staff",
            roleId: staff.role.id,
            roleName: staff.role.name,
            permissions: staff.role.permissions as PERMISSIONS[]
          };
        }
      }
    }
  }

  // 2. Access token is missing or expired. Attempt to refresh using refreshToken!
  let refreshToken: string | undefined;

  if (request) {
    refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE_NAME)?.value;
  }
  if (!refreshToken) {
    try {
      const cookieStore = await cookies();
      refreshToken = cookieStore.get(REFRESH_TOKEN_COOKIE_NAME)?.value;
    } catch {
      // ignore
    }
  }

  if (!refreshToken) {
    throw new UnauthorizedError(
      token
        ? "Session expired. Please sign in again."
        : "Authentication required"
    );
  }

  const refreshResult = await refreshSessionFromToken(refreshToken);
  if (
    !refreshResult.success ||
    !refreshResult.newAccessToken ||
    !refreshResult.actor
  ) {
    throw new UnauthorizedError(
      refreshResult.error || "Session expired. Please sign in again."
    );
  }

  // Attach the freshly minted access token to the outgoing cookie jar
  try {
    const cookieStore = await cookies();
    cookieStore.set(
      ACCESS_TOKEN_COOKIE_NAME,
      refreshResult.newAccessToken,
      ACCESS_TOKEN_COOKIE_OPTIONS
    );
  } catch {
    // RSC render context cannot mutate cookies directly
  }

  return refreshResult.actor;
}

export async function requirePermission(
  request: NextRequest,
  permission: PERMISSIONS
): Promise<AuthActor> {
  const actor = await getAuthActor(request);

  if (actor.isOwner) {
    return actor;
  }

  if (!hasPermission(actor.permissions, permission)) {
    const label = PERMISSION_LABELS[permission] || `Permission #${permission}`;
    throw new ForbiddenError(
      `Access denied: Missing required permission "${label}"`
    );
  }

  return actor;
}

export async function requireAnyPermission(
  request: NextRequest,
  permissions: PERMISSIONS[]
): Promise<AuthActor> {
  const actor = await getAuthActor(request);

  if (actor.isOwner) {
    return actor;
  }

  if (!hasAnyPermission(actor.permissions, permissions)) {
    throw new ForbiddenError(
      "Access denied: You do not have sufficient permissions to perform this action"
    );
  }

  return actor;
}

export async function requireOwner(request: NextRequest): Promise<AuthActor> {
  const actor = await getAuthActor(request);

  if (!actor.isOwner) {
    throw new ForbiddenError(
      "Access denied: This action can only be performed by an Administrator"
    );
  }

  return actor;
}
