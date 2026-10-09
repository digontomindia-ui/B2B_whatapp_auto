import { NextRequest, NextResponse } from "next/server";
import { listWorkflows, createWorkflow } from "@/server/workflows/service";
import { requirePermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { z } from "zod";

const createWorkflowSchema = z.object({
  name: z.string().min(1, "Workflow name is required"),
  description: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  triggerType: z.enum(["KEYWORD", "ANY_INBOUND", "MANUAL"]).default("KEYWORD"),
  triggerKeywords: z.array(z.string()).default([]),
  steps: z.array(z.any()).default([])
});

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, PERMISSIONS.WORKFLOW_VIEW);
    const workflows = await listWorkflows();

    return NextResponse.json({
      error: false,
      message: "Workflows fetched successfully",
      data: workflows
    });
  } catch (err: unknown) {
    const isRbac =
      err instanceof Error &&
      (err.name === "UnauthorizedError" || err.name === "ForbiddenError");
    const status = isRbac
      ? (err as { statusCode?: number }).statusCode || 403
      : 500;
    const msg =
      err instanceof Error ? err.message : "Failed to fetch workflows";

    return NextResponse.json(
      { error: true, message: msg, data: null },
      { status }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requirePermission(request, PERMISSIONS.WORKFLOW_MANAGE);
    const body = await request.json();
    const parsed = createWorkflowSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: true,
          message: parsed.error.issues[0]?.message || "Invalid workflow data",
          data: null
        },
        { status: 400 }
      );
    }

    const workflow = await createWorkflow(parsed.data);

    return NextResponse.json({
      error: false,
      message: "Workflow created successfully",
      data: workflow
    });
  } catch (err: unknown) {
    const isRbac =
      err instanceof Error &&
      (err.name === "UnauthorizedError" || err.name === "ForbiddenError");
    const status = isRbac
      ? (err as { statusCode?: number }).statusCode || 403
      : 500;
    const msg =
      err instanceof Error ? err.message : "Failed to create workflow";

    return NextResponse.json(
      { error: true, message: msg, data: null },
      { status }
    );
  }
}
