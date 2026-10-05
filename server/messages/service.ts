import prisma from "@/lib/prisma";
import { whatsappClient } from "@/clients/whatsapp";
import { realtimeBroadcaster } from "@/server/realtime/broadcaster";
import {
  MessageDirection,
  MessageStatus,
  MessageType,
  Prisma
} from "@prisma/client";

export async function getConversationMessages(
  conversationId: string,
  options: { limit?: number; beforeCursor?: string } = {}
) {
  const { limit = 50, beforeCursor } = options;

  const where: Record<string, unknown> = { conversationId };

  if (beforeCursor) {
    const cursorMsg = await prisma.message.findUnique({
      where: { id: beforeCursor },
      select: { createdAt: true }
    });
    if (cursorMsg) {
      where.createdAt = { lt: cursorMsg.createdAt };
    }
  }

  const messages = await prisma.message.findMany({
    where,
    orderBy: { createdAt: "asc" },
    take: limit,
    include: {
      mediaAttachment: true
    }
  });

  return messages;
}

export async function sendOutboundTextMessage({
  customerId,
  conversationId,
  text,
  previewUrl = false,
  bulkJobId,
  bulkRecipientId
}: {
  customerId: string;
  conversationId?: string;
  text: string;
  previewUrl?: boolean;
  bulkJobId?: string;
  bulkRecipientId?: string;
}) {
  const customer = await prisma.customer.findUniqueOrThrow({
    where: { id: customerId }
  });

  // Resolve or create conversation
  let activeConvId = conversationId;
  if (!activeConvId) {
    let conv = await prisma.conversation.findFirst({
      where: { customerId },
      orderBy: { createdAt: "desc" }
    });
    if (!conv) {
      conv = await prisma.conversation.create({ data: { customerId } });
    }
    activeConvId = conv.id;
  }

  // 1. Create message locally in SENDING state
  const message = await prisma.message.create({
    data: {
      customerId,
      conversationId: activeConvId,
      direction: MessageDirection.OUTBOUND,
      type: MessageType.TEXT,
      body: text,
      status: MessageStatus.SENDING,
      bulkJobId,
      bulkRecipientId
    },
    include: { mediaAttachment: true }
  });

  realtimeBroadcaster.broadcast("MESSAGE_CREATED", message);

  // 2. Call Meta WhatsApp Cloud API
  const metaResult = await whatsappClient.sendText(
    customer.normalizedPhone,
    text,
    previewUrl
  );

  const now = new Date();

  // 3. Update message according to Meta result
  if (metaResult.success && metaResult.metaMessageId) {
    const updated = await prisma.message.update({
      where: { id: message.id },
      data: {
        metaMessageId: metaResult.metaMessageId,
        status: MessageStatus.SENT,
        sentAt: now,
        rawPayload: metaResult.rawResponse as unknown as Prisma.InputJsonValue
      },
      include: { mediaAttachment: true }
    });

    await prisma.customer.update({
      where: { id: customerId },
      data: {
        lastOutboundAt: now,
        lastInteractionAt: now
      }
    });

    await prisma.conversation.update({
      where: { id: activeConvId },
      data: { lastMessageAt: now }
    });

    realtimeBroadcaster.broadcast("MESSAGE_SENT", updated);
    realtimeBroadcaster.broadcast("MESSAGE_UPDATED", updated);
    return updated;
  } else {
    // Delivery rejected by Meta (e.g. 24h window closed or invalid params)
    const failedMsg = await prisma.message.update({
      where: { id: message.id },
      data: {
        status: MessageStatus.FAILED,
        errorCode: metaResult.errorCode || "META_SEND_FAILED",
        errorMessage:
          metaResult.errorMessage ||
          "Failed to deliver message via WhatsApp API",
        failedAt: now,
        rawPayload: metaResult.rawResponse as unknown as Prisma.InputJsonValue
      },
      include: { mediaAttachment: true }
    });

    realtimeBroadcaster.broadcast("MESSAGE_FAILED", failedMsg);
    realtimeBroadcaster.broadcast("MESSAGE_UPDATED", failedMsg);
    return failedMsg;
  }
}

