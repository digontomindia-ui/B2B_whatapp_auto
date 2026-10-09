import {
  sendOutboundTextMessage,
  sendOutboundMediaMessage,
  sendOutboundInteractiveButtonsMessage
} from "@/server/messages/service";
import { WorkflowExecutionStatus, Prisma, CustomerState } from "@prisma/client";
import prisma from "@/lib/prisma";

export type WorkflowTriggerType = "KEYWORD" | "ANY_INBOUND" | "MANUAL";

export type WorkflowActionType =
  | "SEND_MESSAGE"
  | "QUESTION"
  | "SEND_MEDIA"
  | "WAIT_DELAY"
  | "UPDATE_CUSTOMER"
  | "CALL_API"
  | "START_WORKFLOW";

export interface QuickReplyOption {
  id: string; // e.g. "male", "female", "non_binary"
  title: string; // WhatsApp button text (max 20 chars)
  actions: WorkflowAction[]; // Action chain to execute when this option is selected
}

export interface SendMessageConfig {
  text: string;
}

export interface QuestionConfig {
  bodyText: string; // e.g. "What is your gender?"
  headerText?: string;
  footerText?: string;
  options: QuickReplyOption[]; // Max 3 quick replies
}

export interface SendMediaConfig {
  mediaType: "DOCUMENT" | "IMAGE" | "VIDEO" | "AUDIO";
  mediaUrl: string;
  fileName?: string;
  caption?: string;
}

export interface WaitDelayConfig {
  delaySeconds: number; // e.g. 3
}

export interface UpdateCustomerConfig {
  customName?: string;
  addTags?: string[];
  removeTags?: string[];
  state?: "ACTIVE" | "BLOCKED" | "OPTED_OUT";
  assignedStaffId?: string | null;
  notes?: string;
  metadata?: Record<string, unknown>;
}

export interface CallApiConfig {
  url: string;
  method: "GET" | "POST" | "PUT";
  headers?: Record<string, string>;
  bodyJson?: string;
}

export interface StartWorkflowConfig {
  workflowId: string;
}

export interface WorkflowAction {
  id: string;
  type: WorkflowActionType;
  name?: string;
  config: Record<string, unknown>;
}

export interface ExecutionContext {
  executionId: string;
  workflowId: string;
  customerId: string;
  conversationId?: string;
  contextData: Record<string, unknown>;
}

/**
 * Replace placeholders like {{customer.name}}, {{customer.phoneNumber}}, {{reply}} in strings
 */
export function interpolateWorkflowVariables(
  template: string,
  customer: {
    phoneNumber?: string | null;
    normalizedPhone: string;
    whatsappName?: string | null;
    customName?: string | null;
    about?: string | null;
    notes?: string | null;
    metadata?: unknown;
  },
  contextData: Record<string, unknown> = {}
): string {
  if (!template) return "";

  const name =
    customer.customName || customer.whatsappName || "Valued Customer";
  const phone = customer.phoneNumber || customer.normalizedPhone;

  let result = template
    .replace(/\{\{customer\.name\}\}/g, name)
    .replace(/\{\{customer\.customName\}\}/g, customer.customName || name)
    .replace(/\{\{customer\.whatsappName\}\}/g, customer.whatsappName || name)
    .replace(/\{\{customer\.phoneNumber\}\}/g, phone)
    .replace(/\{\{customer\.phone\}\}/g, phone)
    .replace(/\{\{customer\.about\}\}/g, customer.about || "")
    .replace(/\{\{customer\.notes\}\}/g, customer.notes || "");

  // Reply variables
  if (contextData.lastReplyText) {
    result = result.replace(
      /\{\{reply\}\}/g,
      String(contextData.lastReplyText)
    );
  }
  if (contextData.lastReplyId) {
    result = result.replace(
      /\{\{replyId\}\}/g,
      String(contextData.lastReplyId)
    );
  }

  // Context properties
  for (const [key, val] of Object.entries(contextData)) {
    if (typeof val === "string" || typeof val === "number") {
      result = result.replace(
        new RegExp(`\\{\\{context\\.${key}\\}\\}`, "g"),
        String(val)
      );
    }
  }

  // Metadata properties
  if (customer.metadata && typeof customer.metadata === "object") {
    for (const [key, val] of Object.entries(
      customer.metadata as Record<string, unknown>
    )) {
      if (typeof val === "string" || typeof val === "number") {
        result = result.replace(
          new RegExp(`\\{\\{customer\\.metadata\\.${key}\\}\\}`, "g"),
          String(val)
        );
      }
    }
  }

  return result;
}

/**
 * Execute a chain of workflow actions sequentially
 */
