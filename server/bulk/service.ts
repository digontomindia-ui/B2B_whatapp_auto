import prisma from "@/lib/prisma";
import { realtimeBroadcaster } from "@/server/realtime/broadcaster";
import {
  sendOutboundTextMessage,
  sendOutboundTemplateMessage
} from "@/server/messages/service";
import {
  BulkJobStatus,
  BulkJobType,
  CustomerState,
  MessageStatus
} from "@prisma/client";

export async function createBulkMessageJob({
  type,
  title,
  content,
  templateId,
  templateName,
  language = "en",
  components = [],
  customerIds,
  allowOverrideBlocked = false,
  adminId
}: {
  type: "MESSAGE" | "TEMPLATE";
  title?: string;
  content?: string;
  templateId?: string;
  templateName?: string;
  language?: string;
  components?: unknown[];
  customerIds: string[];
  allowOverrideBlocked?: boolean;
  adminId?: string;
}) {
  if (!customerIds || customerIds.length === 0) {
    throw new Error("No customer recipients selected");
  }

  // 1. Fetch customers to categorize eligibility
  const customers = await prisma.customer.findMany({
    where: { id: { in: customerIds } },
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
              JSON.stringify({ templateId, templateName, language, components })
            )
          : undefined,
        createdByAdminId: adminId || null,
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
        };
        resultingMsg = await sendOutboundTemplateMessage({
          customerId: recipient.customerId,
          templateId: snap.templateId,
          templateName: snap.templateName,
          language: snap.language,
          components: snap.components,
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
