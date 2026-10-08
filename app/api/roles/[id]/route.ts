import { NextRequest, NextResponse } from "next/server";
import { getRoleById, updateRole, deleteRole } from "@/server/roles/service";
import { requirePermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { z } from "zod";

const updateRoleSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  permissions: z.array(z.number()).optional()
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(request, PERMISSIONS.ROLE_VIEW);
    const { id } = await params;
    const role = await getRoleById(id);

    return NextResponse.json({
      error: false,
      message: "Role fetched successfully",
      data: role
    });
  } catch (err: unknown) {
    const isRbac =
      err instanceof Error &&
      (err.name === "UnauthorizedError" || err.name === "ForbiddenError");
    const status = isRbac ? (err as { statusCode?: number }).statusCode || 403 : 404;
    const msg = err instanceof Error ? err.message : "Role not found";

    return NextResponse.json(
      { error: true, message: msg, data: null },
      { status }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(request, PERMISSIONS.ROLE_MANAGE);
    const { id } = await params;
    const body = await request.json();
    const parsed = updateRoleSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: true,
          message: parsed.error.issues[0]?.message || "Invalid update data",
          data: null
        },
        { status: 400 }
      );
    }

    const updated = await updateRole(id, parsed.data);

    return NextResponse.json({
      error: false,
      message: "Role updated successfully",
      data: updated
    });
  } catch (err: unknown) {
    const isRbac =
      err instanceof Error &&
      (err.name === "UnauthorizedError" || err.name === "ForbiddenError");
    const status = isRbac ? (err as { statusCode?: number }).statusCode || 403 : 400;
    const msg = err instanceof Error ? err.message : "Failed to update role";

    return NextResponse.json(
      { error: true, message: msg, data: null },
      { status }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(request, PERMISSIONS.ROLE_MANAGE);
    const { id } = await params;
    await deleteRole(id);

    return NextResponse.json({
      error: false,
      message: "Role deleted successfully",
      data: null
    });
  } catch (err: unknown) {
    const isRbac =
      err instanceof Error &&
      (err.name === "UnauthorizedError" || err.name === "ForbiddenError");
    const status = isRbac ? (err as { statusCode?: number }).statusCode || 403 : 400;
    const msg = err instanceof Error ? err.message : "Failed to delete role";

    return NextResponse.json(
      { error: true, message: msg, data: null },
      { status }
    );
  }
}
