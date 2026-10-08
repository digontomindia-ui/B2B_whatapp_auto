import { NextRequest, NextResponse } from "next/server";
import { listTemplates } from "@/server/templates/service";
import { requirePermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, PERMISSIONS.TEMPLATE_VIEW);

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || undefined;
    const category = searchParams.get("category") || undefined;
    const search = searchParams.get("search") || undefined;

    const templates = await listTemplates({ status, category, search });

    return NextResponse.json({
      error: false,
      message: "Templates retrieved successfully",
      data: templates
    });
  } catch (err: unknown) {
    const isRbac =
      err instanceof Error &&
      (err.name === "UnauthorizedError" || err.name === "ForbiddenError");
    const status = isRbac
      ? (err as { statusCode?: number }).statusCode || 403
      : 500;
    const msg =
      err instanceof Error ? err.message : "Failed to fetch templates";
    return NextResponse.json(
      { error: true, message: msg, data: null },
      { status }
    );
  }
}
