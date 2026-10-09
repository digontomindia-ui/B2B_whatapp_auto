import { getStaffById, updateStaff, deleteStaff } from "@/server/staff/service";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission, requireOwner } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { z } from "zod";

const updateStaffSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional().nullable(),
  roleId: z.string().uuid().optional(),
  password: z.string().min(6).optional(),
  isActive: z.boolean().optional()
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(request, PERMISSIONS.STAFF_VIEW);
    const { id } = await params;
    const staff = await getStaffById(id);

    return NextResponse.json({
      error: false,
      message: "Staff member retrieved successfully",
      data: staff
    });
  } catch (err: unknown) {
    const isRbac =
      err instanceof Error &&
      (err.name === "UnauthorizedError" || err.name === "ForbiddenError");
    const status = isRbac
      ? (err as { statusCode?: number }).statusCode || 403
      : 404;
    const msg = err instanceof Error ? err.message : "Staff member not found";

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
    await requireOwner(request);
    const { id } = await params;
    const body = await request.json();
    const parsed = updateStaffSchema.safeParse(body);

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

    const updated = await updateStaff(id, parsed.data);

    return NextResponse.json({
      error: false,
      message: "Staff member updated successfully",
      data: updated
    });
  } catch (err: unknown) {
    const isRbac =
      err instanceof Error &&
      (err.name === "UnauthorizedError" || err.name === "ForbiddenError");
    const status = isRbac
      ? (err as { statusCode?: number }).statusCode || 403
      : 400;
    const msg =
      err instanceof Error ? err.message : "Failed to update staff member";

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
    await requireOwner(request);
    const { id } = await params;
    await deleteStaff(id);

    return NextResponse.json({
      error: false,
      message: "Staff member deleted successfully",
      data: null
    });
  } catch (err: unknown) {
    const isRbac =
      err instanceof Error &&
      (err.name === "UnauthorizedError" || err.name === "ForbiddenError");
    const status = isRbac
      ? (err as { statusCode?: number }).statusCode || 403
      : 400;
    const msg =
      err instanceof Error ? err.message : "Failed to delete staff member";

    return NextResponse.json(
      { error: true, message: msg, data: null },
      { status }
    );
  }
}
