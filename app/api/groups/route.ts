import { NextRequest, NextResponse } from "next/server";
import { requirePermission, requireAnyPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import prisma from "@/lib/prisma";
import { z } from "zod";

const createGroupSchema = z.object({
  name: z.string().trim().min(1, "Group name is required"),
  description: z.string().trim().optional().nullable(),
  color: z.string().trim().default("#f6821f")
});

export async function GET(request: NextRequest) {
  try {
    await requireAnyPermission(request, [
      PERMISSIONS.CUSTOMER_VIEW,
      PERMISSIONS.GROUP_MANAGE,
      PERMISSIONS.BULK_JOB_VIEW,
      PERMISSIONS.BULK_MESSAGE_SEND,
      PERMISSIONS.BULK_MARKETING_SEND,
      PERMISSIONS.BULK_UTILITY_SEND
    ]);

    const groups = await prisma.group.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: { customers: true }
        }
      }
    });

    // Count broadcasts targeting each group
    const allBulkJobs = await prisma.bulkMessageJob.findMany({
      select: {
        id: true,
        createdAt: true,
        rawMetadata: true,
        recipients: {
          select: {
            customer: {
              select: { groupId: true }
            }
          }
        }
      }
    });

    const enrichedGroups = groups.map((g) => {
      const matchingJobs = allBulkJobs.filter((job) => {
        const meta = job.rawMetadata as Record<string, unknown> | null;
        if (Array.isArray(meta?.groupIds) && meta.groupIds.includes(g.id)) {
          return true;
        }
        return job.recipients.some((r) => r.customer?.groupId === g.id);
      });

      const lastJob = matchingJobs.reduce(
        (latest, j) => {
          return !latest || j.createdAt > latest.createdAt ? j : latest;
        },
        null as (typeof allBulkJobs)[0] | null
      );

      return {
        id: g.id,
        name: g.name,
        description: g.description,
        color: g.color,
        createdAt: g.createdAt,
        updatedAt: g.updatedAt,
        customerCount: g._count.customers,
        broadcastCount: matchingJobs.length,
        lastBroadcastAt: lastJob?.createdAt || null
      };
    });

    return NextResponse.json({
      error: false,
      message: "Groups fetched successfully",
      data: enrichedGroups
    });
  } catch (err: unknown) {
    const isRbac =
      err instanceof Error &&
      (err.name === "UnauthorizedError" || err.name === "ForbiddenError");
    const status = isRbac
      ? (err as { statusCode?: number }).statusCode || 403
      : 500;
    const msg = err instanceof Error ? err.message : "Failed to fetch groups";
    return NextResponse.json(
      { error: true, message: msg, data: null },
      { status }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requirePermission(request, PERMISSIONS.GROUP_MANAGE);

    const body = await request.json();
    const parsed = createGroupSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: true,
          message: parsed.error.issues[0]?.message || "Invalid group payload",
          data: null
        },
        { status: 400 }
      );
    }

    const { name, description, color } = parsed.data;

    // Check case-insensitive duplicate
    const existing = await prisma.group.findFirst({
      where: {
        name: { equals: name, mode: "insensitive" }
      }
    });

    if (existing) {
      return NextResponse.json(
        {
          error: true,
          message: `A group with name "${name}" already exists`,
          data: null
        },
        { status: 400 }
      );
    }

    const group = await prisma.group.create({
      data: {
        name,
        description: description || null,
        color
      },
      include: {
        _count: {
          select: { customers: true }
        }
      }
    });

    return NextResponse.json(
      {
        error: false,
        message: "Group created successfully",
        data: group
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    const isRbac =
      err instanceof Error &&
      (err.name === "UnauthorizedError" || err.name === "ForbiddenError");
    const status = isRbac
      ? (err as { statusCode?: number }).statusCode || 403
      : 500;
    const msg = err instanceof Error ? err.message : "Failed to create group";
    return NextResponse.json(
      { error: true, message: msg, data: null },
      { status }
    );
  }
}
