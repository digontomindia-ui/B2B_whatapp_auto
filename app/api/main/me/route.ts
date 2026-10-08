import { NextRequest, NextResponse } from "next/server";
import { getAuthActor } from "@/lib/rbac";

export async function GET(request: NextRequest) {
  try {
    const actor = await getAuthActor(request);

    return NextResponse.json({
      error: false,
      message: "Profile retrieved successfully",
      data: {
        id: actor.id,
        email: actor.email,
        name: actor.name,
        phone: actor.phone || null,
        isOwner: actor.isOwner,
        actorType: actor.actorType,
        roleId: actor.roleId || null,
        roleName: actor.roleName || (actor.isOwner ? "Administrator" : "Staff"),
        permissions: actor.permissions
      }
    });
  } catch (error: unknown) {
    const isAuthError =
      error instanceof Error &&
      (error.name === "UnauthorizedError" || error.name === "ForbiddenError");

    const status = isAuthError
      ? (error as { statusCode?: number }).statusCode || 401
      : 500;
    const msg = error instanceof Error ? error.message : "Internal server error";

    return NextResponse.json(
      {
        error: true,
        message: msg,
        data: null
      },
      { status }
    );
  }
}
