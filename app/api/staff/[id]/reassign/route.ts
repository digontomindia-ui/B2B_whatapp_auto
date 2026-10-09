import { NextRequest, NextResponse } from "next/server";
import { reassignStaffCustomers } from "@/server/staff/service";
import { requirePermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { z } from "zod";

const reassignSchema = z.object({
  toStaffId: z.string().nullable(),
  customerIds: z.array(z.string()).optional()
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(request, PERMISSIONS.CUSTOMER_ASSIGN);
    const { id: fromStaffId } = await context.params;
    const body = await request.json();
    const parsed = reassignSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: true,
          message:
            parsed.error.issues[0]?.message || "Invalid reassign payload",
          data: null
        },
        { status: 400 }
      );
    }

    const result = await reassignStaffCustomers({
      fromStaffId,
      toStaffId: parsed.data.toStaffId,
      customerIds: parsed.data.customerIds
    });

    return NextResponse.json({
      error: false,
      message: `Successfully reassigned ${result.count} customers`,
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
      err instanceof Error ? err.message : "Failed to reassign customers";

    return NextResponse.json(
      { error: true, message: msg, data: null },
      { status }
    );
  }
}
