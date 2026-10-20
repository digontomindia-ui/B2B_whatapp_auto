import { NextRequest, NextResponse } from "next/server";
import { requirePermission, requireAnyPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import prisma from "@/lib/prisma";
import { z } from "zod";

const updateGroupSchema = z.object({
  name: z.string().trim().min(1, "Group name cannot be empty").optional(),
  description: z.string().trim().optional().nullable(),
  color: z.string().trim().optional()
});

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
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get("limit") || "10", 10)));
    const search = searchParams.get("search")?.trim() || "";

    const group = await prisma.group.findUniqueOrThrow({
      where: { id },
      include: {
        _count: { select: { customers: true } }
      }
    });

    // Customer search filter within this group
    const customerWhere: Record<string, unknown> = {
      groupId: id
    };

    if (search) {
      customerWhere.OR = [
        { customName: { contains: search, mode: "insensitive" } },
        { whatsappName: { contains: search, mode: "insensitive" } },
        { normalizedPhone: { contains: search } },
        { phoneNumber: { contains: search } },
        { companyName: { contains: search, mode: "insensitive" } }
      ];
    }

    const [totalCustomersInGroup, filteredCustomersCount, customers] =
      await Promise.all([
        prisma.customer.count({ where: { groupId: id } }),
        prisma.customer.count({ where: customerWhere }),
        prisma.customer.findMany({
          where: customerWhere,
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * limit,
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
            createdAt: true,
            lastInteractionAt: true,
            assignedStaff: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        })
      ]);

    // Broadcasts that targeted this group
    const allBroadcasts = await prisma.bulkMessageJob.findMany({
      where: {
        OR: [
          {
            recipients: {
              some: {
                customer: { groupId: id }
              }
            }
          }
        ]
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        type: true,
        status: true,
        title: true,
        totalRecipients: true,
        sentCount: true,
        deliveredCount: true,
        readCount: true,
        failedCount: true,
        createdAt: true,
        completedAt: true
      }
    });

    const totalSent = allBroadcasts.reduce((sum, b) => sum + (b.sentCount || 0), 0);
    const totalDelivered = allBroadcasts.reduce((sum, b) => sum + (b.deliveredCount || 0), 0);
    const totalRead = allBroadcasts.reduce((sum, b) => sum + (b.readCount || 0), 0);

    return NextResponse.json({
      error: false,
      message: "Group retrieved successfully",
      data: {
        group: {
          id: group.id,
          name: group.name,
          description: group.description,
          color: group.color,
          createdAt: group.createdAt,
          updatedAt: group.updatedAt
        },
        pagination: {
          page,
          limit,
          total: filteredCustomersCount,
          totalPages: Math.ceil(filteredCustomersCount / limit) || 1
        },
        customers,
        broadcasts: allBroadcasts,
        stats: {
          customerCount: totalCustomersInGroup,
          broadcastCount: allBroadcasts.length,
          totalSent,
          totalDelivered,
          totalRead,
          deliveryRate: totalSent > 0 ? Math.round((totalDelivered / totalSent) * 100) : 0,
          readRate: totalDelivered > 0 ? Math.round((totalRead / totalDelivered) * 100) : 0
        }
      }
    });
  } catch (err: unknown) {
    const isRbac =
      err instanceof Error &&
      (err.name === "UnauthorizedError" || err.name === "ForbiddenError");
    const status = isRbac
      ? (err as { statusCode?: number }).statusCode || 403
      : 404;
    const msg = err instanceof Error ? err.message : "Group not found";
    return NextResponse.json(
      { error: true, message: msg, data: null },
      { status }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(request, PERMISSIONS.GROUP_MANAGE);

    const { id } = await context.params;
    const body = await request.json();
    const parsed = updateGroupSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: true,
          message: parsed.error.issues[0]?.message || "Invalid update data",
          data: null
        },
        { status: 400 }
      );
    }

    const { name, description, color } = parsed.data;

    if (name) {
      const duplicate = await prisma.group.findFirst({
        where: {
          name: { equals: name, mode: "insensitive" },
          id: { not: id }
        }
      });
      if (duplicate) {
        return NextResponse.json(
          {
            error: true,
            message: `A group with name "${name}" already exists`,
            data: null
          },
          { status: 400 }
        );
      }
    }

    const updated = await prisma.group.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(color !== undefined ? { color } : {})
      },
      include: {
        _count: { select: { customers: true } }
      }
    });

    return NextResponse.json({
      error: false,
      message: "Group updated successfully",
      data: updated
    });
  } catch (err: unknown) {
    const isRbac =
      err instanceof Error &&
      (err.name === "UnauthorizedError" || err.name === "ForbiddenError");
    const status = isRbac
      ? (err as { statusCode?: number }).statusCode || 403
      : 400;
    const msg = err instanceof Error ? err.message : "Failed to update group";
    return NextResponse.json(
      { error: true, message: msg, data: null },
      { status }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(request, PERMISSIONS.GROUP_MANAGE);

    const { id } = await context.params;

    // Disassociate customers first (onDelete: SetNull handles this, but explicit is even safer)
    await prisma.customer.updateMany({
      where: { groupId: id },
      data: { groupId: null }
    });

    const deleted = await prisma.group.delete({
      where: { id }
    });

    return NextResponse.json({
      error: false,
      message: "Group deleted successfully",
      data: { id: deleted.id, name: deleted.name }
    });
  } catch (err: unknown) {
    const isRbac =
      err instanceof Error &&
      (err.name === "UnauthorizedError" || err.name === "ForbiddenError");
    const status = isRbac
      ? (err as { statusCode?: number }).statusCode || 403
      : 400;
    const msg = err instanceof Error ? err.message : "Failed to delete group";
    return NextResponse.json(
      { error: true, message: msg, data: null },
      { status }
    );
  }
}