export async function sendOutboundMediaMessage({
  customerId,
  conversationId,
  type,
  caption,
  fileName,
  mimeType,
  mediaLink,
  base64Data
}: {
  customerId: string;
  conversationId?: string;
  type: "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT" | "STICKER";
  caption?: string;
  fileName?: string;
  mimeType: string;
  mediaLink?: string;
  base64Data?: string;
}) {
  const customer = await prisma.customer.findUniqueOrThrow({
    where: { id: customerId }
  });

  let activeConvId = conversationId;
  if (!activeConvId) {
    let conv = await prisma.conversation.findFirst({
      where: { customerId },
      orderBy: { createdAt: "desc" }
    });
    if (!conv) {
      conv = await prisma.conversation.create({ data: { customerId } });
    }
    activeConvId = conv.id;
  }

  const messageType = MessageType[type];

  // Create message with media attachment (store URL reference directly, no server binary storage)
  const message = await prisma.message.create({
    data: {
      customerId,
      conversationId: activeConvId,
      direction: MessageDirection.OUTBOUND,
      type: messageType,
      body: caption || null,
      status: MessageStatus.SENDING,
      mediaAttachment: {
        create: {
          type: messageType,
          fileName: fileName || null,
          mimeType,
          fileSize: null,
          metaUrl: mediaLink || null,
          caption: caption || null
        }
      }
    },
    include: { mediaAttachment: true }
  });

  realtimeBroadcaster.broadcast("MESSAGE_CREATED", message);

  // Send via Meta API
  const metaResult = await whatsappClient.sendMedia({
    to: customer.normalizedPhone,
    type: type.toLowerCase() as
      "image" | "video" | "audio" | "document" | "sticker",
    link: mediaLink,
    caption,
    filename: fileName
  });

  const now = new Date();

  if (metaResult.success && metaResult.metaMessageId) {
    const updated = await prisma.message.update({
      where: { id: message.id },
      data: {
        metaMessageId: metaResult.metaMessageId,
        status: MessageStatus.SENT,
        sentAt: now,
        rawPayload: metaResult.rawResponse as unknown as Prisma.InputJsonValue
      },
      include: { mediaAttachment: true }
    });

    await prisma.customer.update({
      where: { id: customerId },
      data: {
        lastOutboundAt: now,
        lastInteractionAt: now
      }
    });

    await prisma.conversation.update({
      where: { id: activeConvId },
      data: { lastMessageAt: now }
    });

    realtimeBroadcaster.broadcast("MESSAGE_SENT", updated);
    realtimeBroadcaster.broadcast("MESSAGE_UPDATED", updated);
    return updated;
  } else {
    const failedMsg = await prisma.message.update({
      where: { id: message.id },
      data: {
        status: MessageStatus.FAILED,
        errorCode: metaResult.errorCode || "META_MEDIA_SEND_FAILED",
        errorMessage:
          metaResult.errorMessage || "Failed to deliver media via WhatsApp API",
        failedAt: now,
        rawPayload: metaResult.rawResponse as unknown as Prisma.InputJsonValue
      },
      include: { mediaAttachment: true }
    });

    realtimeBroadcaster.broadcast("MESSAGE_FAILED", failedMsg);
    realtimeBroadcaster.broadcast("MESSAGE_UPDATED", failedMsg);
    return failedMsg;
  }
}

