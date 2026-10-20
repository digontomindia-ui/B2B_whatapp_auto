import { NextRequest, NextResponse } from "next/server";
import { createBulkMessageJob } from "@/server/bulk/service";
import { requirePermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { z } from "zod";

const bulkMessageSchema = z.object({
  title: z.string().optional(),
  content: z.string().min(1, "Message content cannot be empty"),
  targetMode: z.enum(["ALL", "CUSTOM", "GROUPS"]).default("CUSTOM"),
  customerIds: z.array(z.string().uuid()).optional(),
  groupIds: z.array(z.string().uuid()).optional(),
  allowOverrideBlocked: z.boolean().default(false)
});

export async function POST(request: NextRequest) {
  try {
    const actor = await requirePermission(
      request,
      PERMISSIONS.BULK_MESSAGE_SEND
    );

    const body = await request.json();
    const parsed = bulkMessageSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: true,
          message:
            parsed.error.issues[0]?.message || "Invalid bulk message payload",
          data: null
        },
        { status: 400 }
      );
    }

    if (
      parsed.data.targetMode === "CUSTOM" &&
      (!parsed.data.customerIds || parsed.data.customerIds.length === 0)
    ) {
      return NextResponse.json(
        {
          error: true,
          message: "Please select at least one recipient for custom broadcast",
          data: null
        },
        { status: 400 }
      );
    }

    if (
      parsed.data.targetMode === "GROUPS" &&
      (!parsed.data.groupIds || parsed.data.groupIds.length === 0)
    ) {
      return NextResponse.json(
        {
          error: true,
          message: "Please select at least one group for broadcast",
          data: null
        },
        { status: 400 }
      );
    }

    const assignedStaffId =
      actor.actorType === "staff" && !actor.isOwner ? actor.id : undefined;

    const result = await createBulkMessageJob({
      type: "MESSAGE",
      title: parsed.data.title,
      content: parsed.data.content,
      targetMode: parsed.data.targetMode,
      customerIds: parsed.data.customerIds,
      groupIds: parsed.data.groupIds,
      assignedStaffId,
      allowOverrideBlocked: parsed.data.allowOverrideBlocked,
      createdByAdminId: actor.id
    });

    return NextResponse.json({
      error: false,
      message: "Bulk message broadcast initiated",
      data: result
    });
  } catch (err: unknown) {
    const isRbac =
      err instanceof Error &&
      (err.name === "UnauthorizedError" || err.name === "ForbiddenError");
    const status = isRbac
      ? (err as { statusCode?: number }).statusCode || 403
      : 500;
    const msg =
      err instanceof Error ? err.message : "Failed to initiate bulk broadcast";
    return NextResponse.json(
      { error: true, message: msg, data: null },
      { status }
    );
  }
}
