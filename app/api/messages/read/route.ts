import { NextRequest, NextResponse } from "next/server";
import { markConversationAsRead } from "@/server/messages/service";
import { z } from "zod";

const readSchema = z.object({
  customerId: z.string().uuid("Customer ID is required"),
  conversationId: z.string().uuid().optional()
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = readSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: true,
          message: parsed.error.issues[0]?.message || "Invalid payload",
          data: null
        },
        { status: 400 }
      );
    }

    const result = await markConversationAsRead(parsed.data);

    return NextResponse.json({
      error: false,
      message: "Conversation marked as read",
      data: result
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to mark as read";
    return NextResponse.json(
      { error: true, message: msg, data: null },
      { status: 500 }
    );
  }
}
