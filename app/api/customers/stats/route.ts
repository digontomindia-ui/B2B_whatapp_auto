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

    const [total, active, blocked, optedOut, hot, warm, cold, statusGroups] =
      await Promise.all([
        prisma.customer.count({ where }),
        prisma.customer.count({
          where: { ...where, state: CustomerState.ACTIVE }
        }),
        prisma.customer.count({
          where: { ...where, state: CustomerState.BLOCKED }
        }),
        prisma.customer.count({
          where: { ...where, state: CustomerState.OPTED_OUT }
        }),
        prisma.customer.count({
          where: { ...where, status: "HOT" }
        }),
        prisma.customer.count({
          where: { ...where, status: "WARM" }
        }),
        prisma.customer.count({
          where: { ...where, status: "COLD" }
        }),
        prisma.customer.groupBy({
          by: ["status", "state"],
          where,
          _count: { _all: true }
        })
      ]);

    const statusBreakdown = {
      HOT: { total: hot, active: 0, blocked: 0, optedOut: 0 },
      WARM: { total: warm, active: 0, blocked: 0, optedOut: 0 },
      COLD: { total: cold, active: 0, blocked: 0, optedOut: 0 }
    };

    statusGroups.forEach((g) => {
      const s = g.status as "HOT" | "WARM" | "COLD";
      if (statusBreakdown[s]) {
        if (g.state === CustomerState.ACTIVE) {
          statusBreakdown[s].active += g._count._all;
        } else if (g.state === CustomerState.BLOCKED) {
          statusBreakdown[s].blocked += g._count._all;
        } else if (g.state === CustomerState.OPTED_OUT) {
          statusBreakdown[s].optedOut += g._count._all;
        }
      }
    });

    return NextResponse.json({
      error: false,
      message: "Customer audience stats fetched",
      data: {
        total,
        active,
        blocked,
        optedOut,
        hot,
        warm,
        cold,
        statusBreakdown,
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
