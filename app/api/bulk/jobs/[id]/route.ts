import { NextRequest, NextResponse } from "next/server";
import { getBulkJob } from "@/server/bulk/service";
import { requirePermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(request, PERMISSIONS.BULK_JOB_VIEW);

    const { id } = await context.params;
    const job = await getBulkJob(id);

    return NextResponse.json({
      error: false,
      message: "Bulk job retrieved",
      data: job
    });
  } catch (err: unknown) {
    const isRbac =
      err instanceof Error &&
      (err.name === "UnauthorizedError" || err.name === "ForbiddenError");
    const status = isRbac
      ? (err as { statusCode?: number }).statusCode || 403
      : 404;
    const msg = err instanceof Error ? err.message : "Bulk job not found";
    return NextResponse.json(
      { error: true, message: msg, data: null },
      { status }
    );
  }
}