export async function executeActionChain(
  actions: WorkflowAction[],
  context: ExecutionContext
): Promise<{ haltedForInput: boolean }> {
  for (const action of actions) {
    const customer = await prisma.customer.findUniqueOrThrow({
      where: { id: context.customerId }
    });

    switch (action.type) {
      case "SEND_MESSAGE": {
        const cfg = action.config as unknown as SendMessageConfig;
        const text = interpolateWorkflowVariables(
          cfg.text || "",
          customer,
          context.contextData
        );
        if (text.trim()) {
          await sendOutboundTextMessage({
            customerId: context.customerId,
            conversationId: context.conversationId,
            text
          });
        }
        break;
      }

      case "QUESTION": {
        const cfg = action.config as unknown as QuestionConfig;
        const bodyText = interpolateWorkflowVariables(
          cfg.bodyText || "",
          customer,
          context.contextData
        );
        const headerText = cfg.headerText
          ? interpolateWorkflowVariables(
              cfg.headerText,
              customer,
              context.contextData
            )
          : undefined;
        const footerText = cfg.footerText
          ? interpolateWorkflowVariables(
              cfg.footerText,
              customer,
              context.contextData
            )
          : undefined;

        const options = (cfg.options || []).slice(0, 3);
        const buttons = options.map((opt) => ({
          id: opt.id || opt.title.toLowerCase().replace(/\s+/g, "_"),
          title: opt.title.slice(0, 20)
        }));

        // Send quick reply buttons via WhatsApp
        await sendOutboundInteractiveButtonsMessage({
          customerId: context.customerId,
          conversationId: context.conversationId,
          bodyText: bodyText || "Please choose an option:",
          buttons,
          headerText,
          footerText
        });

        // Pause execution and wait for user's interactive response
        await prisma.workflowExecution.update({
          where: { id: context.executionId },
          data: {
            status: WorkflowExecutionStatus.WAITING_FOR_INPUT,
            waitingForReply: true,
            currentStepId: action.id,
            expectedReplies: options as unknown as Prisma.InputJsonValue,
            contextData: context.contextData as Prisma.InputJsonValue
          }
        });

        return { haltedForInput: true };
      }

      case "SEND_MEDIA": {
        const cfg = action.config as unknown as SendMediaConfig;
        const mediaUrl = interpolateWorkflowVariables(
          cfg.mediaUrl || "",
          customer,
          context.contextData
        );
        const caption = cfg.caption
          ? interpolateWorkflowVariables(
              cfg.caption,
              customer,
              context.contextData
            )
          : undefined;

        if (mediaUrl.trim()) {
          const type = (cfg.mediaType || "DOCUMENT").toUpperCase() as
            "DOCUMENT" | "IMAGE" | "VIDEO" | "AUDIO";

          let mimeType = "application/pdf";
          if (type === "IMAGE") mimeType = "image/jpeg";
          if (type === "VIDEO") mimeType = "video/mp4";
          if (type === "AUDIO") mimeType = "audio/ogg";

          await sendOutboundMediaMessage({
            customerId: context.customerId,
            conversationId: context.conversationId,
            type,
            mediaLink: mediaUrl,
            fileName: cfg.fileName || "attachment",
            caption,
            mimeType
          });
        }
        break;
      }

      case "WAIT_DELAY": {
        const cfg = action.config as unknown as WaitDelayConfig;
        const delaySeconds = Math.max(1, Math.min(cfg.delaySeconds || 2, 60));
        await new Promise((resolve) =>
          setTimeout(resolve, delaySeconds * 1000)
        );
        break;
      }

      case "UPDATE_CUSTOMER": {
        const cfg = action.config as unknown as UpdateCustomerConfig;
        const updateData: Prisma.CustomerUpdateInput = {};

        if (cfg.customName) {
          updateData.customName = interpolateWorkflowVariables(
            cfg.customName,
            customer,
            context.contextData
          );
        }

        if (
          cfg.state &&
          ["ACTIVE", "BLOCKED", "OPTED_OUT"].includes(cfg.state)
        ) {
          updateData.state = cfg.state as CustomerState;
        }

        if (cfg.notes) {
          const newNote = interpolateWorkflowVariables(
            cfg.notes,
            customer,
            context.contextData
          );
          updateData.notes = customer.notes
            ? `${customer.notes}\n${newNote}`
            : newNote;
        }

        if (cfg.assignedStaffId !== undefined) {
          if (cfg.assignedStaffId) {
            updateData.assignedStaff = {
              connect: { id: cfg.assignedStaffId }
            };
          } else {
            updateData.assignedStaff = {
              disconnect: true
            };
          }
        }

        // Merge metadata if provided
        if (cfg.metadata && typeof cfg.metadata === "object") {
          const existingMeta =
            customer.metadata && typeof customer.metadata === "object"
              ? (customer.metadata as Record<string, unknown>)
              : {};
          updateData.metadata = {
            ...existingMeta,
            ...cfg.metadata
          } as unknown as Prisma.InputJsonValue;
        }

        // Add tags
        if (Array.isArray(cfg.addTags) && cfg.addTags.length > 0) {
          for (const tagName of cfg.addTags) {
            const trimmed = tagName.trim();
            if (!trimmed) continue;
            const tag = await prisma.tag.upsert({
              where: { name: trimmed },
              create: { name: trimmed },
              update: {}
            });
            await prisma.customerTag.upsert({
              where: {
                id: `${customer.id}-${tag.id}`
              },
              create: {
                id: `${customer.id}-${tag.id}`,
                customerId: customer.id,
                tagId: tag.id
              },
              update: {}
            });
          }
        }

        // Remove tags
        if (Array.isArray(cfg.removeTags) && cfg.removeTags.length > 0) {
          for (const tagName of cfg.removeTags) {
            const trimmed = tagName.trim();
            if (!trimmed) continue;
            const tag = await prisma.tag.findUnique({
              where: { name: trimmed }
            });
            if (tag) {
              await prisma.customerTag.deleteMany({
                where: { customerId: customer.id, tagId: tag.id }
              });
            }
          }
        }

        if (Object.keys(updateData).length > 0) {
          await prisma.customer.update({
            where: { id: context.customerId },
            data: updateData
          });
        }
        break;
      }

      case "CALL_API": {
        const cfg = action.config as unknown as CallApiConfig;
        if (cfg.url) {
          const interpolatedUrl = interpolateWorkflowVariables(
            cfg.url,
            customer,
            context.contextData
          );
          const method = cfg.method || "POST";
          const headers: Record<string, string> = {
            "Content-Type": "application/json",
            ...(cfg.headers || {})
          };

          let body: string | undefined = undefined;
          if (method !== "GET" && cfg.bodyJson) {
            body = interpolateWorkflowVariables(
              cfg.bodyJson,
              customer,
              context.contextData
            );
          }

          try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 10000);
            const res = await fetch(interpolatedUrl, {
              method,
              headers,
              body,
              signal: controller.signal
            });
            clearTimeout(timeout);

            let resData: unknown = null;
            try {
              resData = await res.json();
            } catch {
              resData = await res.text();
            }

            context.contextData[`api_${action.id}_status`] = res.status;
            context.contextData[`api_${action.id}_response`] = resData;
          } catch (err) {
            console.error(
              `Workflow API call failed for ${interpolatedUrl}:`,
              err
            );
            context.contextData[`api_${action.id}_error`] =
              err instanceof Error ? err.message : String(err);
          }
        }
        break;
      }

      case "START_WORKFLOW": {
        const cfg = action.config as unknown as StartWorkflowConfig;
        if (cfg.workflowId && cfg.workflowId !== context.workflowId) {
          // Trigger linked workflow asynchronously
          startWorkflow(
            cfg.workflowId,
            context.customerId,
            context.conversationId,
            context.contextData
          ).catch((e) =>
            console.error(
              `Error starting linked workflow ${cfg.workflowId}:`,
              e
            )
          );
        }
        break;
      }
    }
  }

  return { haltedForInput: false };
}

