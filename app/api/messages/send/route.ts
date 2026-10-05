import { NextRequest, NextResponse } from "next/server";
import { sendOutboundTextMessage } from "@/server/messages/service";
import { z } from "zod";

const sendTextSchema = z.object({
  customerId: z.string().uuid("Valid customer ID is required"),
  conversationId: z.string().uuid().optional(),
  text: z.string().min(1, "Message text cannot be empty"),
  previewUrl: z.boolean().optional()
});

export async function POST(request: NextRequest) {
  try {
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
    const msg = err instanceof Error ? err.message : "Failed to send message";
    return NextResponse.json(
      { error: true, message: msg, data: null },
      { status: 500 }
    );
  }
}
