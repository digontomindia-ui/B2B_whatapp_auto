import { NextRequest, NextResponse } from "next/server";
import { listStaff, createStaff } from "@/server/staff/service";
import { requirePermission, requireOwner } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { z } from "zod";

const createStaffSchema = z.object({
  email: z.string().email("Valid email is required"),
  name: z.string().min(1, "Name is required"),
  phone: z.string().optional().nullable(),
  password: z.string().min(6, "Password must be at least 6 characters"),
  roleId: z.string().uuid("Valid role ID is required")
});

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, PERMISSIONS.STAFF_VIEW);
    const staffMembers = await listStaff();

    return NextResponse.json({
      error: false,
      message: "Staff list retrieved successfully",
      data: staffMembers
    });
  } catch (err: unknown) {
    const isRbac =
      err instanceof Error &&
      (err.name === "UnauthorizedError" || err.name === "ForbiddenError");
    const status = isRbac
      ? (err as { statusCode?: number }).statusCode || 403
      : 500;
    const msg =
      err instanceof Error ? err.message : "Failed to fetch staff list";

    return NextResponse.json(
      { error: true, message: msg, data: null },
      { status }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Only admin can add staff as per requirement
    await requireOwner(request);

    const body = await request.json();
    const parsed = createStaffSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: true,
          message: parsed.error.issues[0]?.message || "Invalid staff input",
          data: null
        },
        { status: 400 }
      );
    }

    const newStaff = await createStaff(parsed.data);

    return NextResponse.json({
      error: false,
      message: "Staff member created successfully",
      data: newStaff
    });
  } catch (err: unknown) {
    const isRbac =
      err instanceof Error &&
      (err.name === "UnauthorizedError" || err.name === "ForbiddenError");
    const status = isRbac
      ? (err as { statusCode?: number }).statusCode || 403
      : 400;
    const msg =
      err instanceof Error ? err.message : "Failed to create staff member";

    return NextResponse.json(
      { error: true, message: msg, data: null },
      { status }
    );
  }
}
