import prisma from "@/lib/prisma";
import { startWorkflow } from "./engine";
import { Prisma } from "@prisma/client";

export async function listWorkflows() {
  const workflows = await prisma.workflow.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: { executions: true }
      },
      executions: {
        select: { status: true }
      }
    }
  });

  return workflows.map((wf) => {
    const totalExecutions = wf._count.executions;
    const completedCount = wf.executions.filter(
      (e) => e.status === "COMPLETED"
    ).length;
    const waitingCount = wf.executions.filter(
      (e) => e.status === "WAITING_FOR_INPUT"
    ).length;
    const failedCount = wf.executions.filter(
      (e) => e.status === "FAILED"
    ).length;

    // Omit heavy execution array from list
    const { executions: _omitted, ...rest } = wf;
    void _omitted;
    return {
      ...rest,
      totalExecutions,
      completedCount,
      waitingCount,
      failedCount
    };
  });
}

export async function getWorkflowById(id: string) {
  const workflow = await prisma.workflow.findUnique({
    where: { id },
    include: {
      executions: {
        take: 25,
        orderBy: { createdAt: "desc" },
        include: {
          customer: {
            select: {
              id: true,
              customName: true,
              whatsappName: true,
              normalizedPhone: true
            }
          }
        }
      }
    }
  });

  return workflow;
}

export async function createWorkflow(data: {
  name: string;
  description?: string | null;
  isActive?: boolean;
  triggerType?: string;
  triggerKeywords?: string[];
  steps?: unknown[];
}) {
  const steps = data.steps || [];

  return prisma.workflow.create({
    data: {
      name: data.name.trim(),
      description: data.description?.trim() || null,
      isActive: data.isActive ?? true,
      triggerType: data.triggerType || "KEYWORD",
      triggerKeywords: (data.triggerKeywords || []).map((k) =>
        k.trim().toLowerCase()
      ),
      steps: steps as Prisma.InputJsonValue
    }
  });
}

export async function updateWorkflow(
  id: string,
  data: {
    name?: string;
    description?: string | null;
    isActive?: boolean;
    triggerType?: string;
    triggerKeywords?: string[];
    steps?: unknown[];
  }
) {
  const updatePayload: Prisma.WorkflowUpdateInput = {};

  if (data.name !== undefined) {
    updatePayload.name = data.name.trim();
  }
  if (data.description !== undefined) {
    updatePayload.description = data.description?.trim() || null;
  }
  if (data.isActive !== undefined) {
    updatePayload.isActive = data.isActive;
  }
  if (data.triggerType !== undefined) {
    updatePayload.triggerType = data.triggerType;
  }
  if (data.triggerKeywords !== undefined) {
    updatePayload.triggerKeywords = data.triggerKeywords.map((k) =>
      k.trim().toLowerCase()
    );
  }
  if (data.steps !== undefined) {
    updatePayload.steps = data.steps as Prisma.InputJsonValue;
  }

  return prisma.workflow.update({
    where: { id },
    data: updatePayload
  });
}

export async function deleteWorkflow(id: string) {
  return prisma.workflow.delete({
    where: { id }
  });
}

export async function triggerWorkflowForCustomer(
  workflowId: string,
  customerId: string
) {
  return startWorkflow(workflowId, customerId);
}