export async function sendOutboundTemplateMessage({
  customerId,
  conversationId,
  templateId,
  templateName,
  language = "en",
  components = [],
  bulkJobId,
  bulkRecipientId
}: {
  customerId: string;
  conversationId?: string;
  templateId?: string;
  templateName: string;
  language?: string;
  components?: unknown[];
  bulkJobId?: string;
  bulkRecipientId?: string;
}) {
  const customer = await prisma.customer.findUniqueOrThrow({
    where: { id: customerId }
  });

  let activeConvId = conversationId;
  if (!activeConvId) {
    let conv = await prisma.conversation.findFirst({
      where: { customerId },
      orderBy: { createdAt: "desc" }
    });
    if (!conv) {
      conv = await prisma.conversation.create({ data: { customerId } });
    }
    activeConvId = conv.id;
  }

  // Snapshot the template config so historical messages remain immutable
  const templateSnapshot = {
    templateId,
    templateName,
    language,
    components
  };

  const message = await prisma.message.create({
    data: {
      customerId,
      conversationId: activeConvId,
      direction: MessageDirection.OUTBOUND,
      type: MessageType.TEMPLATE,
      body: `Template: ${templateName}`,
      status: MessageStatus.SENDING,
      templateId,
      templateSnapshot: templateSnapshot as unknown as Prisma.InputJsonValue,
      bulkJobId,
      bulkRecipientId
    },
    include: { mediaAttachment: true }
  });

  realtimeBroadcaster.broadcast("MESSAGE_CREATED", message);

  // Send via Meta API
  const metaResult = await whatsappClient.sendTemplate({
    to: customer.normalizedPhone,
    name: templateName,
    language,
    components
  });

  const now = new Date();

  if (metaResult.success && metaResult.metaMessageId) {
    const updated = await prisma.message.update({
      where: { id: message.id },
      data: {
        metaMessageId: metaResult.metaMessageId,
        status: MessageStatus.SENT,
        sentAt: now,
        rawPayload: metaResult.rawResponse as unknown as Prisma.InputJsonValue
      },
      include: { mediaAttachment: true }
    });

    await prisma.customer.update({
      where: { id: customerId },
      data: {
        lastOutboundAt: now,
        lastInteractionAt: now
      }
    });

    await prisma.conversation.update({
      where: { id: activeConvId },
      data: { lastMessageAt: now }
    });

    realtimeBroadcaster.broadcast("MESSAGE_SENT", updated);
    realtimeBroadcaster.broadcast("MESSAGE_UPDATED", updated);
    return updated;
  } else {
    const failedMsg = await prisma.message.update({
      where: { id: message.id },
      data: {
        status: MessageStatus.FAILED,
        errorCode: metaResult.errorCode || "META_TEMPLATE_SEND_FAILED",
        errorMessage:
          metaResult.errorMessage || "Failed to deliver template message",
        failedAt: now,
        rawPayload: metaResult.rawResponse as unknown as Prisma.InputJsonValue
      },
      include: { mediaAttachment: true }
    });

    realtimeBroadcaster.broadcast("MESSAGE_FAILED", failedMsg);
    realtimeBroadcaster.broadcast("MESSAGE_UPDATED", failedMsg);
    return failedMsg;
  }
}

export async function markConversationAsRead({
  customerId,
  conversationId
}: {
  customerId: string;
  conversationId?: string;
}) {
  const now = new Date();

  // Find latest unread inbound message with metaMessageId
  const lastInbound = await prisma.message.findFirst({
    where: {
      customerId,
      ...(conversationId ? { conversationId } : {}),
      direction: MessageDirection.INBOUND,
      status: { not: MessageStatus.READ },
      metaMessageId: { not: null }
    },
    orderBy: { createdAt: "desc" }
  });

  // Update in database
  await prisma.$transaction([
    prisma.customer.update({
      where: { id: customerId },
      data: { unreadCount: 0 }
    }),
    prisma.message.updateMany({
      where: {
        customerId,
        ...(conversationId ? { conversationId } : {}),
        direction: MessageDirection.INBOUND,
        status: { not: MessageStatus.READ }
      },
      data: {
        status: MessageStatus.READ,
        readAt: now
      }
    })
  ]);

  // Inform Meta if possible
  if (lastInbound?.metaMessageId) {
    whatsappClient.markAsRead(lastInbound.metaMessageId).catch(() => {});
  }

  realtimeBroadcaster.broadcast("CUSTOMER_UNREAD_UPDATED", {
    customerId,
    unreadCount: 0
  });

  return { success: true };
}
