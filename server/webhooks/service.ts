import prisma from "@/lib/prisma";
import { findOrCreateCustomerByPhone } from "@/server/customers/service";
import { realtimeBroadcaster } from "@/server/realtime/broadcaster";
import {
  MessageDirection,
  MessageStatus,
  MessageType,
  WebhookStatus,
  Prisma
} from "@prisma/client";

interface MetaWebhookMessage {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: { body: string };
  image?: { id: string; mime_type?: string; caption?: string; sha256?: string };
  video?: { id: string; mime_type?: string; caption?: string };
  audio?: { id: string; mime_type?: string };
  document?: {
    id: string;
    mime_type?: string;
    filename?: string;
    caption?: string;
  };
  sticker?: { id: string; mime_type?: string };
  location?: {
    latitude: number;
    longitude: number;
    name?: string;
    address?: string;
  };
  reaction?: { message_id: string; emoji: string };
  context?: { id?: string };
  errors?: Array<{ code: number; title: string; message?: string }>;
}

interface MetaWebhookStatus {
  id: string;
  status: "sent" | "delivered" | "read" | "failed";
  timestamp: string;
  recipient_id: string;
  errors?: Array<{
    code: number;
    title: string;
    message?: string;
    error_data?: { details: string };
  }>;
}

interface MetaContactProfile {
  name?: string;
  picture?: string;
  photo?: string;
  avatar?: string;
  image?: string;
  profile_pic?: string;
  photo_url?: string;
  picture_url?: string;
  [key: string]: unknown;
}

interface MetaWebhookValue {
  messaging_product?: string;
  metadata?: { display_phone_number?: string; phone_number_id?: string };
  contacts?: Array<{ profile?: MetaContactProfile; wa_id: string }>;
  messages?: MetaWebhookMessage[];
  statuses?: MetaWebhookStatus[];
}

export async function processWebhookPayload(payload: Record<string, unknown>) {
  const entries =
    (payload.entry as Array<{
      changes?: Array<{ value?: MetaWebhookValue }>;
    }>) || [];

  for (const entry of entries) {
    for (const change of entry.changes || []) {
      const val = change.value;
      if (!val) continue;

      // Extract contact profile map including name and profile picture
      const contactMap = new Map<string, { name?: string; profilePicUrl?: string }>();
      for (const contact of val.contacts || []) {
        if (contact.wa_id) {
          const prof = contact.profile;
          const pic =
            prof?.picture ||
            prof?.photo ||
            prof?.avatar ||
            prof?.image ||
            prof?.profile_pic ||
            prof?.photo_url ||
            prof?.picture_url;

          contactMap.set(contact.wa_id, {
            name: prof?.name,
            profilePicUrl: typeof pic === "string" && pic.trim() ? pic.trim() : undefined
          });
        }
      }

      // 1. Process Incoming Messages
      if (val.messages && val.messages.length > 0) {
        for (const msg of val.messages) {
          await handleIncomingMessage(msg, contactMap);
        }
      }

      // 2. Process Status Updates
      if (val.statuses && val.statuses.length > 0) {
        for (const st of val.statuses) {
          await handleStatusUpdate(st);
        }
      }
    }
  }
}

