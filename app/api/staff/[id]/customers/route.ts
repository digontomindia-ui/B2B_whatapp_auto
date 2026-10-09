import { NextRequest, NextResponse } from "next/server";
import { getStaffAssignedCustomers } from "@/server/staff/service";
import { requirePermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(request, PERMISSIONS.STAFF_VIEW);
    const { id } = await context.params;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const search = searchParams.get("search") || "";

    const result = await getStaffAssignedCustomers(id, { page, limit, search });

    return NextResponse.json({
      error: false,
      message: "Assigned customers fetched successfully",
      data: result.customers,
      pagination: result.pagination
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
        : "Failed to fetch staff assigned customers";

    return NextResponse.json(
      { error: true, message: msg, data: null },
      { status }
    );
  }
}
