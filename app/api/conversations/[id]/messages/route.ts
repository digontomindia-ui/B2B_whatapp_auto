import { NextRequest, NextResponse } from "next/server";
import { getConversationMessages } from "@/server/messages/service";
import { requirePermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(request, PERMISSIONS.CONVERSATION_VIEW);

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
    const isRbac =
      err instanceof Error &&
      (err.name === "UnauthorizedError" || err.name === "ForbiddenError");
    const status = isRbac ? (err as { statusCode?: number }).statusCode || 403 : 500;
    const msg =
      err instanceof Error ? err.message : "Failed to fetch messages";
    return NextResponse.json(
      { error: true, message: msg, data: null },
      { status }
    );
  }
}