async function handleIncomingMessage(
  msg: MetaWebhookMessage,
  contactMap: Map<string, { name?: string; profilePicUrl?: string }>
) {
  // Idempotency check: ignore if message already exists
  const existing = await prisma.message.findUnique({
    where: { metaMessageId: msg.id }
  });
  if (existing) {
    return;
  }

  // Record webhook audit event
  await prisma.webhookEvent.create({
    data: {
      eventType: "incoming_message",
      metaId: msg.id,
      payload: msg as unknown as Prisma.InputJsonValue,
      processingStatus: WebhookStatus.PROCESSED,
      processedAt: new Date()
    }
  });

  const senderPhone = msg.from;
  const contactInfo = contactMap.get(senderPhone);
  const whatsappName = contactInfo?.name || null;
  const profilePicUrl = contactInfo?.profilePicUrl || null;

  // Find or create customer, updating profile picture if available from Meta
  const customer = await findOrCreateCustomerByPhone({
    phone: senderPhone,
    whatsappName,
    profilePicUrl
  });

  // Find or create conversation
  let conversation = await prisma.conversation.findFirst({
    where: { customerId: customer.id },
    orderBy: { createdAt: "desc" }
  });
  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: { customerId: customer.id }
    });
  }

  // Parse message content & type
  let type: MessageType = MessageType.TEXT;
  let body: string | null = null;
  let mediaData: {
    type: MessageType;
    metaMediaId?: string;
    mimeType?: string;
    caption?: string;
    fileName?: string;
  } | null = null;

  if (msg.type === "text" && msg.text) {
    type = MessageType.TEXT;
    body = msg.text.body;
  } else if (msg.type === "image" && msg.image) {
    type = MessageType.IMAGE;
    body = msg.image.caption || null;
    mediaData = {
      type: MessageType.IMAGE,
      metaMediaId: msg.image.id,
      mimeType: msg.image.mime_type || "image/jpeg",
      caption: msg.image.caption
    };
  } else if (msg.type === "video" && msg.video) {
    type = MessageType.VIDEO;
    body = msg.video.caption || null;
    mediaData = {
      type: MessageType.VIDEO,
      metaMediaId: msg.video.id,
      mimeType: msg.video.mime_type || "video/mp4",
      caption: msg.video.caption
    };
  } else if (msg.type === "audio" && msg.audio) {
    type = MessageType.AUDIO;
    mediaData = {
      type: MessageType.AUDIO,
      metaMediaId: msg.audio.id,
      mimeType: msg.audio.mime_type || "audio/ogg"
    };
  } else if (msg.type === "document" && msg.document) {
    type = MessageType.DOCUMENT;
    body = msg.document.caption || msg.document.filename || null;
    mediaData = {
      type: MessageType.DOCUMENT,
      metaMediaId: msg.document.id,
      mimeType: msg.document.mime_type || "application/pdf",
      fileName: msg.document.filename,
      caption: msg.document.caption
    };
  } else if (msg.type === "sticker" && msg.sticker) {
    type = MessageType.STICKER;
    mediaData = {
      type: MessageType.STICKER,
      metaMediaId: msg.sticker.id,
      mimeType: msg.sticker.mime_type || "image/webp"
    };
  } else if (msg.type === "location" && msg.location) {
    type = MessageType.LOCATION;
    body =
      `Location: ${msg.location.name || ""}, ${msg.location.address || ""}`.trim();
  } else if (msg.type === "reaction" && msg.reaction) {
    type = MessageType.REACTION;
    body = msg.reaction.emoji;
  }

  const msgTimestamp = msg.timestamp
    ? new Date(Number(msg.timestamp) * 1000)
    : new Date();

  // Create message in DB
  const createdMessage = await prisma.message.create({
    data: {
      customerId: customer.id,
      conversationId: conversation.id,
      direction: MessageDirection.INBOUND,
      type,
      body,
      metaMessageId: msg.id,
      status: MessageStatus.DELIVERED,
      incomingAt: msgTimestamp,
      replyToMetaMessageId: msg.context?.id || null,
      rawPayload: msg as unknown as Prisma.InputJsonValue,
      ...(mediaData
        ? {
            mediaAttachment: {
              create: {
                type: mediaData.type,
                metaMediaId: mediaData.metaMediaId,
                mimeType: mediaData.mimeType || "application/octet-stream",
                caption: mediaData.caption,
                fileName: mediaData.fileName
              }
            }
          }
        : {})
    },
    include: { mediaAttachment: true }
  });

  // Update customer & conversation
  const updatedCustomer = await prisma.customer.update({
    where: { id: customer.id },
    data: {
      unreadCount: { increment: 1 },
      lastInboundAt: msgTimestamp,
      lastInteractionAt: msgTimestamp
    },
    include: {
      tags: { include: { tag: true } },
      conversations: { take: 1, orderBy: { createdAt: "desc" } }
    }
  });

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { lastMessageAt: msgTimestamp }
  });

  // Broadcast realtime updates
  realtimeBroadcaster.broadcast("MESSAGE_CREATED", createdMessage);
  realtimeBroadcaster.broadcast("CUSTOMER_UPDATED", updatedCustomer);
  realtimeBroadcaster.broadcast("CUSTOMER_UNREAD_UPDATED", {
    customerId: customer.id,
    unreadCount: updatedCustomer.unreadCount
  });
}

