import type { AuthActor } from "@/lib/rbac";
import { verifyRefreshToken, generateAccessToken } from "@/lib/auth";
import { ALL_PERMISSIONS, PERMISSIONS } from "@/lib/permissions";
import prisma from "@/lib/prisma";

export interface RefreshSessionResult {
  success: boolean;
  newAccessToken?: string;
  actor?: AuthActor;
  error?: string;
}

/**
 * Validates a refresh token against the database and issues a fresh access token.
 * Supports both admin (Token model) and staff (StaffToken model).
 */
export async function refreshSessionFromToken(
  refreshToken: string
): Promise<RefreshSessionResult> {
  if (!refreshToken) {
    return { success: false, error: "No refresh token provided" };
  }

  const refreshPayload = verifyRefreshToken(refreshToken);
  if (!refreshPayload) {
    return { success: false, error: "Refresh token is invalid or expired" };
  }

  // 1. Check if token belongs to Admin
  if (refreshPayload.adminId || refreshPayload.actorType === "admin") {
    const adminId = refreshPayload.adminId;
    if (!adminId) {
      return { success: false, error: "Invalid admin token payload" };
    }

    const tokenRecord = await prisma.token.findFirst({
      where: {
        id: refreshPayload.tokenId,
        adminId
      },
      include: {
        admin: true
      }
    });

    if (!tokenRecord || !tokenRecord.admin) {
      return { success: false, error: "Session has been revoked or expired" };
    }

    const newAccessToken = generateAccessToken({
      adminId: tokenRecord.admin.id,
      actorType: "admin",
      email: tokenRecord.admin.email,
      name: tokenRecord.admin.name,
      roleName: "Administrator",
      permissions: ALL_PERMISSIONS
    });

    return {
      success: true,
      newAccessToken,
      actor: {
        id: tokenRecord.admin.id,
        email: tokenRecord.admin.email,
        name: tokenRecord.admin.name,
        isOwner: true,
        actorType: "admin",
        roleName: "Administrator",
        permissions: ALL_PERMISSIONS
      }
    };
  }

  // 2. Check if token belongs to Staff
  if (refreshPayload.staffId || refreshPayload.actorType === "staff") {
    const staffId = refreshPayload.staffId;
    if (!staffId) {
      return { success: false, error: "Invalid staff token payload" };
    }

    const staffTokenRecord = await prisma.staffToken.findFirst({
      where: {
        id: refreshPayload.tokenId,
        staffId
      },
      include: {
        staff: {
          include: {
            role: true
          }
        }
      }
    });

    if (!staffTokenRecord || !staffTokenRecord.staff) {
      return {
        success: false,
        error: "Staff session has been revoked or expired"
      };
    }

    if (!staffTokenRecord.staff.isActive) {
      return { success: false, error: "Staff account has been deactivated" };
    }

    const staff = staffTokenRecord.staff;
    const newAccessToken = generateAccessToken({
      staffId: staff.id,
      actorType: "staff",
      email: staff.email,
      name: staff.name,
      roleId: staff.role.id,
      roleName: staff.role.name,
      permissions: staff.role.permissions
    });

    return {
      success: true,
      newAccessToken,
      actor: {
        id: staff.id,
        email: staff.email,
        name: staff.name,
        phone: staff.phone,
        isOwner: false,
        actorType: "staff",
        roleId: staff.role.id,
        roleName: staff.role.name,
        permissions: staff.role.permissions as PERMISSIONS[]
      }
    };
  }

  return { success: false, error: "Unknown token subject" };
}
