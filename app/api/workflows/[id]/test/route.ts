import { NextRequest, NextResponse } from "next/server";
import { triggerWorkflowForCustomer } from "@/server/workflows/service";
import { requirePermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { z } from "zod";

const testSchema = z.object({
  customerId: z.string().min(1, "Customer ID is required")
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(request, PERMISSIONS.WORKFLOW_MANAGE);
    const { id } = await context.params;
    const body = await request.json();
    const parsed = testSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: true,
          message: parsed.error.issues[0]?.message || "Invalid customer ID",
          data: null
        },
        { status: 400 }
      );
    }

    const execution = await triggerWorkflowForCustomer(
      id,
      parsed.data.customerId
    );

    if (!execution) {
      return NextResponse.json(
        {
          error: true,
          message:
            "Workflow could not be started. Check if it is active and has valid steps.",
          data: null
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      error: false,
      message: "Workflow test triggered successfully",
      data: execution
    });
  } catch (err: unknown) {
    const isRbac =
      err instanceof Error &&
      (err.name === "UnauthorizedError" || err.name === "ForbiddenError");
    const status = isRbac
      ? (err as { statusCode?: number }).statusCode || 403
      : 500;
    const msg =
      err instanceof Error ? err.message : "Failed to trigger workflow";

    return NextResponse.json(
      { error: true, message: msg, data: null },
      { status }
    );
  }
}