async function handleStatusUpdate(st: MetaWebhookStatus) {
  const metaId = st.id;
  const message = await prisma.message.findUnique({
    where: { metaMessageId: metaId }
  });

  if (!message) {
    return;
  }

  const now = new Date(Number(st.timestamp) * 1000);
  let newStatus: MessageStatus = message.status;
  const updateData: Record<string, unknown> = {};

  if (st.status === "sent") {
    newStatus = MessageStatus.SENT;
    updateData.status = newStatus;
    if (!message.sentAt) updateData.sentAt = now;
  } else if (st.status === "delivered") {
    newStatus = MessageStatus.DELIVERED;
    updateData.status = newStatus;
    updateData.deliveredAt = now;
  } else if (st.status === "read") {
    newStatus = MessageStatus.READ;
    updateData.status = newStatus;
    updateData.readAt = now;
  } else if (st.status === "failed") {
    newStatus = MessageStatus.FAILED;
    updateData.status = newStatus;
    updateData.failedAt = now;
    if (st.errors && st.errors.length > 0) {
      updateData.errorCode = String(st.errors[0].code);
      updateData.errorMessage =
        st.errors[0].error_data?.details ||
        st.errors[0].message ||
        st.errors[0].title ||
        "Delivery failed";
    }
  }

  const updatedMsg = await prisma.message.update({
    where: { id: message.id },
    data: updateData,
    include: { mediaAttachment: true }
  });

  // If this message belongs to a bulk job recipient, update the recipient too
  if (message.bulkRecipientId) {
    await prisma.bulkMessageRecipient.update({
      where: { id: message.bulkRecipientId },
      data: {
        status: newStatus,
        errorCode: (updateData.errorCode as string) || null,
        errorMessage: (updateData.errorMessage as string) || null,
        deliveredAt: (updateData.deliveredAt as Date) || undefined,
        readAt: (updateData.readAt as Date) || undefined,
        failedAt: (updateData.failedAt as Date) || undefined
      }
    });

    // Update bulk message job aggregate counters
    if (newStatus === MessageStatus.DELIVERED) {
      await prisma.bulkMessageJob.update({
        where: { id: message.bulkJobId! },
        data: { deliveredCount: { increment: 1 } }
      });
    } else if (newStatus === MessageStatus.READ) {
      await prisma.bulkMessageJob.update({
        where: { id: message.bulkJobId! },
        data: { readCount: { increment: 1 } }
      });
    } else if (newStatus === MessageStatus.FAILED) {
      await prisma.bulkMessageJob.update({
        where: { id: message.bulkJobId! },
        data: { failedCount: { increment: 1 } }
      });
    }

    realtimeBroadcaster.broadcast("BULK_RECIPIENT_UPDATED", {
      bulkJobId: message.bulkJobId,
      recipientId: message.bulkRecipientId,
      status: newStatus
    });
  }

  // Broadcast realtime event
  if (newStatus === MessageStatus.DELIVERED) {
    realtimeBroadcaster.broadcast("MESSAGE_DELIVERED", updatedMsg);
  } else if (newStatus === MessageStatus.READ) {
    realtimeBroadcaster.broadcast("MESSAGE_READ", updatedMsg);
  } else if (newStatus === MessageStatus.FAILED) {
    realtimeBroadcaster.broadcast("MESSAGE_FAILED", updatedMsg);
  }
  realtimeBroadcaster.broadcast("MESSAGE_UPDATED", updatedMsg);
}
