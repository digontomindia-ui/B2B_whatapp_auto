import {
  getWorkflowById,
  updateWorkflow,
  deleteWorkflow
} from "@/server/workflows/service";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { z } from "zod";

const updateWorkflowSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  triggerType: z.enum(["KEYWORD", "ANY_INBOUND", "MANUAL"]).optional(),
  triggerKeywords: z.array(z.string()).optional(),
  steps: z.array(z.any()).optional()
});

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(request, PERMISSIONS.WORKFLOW_VIEW);
    const { id } = await context.params;

    const workflow = await getWorkflowById(id);
    if (!workflow) {
      return NextResponse.json(
        { error: true, message: "Workflow not found", data: null },
        { status: 404 }
      );
    }

    return NextResponse.json({
      error: false,
      message: "Workflow fetched successfully",
      data: workflow
    });
  } catch (err: unknown) {
    const isRbac =
      err instanceof Error &&
      (err.name === "UnauthorizedError" || err.name === "ForbiddenError");
    const status = isRbac
      ? (err as { statusCode?: number }).statusCode || 403
      : 500;
    const msg = err instanceof Error ? err.message : "Failed to fetch workflow";

    return NextResponse.json(
      { error: true, message: msg, data: null },
      { status }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(request, PERMISSIONS.WORKFLOW_MANAGE);
    const { id } = await context.params;
    const body = await request.json();
    const parsed = updateWorkflowSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: true,
          message: parsed.error.issues[0]?.message || "Invalid update payload",
          data: null
        },
        { status: 400 }
      );
    }

    const updated = await updateWorkflow(id, parsed.data);

    return NextResponse.json({
      error: false,
      message: "Workflow updated successfully",
      data: updated
    });
  } catch (err: unknown) {
    const isRbac =
      err instanceof Error &&
      (err.name === "UnauthorizedError" || err.name === "ForbiddenError");
    const status = isRbac
      ? (err as { statusCode?: number }).statusCode || 403
      : 500;
    const msg =
      err instanceof Error ? err.message : "Failed to update workflow";

    return NextResponse.json(
      { error: true, message: msg, data: null },
      { status }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(request, PERMISSIONS.WORKFLOW_MANAGE);
    const { id } = await context.params;

    await deleteWorkflow(id);

    return NextResponse.json({
      error: false,
      message: "Workflow deleted successfully",
      data: null
    });
  } catch (err: unknown) {
    const isRbac =
      err instanceof Error &&
      (err.name === "UnauthorizedError" || err.name === "ForbiddenError");
    const status = isRbac
      ? (err as { statusCode?: number }).statusCode || 403
      : 500;
    const msg =
      err instanceof Error ? err.message : "Failed to delete workflow";

    return NextResponse.json(
      { error: true, message: msg, data: null },
      { status }
    );
  }
}
