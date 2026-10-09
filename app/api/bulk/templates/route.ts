import { NextRequest, NextResponse } from "next/server";
import { requirePermission, requireAnyPermission } from "@/lib/rbac";
import { createBulkMessageJob } from "@/server/bulk/service";
import prisma from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions";
import { z } from "zod";

const bulkTemplateSchema = z.object({
  title: z.string().optional(),
  templateId: z.string().optional(),
  templateName: z.string().min(1, "Template name is required"),
  language: z.string().default("en"),
  components: z.array(z.any()).default([]),
  targetMode: z.enum(["ALL", "CUSTOM"]).default("CUSTOM"),
  customerIds: z.array(z.string().uuid()).optional(),
  variableConfigurations: z.record(z.string(), z.any()).optional(),
  allowOverrideBlocked: z.boolean().default(false)
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = bulkTemplateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: true,
          message:
            parsed.error.issues[0]?.message || "Invalid bulk template payload",
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

    // Determine utility vs marketing permission
    const tmpl = await prisma.whatsappTemplate.findFirst({
      where: { name: parsed.data.templateName }
    });

    let actor;
    if (tmpl?.category === "MARKETING") {
      actor = await requirePermission(request, PERMISSIONS.BULK_MARKETING_SEND);
    } else if (tmpl?.category === "UTILITY") {
      actor = await requirePermission(request, PERMISSIONS.BULK_UTILITY_SEND);
    } else {
      actor = await requireAnyPermission(request, [
        PERMISSIONS.BULK_UTILITY_SEND,
        PERMISSIONS.BULK_MARKETING_SEND
      ]);
    }

    const assignedStaffId =
      actor.actorType === "staff" && !actor.isOwner ? actor.id : undefined;

    const result = await createBulkMessageJob({
      type: "TEMPLATE",
      title: parsed.data.title,
      templateId: parsed.data.templateId,
      templateName: parsed.data.templateName,
      language: parsed.data.language,
      components: parsed.data.components,
      targetMode: parsed.data.targetMode,
      customerIds: parsed.data.customerIds,
      assignedStaffId,
      variableConfigurations: parsed.data.variableConfigurations,
      allowOverrideBlocked: parsed.data.allowOverrideBlocked,
      createdByAdminId: actor.id
    });

    return NextResponse.json({
      error: false,
      message: "Bulk template broadcast initiated",
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
      err instanceof Error
        ? err.message
        : "Failed to initiate bulk template broadcast";
    return NextResponse.json(
      { error: true, message: msg, data: null },
      { status }
    );
  }
}
