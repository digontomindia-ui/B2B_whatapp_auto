import { NextRequest, NextResponse } from "next/server";
import { syncTemplatesFromMeta } from "@/server/templates/service";
import { requirePermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";

export async function POST(request: NextRequest) {
  try {
    await requirePermission(request, PERMISSIONS.TEMPLATE_CREATE);

    const templates = await syncTemplatesFromMeta();

    return NextResponse.json({
      error: false,
      message: `Successfully synchronized ${templates.length} templates from Meta`,
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
      err instanceof Error ? err.message : "Failed to sync templates from Meta";
    return NextResponse.json(
      { error: true, message: msg, data: null },
      { status }
    );
  }
}
