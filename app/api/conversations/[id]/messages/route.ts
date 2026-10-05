import { NextRequest, NextResponse } from "next/server";
import { getConversationMessages } from "@/server/messages/service";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { searchParams } = new URL(request.url);

    const limit = Math.max(
      1,
      Math.min(100, Number(searchParams.get("limit") || 50))
    );
    const beforeCursor = searchParams.get("beforeCursor") || undefined;

    const messages = await getConversationMessages(id, { limit, beforeCursor });

    return NextResponse.json({
      error: false,
      message: "Messages fetched successfully",
      data: messages
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to fetch messages";
    return NextResponse.json(
      { error: true, message: msg, data: null },
      { status: 500 }
    );
  }
}
