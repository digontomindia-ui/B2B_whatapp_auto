import { NextRequest, NextResponse } from "next/server";
import { createBulkMessageJob } from "@/server/bulk/service";
import prisma from "@/lib/prisma";
import { requirePermission, requireAnyPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { z } from "zod";

const bulkTemplateSchema = z.object({
  title: z.string().optional(),
  templateId: z.string().optional(),
  templateName: z.string().min(1, "Template name is required"),
  language: z.string().default("en"),
  components: z.array(z.any()).default([]),
  customerIds: z
    .array(z.string().uuid())
    .min(1, "At least one recipient is required"),
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

    const result = await createBulkMessageJob({
      type: "TEMPLATE",
      title: parsed.data.title,
      templateId: parsed.data.templateId,
      templateName: parsed.data.templateName,
      language: parsed.data.language,
      components: parsed.data.components,
      customerIds: parsed.data.customerIds,
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
    const status = isRbac ? (err as { statusCode?: number }).statusCode || 403 : 500;
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
