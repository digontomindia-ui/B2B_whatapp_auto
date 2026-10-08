import { NextRequest, NextResponse } from "next/server";
import { sendOutboundTemplateMessage } from "@/server/messages/service";
import prisma from "@/lib/prisma";
import { requirePermission, requireAnyPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { z } from "zod";

const sendTemplateSchema = z.object({
  customerId: z.string().uuid("Valid customer ID is required"),
  conversationId: z.string().uuid().optional(),
  templateId: z.string().optional(),
  templateName: z.string().min(1, "Template name is required"),
  language: z.string().default("en"),
  components: z.array(z.any()).default([])
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = sendTemplateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: true,
          message:
            parsed.error.issues[0]?.message || "Invalid template payload",
          data: null
        },
        { status: 400 }
      );
    }

    // Determine if utility or marketing template permission is required
    const tmpl = await prisma.whatsappTemplate.findFirst({
      where: { name: parsed.data.templateName }
    });

    if (tmpl?.category === "MARKETING") {
      await requirePermission(request, PERMISSIONS.MESSAGE_SEND_MARKETING);
    } else if (tmpl?.category === "UTILITY") {
      await requirePermission(request, PERMISSIONS.MESSAGE_SEND_UTILITY);
    } else {
      await requireAnyPermission(request, [
        PERMISSIONS.MESSAGE_SEND_UTILITY,
        PERMISSIONS.MESSAGE_SEND_MARKETING
      ]);
    }

    const message = await sendOutboundTemplateMessage(parsed.data);

    return NextResponse.json({
      error: message.status === "FAILED",
      message:
        message.status === "FAILED"
          ? message.errorMessage || "Send failed"
          : "Template message sent",
      data: message
    });
  } catch (err: unknown) {
    const isRbac =
      err instanceof Error &&
      (err.name === "UnauthorizedError" || err.name === "ForbiddenError");
    const status = isRbac ? (err as { statusCode?: number }).statusCode || 403 : 500;
    const msg =
      err instanceof Error ? err.message : "Failed to send template message";
    return NextResponse.json(
      { error: true, message: msg, data: null },
      { status }
    );
  }
}
