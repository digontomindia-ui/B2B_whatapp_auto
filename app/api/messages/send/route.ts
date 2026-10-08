import { NextRequest, NextResponse } from "next/server";
import { sendOutboundTextMessage } from "@/server/messages/service";
import { requirePermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { z } from "zod";

const sendTextSchema = z.object({
  customerId: z.string().uuid("Valid customer ID is required"),
  conversationId: z.string().uuid().optional(),
  text: z.string().min(1, "Message text cannot be empty"),
  previewUrl: z.boolean().optional()
});

export async function POST(request: NextRequest) {
  try {
    await requirePermission(request, PERMISSIONS.MESSAGE_SEND);

    const body = await request.json();
    const parsed = sendTextSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: true,
          message: parsed.error.issues[0]?.message || "Invalid message payload",
          data: null
        },
        { status: 400 }
      );
    }

    const message = await sendOutboundTextMessage(parsed.data);

    return NextResponse.json({
      error: message.status === "FAILED",
      message:
        message.status === "FAILED"
          ? message.errorMessage || "Send failed"
          : "Message sent",
      data: message
    });
  } catch (err: unknown) {
    const isRbac =
      err instanceof Error &&
      (err.name === "UnauthorizedError" || err.name === "ForbiddenError");
    const status = isRbac
      ? (err as { statusCode?: number }).statusCode || 403
      : 500;
    const msg = err instanceof Error ? err.message : "Failed to send message";
    return NextResponse.json(
      { error: true, message: msg, data: null },
      { status }
    );
  }
}
