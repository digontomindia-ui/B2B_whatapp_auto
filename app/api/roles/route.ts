import { NextRequest, NextResponse } from "next/server";
import { listRoles, createRole } from "@/server/roles/service";
import { requirePermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { z } from "zod";

const createRoleSchema = z.object({
  name: z.string().min(1, "Role name is required"),
  description: z.string().optional().nullable(),
  permissions: z.array(z.number())
});

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, PERMISSIONS.ROLE_VIEW);
    const roles = await listRoles();

    return NextResponse.json({
      error: false,
      message: "Roles fetched successfully",
      data: roles
    });
  } catch (err: unknown) {
    const isRbac =
      err instanceof Error &&
      (err.name === "UnauthorizedError" || err.name === "ForbiddenError");
    const status = isRbac
      ? (err as { statusCode?: number }).statusCode || 403
      : 500;
    const msg = err instanceof Error ? err.message : "Failed to fetch roles";

    return NextResponse.json(
      { error: true, message: msg, data: null },
      { status }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requirePermission(request, PERMISSIONS.ROLE_MANAGE);
    const body = await request.json();
    const parsed = createRoleSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: true,
          message: parsed.error.issues[0]?.message || "Invalid role input",
          data: null
        },
        { status: 400 }
      );
    }

    const role = await createRole(parsed.data);

    return NextResponse.json({
      error: false,
      message: "Role created successfully",
      data: role
    });
  } catch (err: unknown) {
    const isRbac =
      err instanceof Error &&
      (err.name === "UnauthorizedError" || err.name === "ForbiddenError");
    const status = isRbac
      ? (err as { statusCode?: number }).statusCode || 403
      : 400;
    const msg = err instanceof Error ? err.message : "Failed to create role";

    return NextResponse.json(
      { error: true, message: msg, data: null },
      { status }
    );
  }
}
