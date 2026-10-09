import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions";
import { CustomerState } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const actor = await requirePermission(request, PERMISSIONS.CUSTOMER_VIEW);

    const where: Record<string, unknown> = {};
    const isStaffScoped = actor.actorType === "staff" && !actor.isOwner;

    if (isStaffScoped) {
      where.assignedStaffId = actor.id;
    }

    const [total, active, blocked, optedOut] = await Promise.all([
      prisma.customer.count({ where }),
      prisma.customer.count({
        where: { ...where, state: CustomerState.ACTIVE }
      }),
      prisma.customer.count({
        where: { ...where, state: CustomerState.BLOCKED }
      }),
      prisma.customer.count({
        where: { ...where, state: CustomerState.OPTED_OUT }
      })
    ]);

    return NextResponse.json({
      error: false,
      message: "Customer audience stats fetched",
      data: {
        total,
        active,
        blocked,
        optedOut,
        scopedToStaff: isStaffScoped,
        staffName: isStaffScoped ? actor.name : null
      }
    });
  } catch (err: unknown) {
    const isRbac =
      err instanceof Error &&
      (err.name === "UnauthorizedError" || err.name === "ForbiddenError");
    const status = isRbac
      ? (err as { statusCode?: number }).statusCode || 403
      : 500;
    const msg =
      err instanceof Error
        ? err.message
        : "Failed to fetch customer audience stats";
    return NextResponse.json(
      { error: true, message: msg, data: null },
      { status }
    );
  }
}
