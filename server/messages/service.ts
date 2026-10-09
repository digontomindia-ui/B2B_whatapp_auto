import {
  MessageDirection,
  MessageStatus,
  MessageType,
  Prisma
} from "@prisma/client";
import prisma from "@/lib/prisma";
import { whatsappClient } from "@/clients/whatsapp";
import { realtimeBroadcaster } from "@/server/realtime/broadcaster";

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
  base64Data: _base64Data
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
  void _base64Data;
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

export async function sendOutboundInteractiveButtonsMessage({
  customerId,
  conversationId,
  bodyText,
  buttons,
  headerText,
  footerText
}: {
  customerId: string;
  conversationId?: string;
  bodyText: string;
  buttons: Array<{ id: string; title: string }>;
  headerText?: string;
  footerText?: string;
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

  const interactiveSnapshot = {
    type: "button",
    buttons,
    headerText: headerText || null,
    footerText: footerText || null
  };

  const message = await prisma.message.create({
    data: {
      customerId,
      conversationId: activeConvId,
      direction: MessageDirection.OUTBOUND,
      type: MessageType.INTERACTIVE,
      body: bodyText,
      status: MessageStatus.SENDING,
      rawPayload: interactiveSnapshot as unknown as Prisma.InputJsonValue
    },
    include: { mediaAttachment: true }
  });

  realtimeBroadcaster.broadcast("MESSAGE_CREATED", message);

  const metaResult = await whatsappClient.sendInteractiveButtons({
    to: customer.normalizedPhone,
    bodyText,
    buttons,
    headerText,
    footerText
  });

  const now = new Date();

  if (metaResult.success && metaResult.metaMessageId) {
    const updated = await prisma.message.update({
      where: { id: message.id },
      data: {
        metaMessageId: metaResult.metaMessageId,
        status: MessageStatus.SENT,
        sentAt: now,
        rawPayload: {
          ...interactiveSnapshot,
          metaResponse: metaResult.rawResponse
        } as unknown as Prisma.InputJsonValue
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
        errorCode: metaResult.errorCode || "META_INTERACTIVE_SEND_FAILED",
        errorMessage:
          metaResult.errorMessage ||
          "Failed to deliver interactive message via WhatsApp API",
        failedAt: now,
        rawPayload: {
          ...interactiveSnapshot,
          metaResponse: metaResult.rawResponse
        } as unknown as Prisma.InputJsonValue
      },
      include: { mediaAttachment: true }
    });

    realtimeBroadcaster.broadcast("MESSAGE_FAILED", failedMsg);
    realtimeBroadcaster.broadcast("MESSAGE_UPDATED", failedMsg);
    return failedMsg;
  }
}

export function resolveCustomerTemplateVariable(
  customer: {
    phoneNumber?: string | null;
    normalizedPhone: string;
    whatsappName?: string | null;
    customName?: string | null;
    about?: string | null;
    notes?: string | null;
    metadata?: unknown;
  },
  mapping?: {
    type?: string;
    field?: string;
    customField?: string;
    fallback?: string;
    staticValue?: string;
    sample?: string;
  }
): string {
  if (!mapping) return "";
  if (mapping.type === "static") {
    return mapping.staticValue || mapping.sample || "";
  }
  const fieldKey =
    mapping.field === "custom" && mapping.customField
      ? mapping.customField
      : mapping.field || "customer.customName";

  const fallback = mapping.fallback || "";

  if (fieldKey === "customer.name" || fieldKey === "name") {
    return customer.customName || customer.whatsappName || fallback;
  }
  if (fieldKey === "customer.customName" || fieldKey === "customName") {
    return customer.customName || customer.whatsappName || fallback;
  }
  if (fieldKey === "customer.whatsappName" || fieldKey === "whatsappName") {
    return customer.whatsappName || customer.customName || fallback;
  }
  if (
    fieldKey === "customer.phoneNumber" ||
    fieldKey === "phoneNumber" ||
    fieldKey === "phone"
  ) {
    return customer.phoneNumber || customer.normalizedPhone || fallback;
  }
  if (fieldKey === "customer.about" || fieldKey === "about") {
    return customer.about || fallback;
  }
  if (fieldKey === "customer.notes" || fieldKey === "notes") {
    return customer.notes || fallback;
  }

  // Check customer metadata for custom attributes
  if (customer.metadata && typeof customer.metadata === "object") {
    const clean = fieldKey.replace(/^customer\./, "");
    const val = (customer.metadata as Record<string, unknown>)[clean];
    if (val !== undefined && val !== null) {
      return String(val);
    }
  }

  return fallback;
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

  // Resolve dynamic placeholders in components if any
  let resolvedComponents: unknown[] = components;

  if (Array.isArray(components) && components.length > 0) {
    resolvedComponents = components.map((comp: unknown) => {
      const c = comp as Record<string, unknown>;
      const cType = String(c?.type || "").toLowerCase();
      if (
        (cType === "body" || cType === "header") &&
        Array.isArray(c.parameters)
      ) {
        return {
          ...c,
          parameters: c.parameters.map((param: unknown) => {
            const p = param as Record<string, unknown>;
            if (p && p.type === "text" && typeof p.text === "string") {
              let text = p.text;
              if (text.includes("{{customer.") || text.includes("{{custom.")) {
                text = text
                  .replace(
                    /\{\{customer\.customName\}\}/g,
                    customer.customName || customer.whatsappName || "Customer"
                  )
                  .replace(
                    /\{\{customer\.name\}\}/g,
                    customer.customName || customer.whatsappName || "Customer"
                  )
                  .replace(
                    /\{\{customer\.whatsappName\}\}/g,
                    customer.whatsappName || customer.customName || "Customer"
                  )
                  .replace(
                    /\{\{customer\.phoneNumber\}\}/g,
                    customer.phoneNumber || customer.normalizedPhone
                  )
                  .replace(/\{\{customer\.about\}\}/g, customer.about || "")
                  .replace(/\{\{customer\.notes\}\}/g, customer.notes || "");
              }
              return { ...p, text };
            }
            return p;
          })
        };
      }
      return c;
    });
  } else if (
    (!resolvedComponents || resolvedComponents.length === 0) &&
    (templateId || templateName)
  ) {
    // Attempt auto-resolution from template's stored variableMappings
    const tmpl = await prisma.whatsappTemplate.findFirst({
      where: templateId ? { id: templateId } : { name: templateName },
      include: { components: true }
    });
    const bodyComp = tmpl?.components.find((c) => c.type === "BODY");
    if (bodyComp) {
      const bText = bodyComp.text || "";
      const matches = Array.from(bText.matchAll(/\{\{(\d+)\}\}/g));
      const varKeys = Array.from(new Set(matches.map((m) => m[1]))).sort(
        (a, b) => parseInt(a, 10) - parseInt(b, 10)
      );

      const rawMappings =
        ((bodyComp.examples as Record<string, unknown>)
          ?.variableMappings as Record<
          string,
          {
            type?: string;
            field?: string;
            customField?: string;
            fallback?: string;
            staticValue?: string;
            sample?: string;
          }
        >) ||
        ((bodyComp.rawJson as Record<string, unknown>)
          ?.variableMappings as Record<
          string,
          {
            type?: string;
            field?: string;
            customField?: string;
            fallback?: string;
            staticValue?: string;
            sample?: string;
          }
        >) ||
        {};

      if (varKeys.length > 0) {
        const parameters = varKeys.map((k) => {
          const mapping = rawMappings[k];
          const textVal = resolveCustomerTemplateVariable(customer, mapping);
          return { type: "text", text: textVal || "Valued Customer" };
        });
        resolvedComponents = [{ type: "body", parameters }];
      }
    }
  }

  // Snapshot the template config so historical messages remain immutable
  const templateSnapshot = {
    templateId,
    templateName,
    language,
    components: resolvedComponents
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
    components: resolvedComponents
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