/**
 * Start execution of a workflow for a customer
 */
export async function startWorkflow(
  workflowId: string,
  customerId: string,
  conversationId?: string,
  initialContext: Record<string, unknown> = {}
) {
  const workflow = await prisma.workflow.findUnique({
    where: { id: workflowId }
  });

  if (!workflow || !workflow.isActive) {
    return null;
  }

  // Cancel any stale WAITING_FOR_INPUT executions for this workflow + customer
  await prisma.workflowExecution.updateMany({
    where: {
      customerId,
      workflowId,
      status: WorkflowExecutionStatus.WAITING_FOR_INPUT
    },
    data: {
      status: WorkflowExecutionStatus.CANCELLED
    }
  });

  const steps = (workflow.steps as unknown as WorkflowAction[]) || [];
  if (!Array.isArray(steps) || steps.length === 0) {
    return null;
  }

  // Create new execution record
  const execution = await prisma.workflowExecution.create({
    data: {
      workflowId,
      customerId,
      conversationId,
      status: WorkflowExecutionStatus.RUNNING,
      contextData: initialContext as Prisma.InputJsonValue
    }
  });

  const context: ExecutionContext = {
    executionId: execution.id,
    workflowId,
    customerId,
    conversationId,
    contextData: { ...initialContext }
  };

  try {
    const result = await executeActionChain(steps, context);

    if (!result.haltedForInput) {
      await prisma.workflowExecution.update({
        where: { id: execution.id },
        data: {
          status: WorkflowExecutionStatus.COMPLETED,
          contextData: context.contextData as Prisma.InputJsonValue
        }
      });
    }

    return execution;
  } catch (err: unknown) {
    const errorMsg =
      err instanceof Error ? err.stack || err.message : String(err);
    console.error(`Workflow execution ${execution.id} failed:`, err);
    await prisma.workflowExecution.update({
      where: { id: execution.id },
      data: {
        status: WorkflowExecutionStatus.FAILED,
        errorLog: errorMsg
      }
    });
    return execution;
  }
}

