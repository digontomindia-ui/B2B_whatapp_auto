import { NextRequest, NextResponse } from "next/server";
import { requirePermission, requireAnyPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import prisma from "@/lib/prisma";
import { z } from "zod";

const customerIdsSchema = z.object({
  customerIds: z
    .array(z.string().uuid("Valid customer ID required"))
    .min(1, "At least one customer ID is required")
});

/**
 * GET /api/groups/[id]/customers
 * Search available customers to add to this group
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireAnyPermission(request, [
      PERMISSIONS.CUSTOMER_VIEW,
      PERMISSIONS.GROUP_MANAGE
    ]);

    const { id } = await context.params;
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim() || "";
    const limit = Math.max(
      1,
      Math.min(50, parseInt(searchParams.get("limit") || "20", 10))
    );

    const where: Record<string, unknown> = {
      // Not already in this group
      groupId: { not: id }
    };

    if (search) {
      where.OR = [
        { customName: { contains: search, mode: "insensitive" } },
        { whatsappName: { contains: search, mode: "insensitive" } },
        { normalizedPhone: { contains: search } },
        { phoneNumber: { contains: search } },
        { companyName: { contains: search, mode: "insensitive" } }
      ];
    }

    const availableCustomers = await prisma.customer.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        phoneNumber: true,
        normalizedPhone: true,
        customName: true,
        whatsappName: true,
        companyName: true,
        status: true,
        state: true,
        groupId: true,
        group: {
          select: {
            id: true,
            name: true,
            color: true
          }
        }
      }
    });

    return NextResponse.json({
      error: false,
      message: "Available customers retrieved successfully",
      data: availableCustomers
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
        : "Failed to fetch available customers";
    return NextResponse.json(
      { error: true, message: msg, data: null },
      { status }
    );
  }
}

/**
 * POST /api/groups/[id]/customers
 * Add customers into this group
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(request, PERMISSIONS.GROUP_MANAGE);

    const { id } = await context.params;

    // Verify group exists
    const group = await prisma.group.findUnique({
      where: { id },
      select: { id: true, name: true }
    });

    if (!group) {
      return NextResponse.json(
        { error: true, message: "Group not found", data: null },
        { status: 404 }
      );
    }

    const body = await request.json();
    const parsed = customerIdsSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: true,
          message: parsed.error.issues[0]?.message || "Invalid customer IDs",
          data: null
        },
        { status: 400 }
      );
    }

    const { customerIds } = parsed.data;

    const result = await prisma.customer.updateMany({
      where: {
        id: { in: customerIds }
      },
      data: {
        groupId: id
      }
    });

    return NextResponse.json({
      error: false,
      message: `Successfully added ${result.count} customer(s) to group "${group.name}"`,
      data: {
        groupId: id,
        count: result.count
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
      err instanceof Error ? err.message : "Failed to add customers to group";
    return NextResponse.json(
      { error: true, message: msg, data: null },
      { status }
    );
  }
}

/**
 * DELETE /api/groups/[id]/customers
 * Remove customers from this group (sets groupId = null)
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(request, PERMISSIONS.GROUP_MANAGE);

    const { id } = await context.params;

    const body = await request.json();
    const parsed = customerIdsSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: true,
          message: parsed.error.issues[0]?.message || "Invalid customer IDs",
          data: null
        },
        { status: 400 }
      );
    }

    const { customerIds } = parsed.data;

    const result = await prisma.customer.updateMany({
      where: {
        id: { in: customerIds },
        groupId: id
      },
      data: {
        groupId: null
      }
    });

    return NextResponse.json({
      error: false,
      message: `Successfully removed ${result.count} customer(s) from group`,
      data: {
        groupId: id,
        count: result.count
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
        : "Failed to remove customers from group";
    return NextResponse.json(
      { error: true, message: msg, data: null },
      { status }
    );
  }
}
