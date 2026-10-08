import { NextRequest, NextResponse } from "next/server";
import { listBulkJobs } from "@/server/bulk/service";
import { requirePermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, PERMISSIONS.BULK_JOB_VIEW);

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const limit = Math.max(
      1,
      Math.min(50, Number(searchParams.get("limit") || 20))
    );

    const result = await listBulkJobs(page, limit);

    return NextResponse.json({
      error: false,
      message: "Bulk jobs retrieved",
      data: result
    });
  } catch (err: unknown) {
    const isRbac =
      err instanceof Error &&
      (err.name === "UnauthorizedError" || err.name === "ForbiddenError");
    const status = isRbac
      ? (err as { statusCode?: number }).statusCode || 403
      : 500;
    const msg =
      err instanceof Error ? err.message : "Failed to fetch bulk jobs";
    return NextResponse.json(
      { error: true, message: msg, data: null },
      { status }
    );
  }
}