/**
 * Process incoming messages to resume waiting executions or trigger workflows
 */
export async function processIncomingMessageForWorkflows(
  customerId: string,
  messageText: string,
  buttonId?: string,
  conversationId?: string
): Promise<{ matched: boolean; executionId?: string }> {
  const cleanText = (messageText || "").trim().toLowerCase();
  const cleanButtonId = (buttonId || "").trim().toLowerCase();

  // 1. Check for active execution WAITING_FOR_INPUT for this customer
  const waitingExecution = await prisma.workflowExecution.findFirst({
    where: {
      customerId,
      status: WorkflowExecutionStatus.WAITING_FOR_INPUT,
      waitingForReply: true
    },
    orderBy: { updatedAt: "desc" },
    include: { workflow: true }
  });

  if (waitingExecution && waitingExecution.expectedReplies) {
    const options =
      waitingExecution.expectedReplies as unknown as QuickReplyOption[];

    if (Array.isArray(options)) {
      // Find matching option by buttonId or title
      const matchedOption = options.find((opt) => {
        const optId = (opt.id || "").toLowerCase().trim();
        const optTitle = (opt.title || "").toLowerCase().trim();

        if (
          cleanButtonId &&
          (cleanButtonId === optId || cleanButtonId === optTitle)
        ) {
          return true;
        }
        if (cleanText && (cleanText === optId || cleanText === optTitle)) {
          return true;
        }
        return false;
      });

      if (matchedOption) {
        // Matched! Resume execution with the branch's actions
        const contextData = {
          ...((waitingExecution.contextData as Record<string, unknown>) || {}),
          lastReplyText: messageText,
          lastReplyId: cleanButtonId || matchedOption.id
        };

        await prisma.workflowExecution.update({
          where: { id: waitingExecution.id },
          data: {
            status: WorkflowExecutionStatus.RUNNING,
            waitingForReply: false,
            expectedReplies: Prisma.JsonNull,
            contextData: contextData as Prisma.InputJsonValue
          }
        });

        const context: ExecutionContext = {
          executionId: waitingExecution.id,
          workflowId: waitingExecution.workflowId,
          customerId,
          conversationId:
            conversationId || waitingExecution.conversationId || undefined,
          contextData
        };

        try {
          const branchActions = matchedOption.actions || [];
          const result = await executeActionChain(branchActions, context);

          if (!result.haltedForInput) {
            await prisma.workflowExecution.update({
              where: { id: waitingExecution.id },
              data: {
                status: WorkflowExecutionStatus.COMPLETED,
                contextData: context.contextData as Prisma.InputJsonValue
              }
            });
          }

          return { matched: true, executionId: waitingExecution.id };
        } catch (err) {
          const errorMsg =
            err instanceof Error ? err.stack || err.message : String(err);
          await prisma.workflowExecution.update({
            where: { id: waitingExecution.id },
            data: {
              status: WorkflowExecutionStatus.FAILED,
              errorLog: errorMsg
            }
          });
          return { matched: true, executionId: waitingExecution.id };
        }
      }
    }
  }

  // 2. If no waiting input matched, check triggers for new workflow
  const activeWorkflows = await prisma.workflow.findMany({
    where: { isActive: true }
  });

  for (const wf of activeWorkflows) {
    let shouldTrigger = false;

    if (wf.triggerType === "ANY_INBOUND") {
      shouldTrigger = true;
    } else if (
      wf.triggerType === "KEYWORD" &&
      Array.isArray(wf.triggerKeywords)
    ) {
      const matched = wf.triggerKeywords.some((kw) => {
        const cleanKw = kw.trim().toLowerCase();
        return cleanKw && cleanText.includes(cleanKw);
      });
      if (matched) {
        shouldTrigger = true;
      }
    }

    if (shouldTrigger) {
      const exec = await startWorkflow(wf.id, customerId, conversationId, {
        triggerMessage: messageText,
        triggerButtonId: buttonId
      });
      if (exec) {
        return { matched: true, executionId: exec.id };
      }
    }
  }

  return { matched: false };
}
