import {
  BulkJobStatus,
  BulkJobType,
  CustomerState,
  MessageStatus
} from "@prisma/client";
import {
  sendOutboundTextMessage,
  sendOutboundTemplateMessage,
  resolveCustomerTemplateVariable
} from "@/server/messages/service";
import prisma from "@/lib/prisma";
import { realtimeBroadcaster } from "@/server/realtime/broadcaster";

export async function createBulkMessageJob({
  type,
  title,
  content,
  templateId,
  templateName,
  language = "en",
  components = [],
  customerIds,
  targetMode = "CUSTOM",
  assignedStaffId,
  variableConfigurations,
  allowOverrideBlocked = false,
  adminId,
  createdByAdminId
}: {
  type: "MESSAGE" | "TEMPLATE";
  title?: string;
  content?: string;
  templateId?: string;
  templateName?: string;
  language?: string;
  components?: unknown[];
  customerIds?: string[];
  targetMode?: "ALL" | "CUSTOM";
  assignedStaffId?: string;
  variableConfigurations?: Record<string, unknown>;
  allowOverrideBlocked?: boolean;
  adminId?: string;
  createdByAdminId?: string;
}) {
  const where: Record<string, unknown> = {};

  if (assignedStaffId) {
    where.assignedStaffId = assignedStaffId;
  }

  if (targetMode === "CUSTOM") {
    if (!customerIds || customerIds.length === 0) {
      throw new Error("No customer recipients selected for custom broadcast");
    }
    where.id = { in: customerIds };
  }

  // 1. Fetch customers to categorize eligibility
  const customers = await prisma.customer.findMany({
    where,
    select: { id: true, state: true, normalizedPhone: true }
  });

  const blockedCount = customers.filter(
    (c) => c.state === CustomerState.BLOCKED
  ).length;
  const optedOutCount = customers.filter(
    (c) => c.state === CustomerState.OPTED_OUT
  ).length;

  const eligibleCustomers = allowOverrideBlocked
    ? customers
    : customers.filter((c) => c.state === CustomerState.ACTIVE);

  if (eligibleCustomers.length === 0) {
    throw new Error(
      `All ${customers.length} selected recipients are blocked (${blockedCount}) or opted-out (${optedOutCount}).`
    );
  }

  const jobType =
    type === "MESSAGE" ? BulkJobType.MESSAGE : BulkJobType.TEMPLATE;
  const total = eligibleCustomers.length;

  // 2. Create Bulk Job and Recipients in Prisma transaction
  const bulkJob = await prisma.$transaction(async (tx) => {
    const job = await tx.bulkMessageJob.create({
      data: {
        type: jobType,
        status: BulkJobStatus.PENDING,
        title:
          title ||
          `${type === "MESSAGE" ? "Text Broadcast" : `Template: ${templateName}`} (${total} recipients)`,
        content: content || null,
        templateSnapshot: templateName
          ? JSON.parse(
              JSON.stringify({
                templateId,
                templateName,
                language,
                components,
                variableConfigurations
              })
            )
          : undefined,
        createdByAdminId: createdByAdminId || adminId || null,
        totalRecipients: total,
        queuedCount: total
      }
    });

    await tx.bulkMessageRecipient.createMany({
      data: eligibleCustomers.map((c) => ({
        bulkJobId: job.id,
        customerId: c.id,
        status: MessageStatus.QUEUED
      }))
    });

    return job;
  });

  realtimeBroadcaster.broadcast("BULK_JOB_CREATED", bulkJob);

  // 3. Trigger immediate asynchronous processing loop in background
  executeBulkJob(bulkJob.id).catch((err) => {
    console.error(`[BulkJob] Failed executing job ${bulkJob.id}:`, err);
  });

  return {
    job: bulkJob,
    stats: {
      totalSelected: customers.length,
      eligible: eligibleCustomers.length,
      blocked: blockedCount,
      optedOut: optedOutCount
    }
  };
}

