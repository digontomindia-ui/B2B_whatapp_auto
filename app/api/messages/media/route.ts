import { NextRequest, NextResponse } from "next/server";
import { sendOutboundMediaMessage } from "@/server/messages/service";
import { z } from "zod";

const sendMediaSchema = z.object({
  customerId: z.string().uuid("Valid customer ID is required"),
  conversationId: z.string().uuid().optional(),
  type: z.enum(["IMAGE", "VIDEO", "AUDIO", "DOCUMENT", "STICKER"]),
  caption: z.string().optional(),
  fileName: z.string().optional(),
  mimeType: z.string().default("application/octet-stream"),
  mediaLink: z.string().url().optional(),
  base64Data: z.string().optional()
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = sendMediaSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: true,
          message: parsed.error.issues[0]?.message || "Invalid media payload",
          data: null
        },
        { status: 400 }
      );
    }

    const message = await sendOutboundMediaMessage(parsed.data);

    return NextResponse.json({
      error: message.status === "FAILED",
      message:
        message.status === "FAILED"
          ? message.errorMessage || "Send failed"
          : "Media message sent",
      data: message
    });
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : "Failed to send media message";
    return NextResponse.json(
      { error: true, message: msg, data: null },
      { status: 500 }
    );
  }
}
