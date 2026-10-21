import { NextRequest, NextResponse } from "next/server";
import { getFundsData } from "@/server/funds/service";
import { requirePermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";

export async function GET(request: NextRequest) {
  try {
    // Requires TEMPLATE_VIEW, SETTINGS_VIEW, or owner
    await requirePermission(request, PERMISSIONS.TEMPLATE_VIEW);

    const data = await getFundsData();

    return NextResponse.json({
      error: false,
      message: "Funds data retrieved successfully",
      data
    });
  } catch (err: unknown) {
    const isRbac =
      err instanceof Error &&
      (err.message.includes("Unauthorized") ||
        err.message.includes("Forbidden") ||
        err.message.includes("Missing required permission"));

    return NextResponse.json(
      {
        error: true,
        message:
          err instanceof Error
            ? err.message
            : "Failed to retrieve WhatsApp funds data"
      },
      { status: isRbac ? 403 : 500 }
    );
  }
}