async function executeBulkJob(jobId: string) {
  const job = await prisma.bulkMessageJob.findUnique({
    where: { id: jobId }
  });
  if (!job) return;

  // Mark job as RUNNING
  await prisma.bulkMessageJob.update({
    where: { id: jobId },
    data: {
      status: BulkJobStatus.RUNNING,
      startedAt: new Date()
    }
  });

  const recipients = await prisma.bulkMessageRecipient.findMany({
    where: { bulkJobId: jobId, status: MessageStatus.QUEUED },
    include: { customer: true }
  });

  let sentCounter = 0;
  let failedCounter = 0;

  for (const recipient of recipients) {
    try {
      // Mark recipient as SENDING
      await prisma.bulkMessageRecipient.update({
        where: { id: recipient.id },
        data: { status: MessageStatus.SENDING }
      });

      let resultingMsg;

      if (job.type === BulkJobType.MESSAGE && job.content) {
        resultingMsg = await sendOutboundTextMessage({
          customerId: recipient.customerId,
          text: job.content,
          bulkJobId: job.id,
          bulkRecipientId: recipient.id
        });
      } else if (job.type === BulkJobType.TEMPLATE && job.templateSnapshot) {
        const snap = job.templateSnapshot as {
          templateId?: string;
          templateName: string;
          language: string;
          components?: unknown[];
          variableConfigurations?: Record<
            string,
            {
              type?: "static" | "dynamic";
              field?: string;
              customField?: string;
              sample?: string;
              fallback?: string;
              staticValue?: string;
            }
          >;
        };

        let recipientComponents = snap.components;

        if (
          snap.variableConfigurations &&
          Object.keys(snap.variableConfigurations).length > 0
        ) {
          if (Array.isArray(snap.components) && snap.components.length > 0) {
            recipientComponents = snap.components.map((comp: unknown) => {
              const c = comp as Record<string, unknown>;
              const cType = String(c.type || "").toLowerCase();
              if (
                (cType === "body" || cType === "header") &&
                Array.isArray(c.parameters)
              ) {
                return {
                  ...c,
                  parameters: c.parameters.map(
                    (param: unknown, idx: number) => {
                      const p = param as Record<string, unknown>;
                      const varKey =
                        cType === "header" ? "header_1" : String(idx + 1);
                      const cfg =
                        snap.variableConfigurations?.[varKey] ||
                        snap.variableConfigurations?.[String(idx + 1)];
                      if (cfg) {
                        const val =
                          cfg.type === "static"
                            ? cfg.staticValue || cfg.sample || ""
                            : resolveCustomerTemplateVariable(
                                recipient.customer,
                                cfg
                              );
                        return { ...p, text: val };
                      }
                      return p;
                    }
                  )
                };
              }
              return c;
            });
          } else {
            // Build body component parameters directly from variableConfigurations
            const keys = Object.keys(snap.variableConfigurations)
              .filter((k) => !k.startsWith("header_"))
              .sort((a, b) => parseInt(a, 10) - parseInt(b, 10));

            const parameters = keys.map((k) => {
              const cfg = snap.variableConfigurations![k];
              const val =
                cfg.type === "static"
                  ? cfg.staticValue || cfg.sample || ""
                  : resolveCustomerTemplateVariable(recipient.customer, cfg);
              return { type: "text", text: val };
            });

            const headerCfg = snap.variableConfigurations["header_1"];
            const newComps: unknown[] = [];
            if (headerCfg) {
              const hVal =
                headerCfg.type === "static"
                  ? headerCfg.staticValue || headerCfg.sample || ""
                  : resolveCustomerTemplateVariable(
                      recipient.customer,
                      headerCfg
                    );
              newComps.push({
                type: "header",
                parameters: [{ type: "text", text: hVal }]
              });
            }
            if (parameters.length > 0) {
              newComps.push({ type: "body", parameters });
            }
            recipientComponents = newComps;
          }
        }

        resultingMsg = await sendOutboundTemplateMessage({
          customerId: recipient.customerId,
          templateId: snap.templateId,
          templateName: snap.templateName,
          language: snap.language,
          components: recipientComponents,
          bulkJobId: job.id,
          bulkRecipientId: recipient.id
        });
      }

      if (resultingMsg?.status === MessageStatus.SENT) {
        sentCounter++;
        await prisma.bulkMessageRecipient.update({
          where: { id: recipient.id },
          data: {
            status: MessageStatus.SENT,
            messageId: resultingMsg.id,
            sentAt: new Date()
          }
        });
      } else {
        failedCounter++;
        await prisma.bulkMessageRecipient.update({
          where: { id: recipient.id },
          data: {
            status: MessageStatus.FAILED,
            messageId: resultingMsg?.id || null,
            errorCode: resultingMsg?.errorCode || "FAILED",
            errorMessage:
              resultingMsg?.errorMessage || "Message failed to send",
            failedAt: new Date()
          }
        });
      }
    } catch (err: unknown) {
      failedCounter++;
      const msg = err instanceof Error ? err.message : String(err);
      await prisma.bulkMessageRecipient.update({
        where: { id: recipient.id },
        data: {
          status: MessageStatus.FAILED,
          errorCode: "EXCEPTION",
          errorMessage: msg,
          failedAt: new Date()
        }
      });
    }

    // Pacing interval to respect Meta Cloud API rate limits
    await new Promise((resolve) => setTimeout(resolve, 80));
  }

  // Finalize Job status
  const finalStatus =
    failedCounter === 0
      ? BulkJobStatus.COMPLETED
      : sentCounter > 0
        ? BulkJobStatus.PARTIAL
        : BulkJobStatus.FAILED;

  const completedJob = await prisma.bulkMessageJob.update({
    where: { id: jobId },
    data: {
      status: finalStatus,
      sentCount: sentCounter,
      failedCount: failedCounter,
      queuedCount: 0,
      completedAt: new Date()
    }
  });

  realtimeBroadcaster.broadcast("BULK_JOB_UPDATED", completedJob);
}

export async function getBulkJob(id: string) {
  return prisma.bulkMessageJob.findUniqueOrThrow({
    where: { id },
    include: {
      recipients: {
        take: 100,
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
}

export async function listBulkJobs(page = 1, limit = 20) {
  const skip = (page - 1) * limit;
  const [total, jobs] = await Promise.all([
    prisma.bulkMessageJob.count(),
    prisma.bulkMessageJob.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: "desc" }
    })
  ]);

  return {
    jobs,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    }
  };
}
