import type {
  CustomerState,
  MessageDirection,
  MessageStatus,
  MessageType,
  TemplateCategory,
  TemplateStatus
} from "@prisma/client";

export interface DashboardCustomer {
  id: string;
  phoneNumber: string;
  normalizedPhone: string;
  whatsappName: string | null;
  customName: string | null;
  profilePicUrl: string | null;
  countryCode: string | null;
  state: CustomerState;
  unreadCount: number;
  lastInteractionAt: string | null;
  lastInboundAt: string | null;
  lastOutboundAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  tags?: Array<{
    tag: {
      id: string;
      name: string;
      color: string;
    };
  }>;
  conversations?: Array<{
    id: string;
  }>;
  messages?: Array<{
    id: string;
    body: string | null;
    type: MessageType;
    direction: MessageDirection;
    status: MessageStatus;
    createdAt: string;
  }>;
}

export interface DashboardMessage {
  id: string;
  customerId: string;
  conversationId: string;
  direction: MessageDirection;
  type: MessageType;
  body: string | null;
  metaMessageId: string | null;
  status: MessageStatus;
  errorCode: string | null;
  errorMessage: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  readAt: string | null;
  failedAt: string | null;
  incomingAt: string | null;
  replyToMetaMessageId: string | null;
  templateId: string | null;
  templateSnapshot: {
    templateId?: string;
    templateName?: string;
    language?: string;
    components?: unknown[];
  } | null;
  mediaAttachment: {
    id: string;
    type: MessageType;
    fileName: string | null;
    mimeType: string;
    fileSize: number | null;
    metaUrl: string | null;
    caption: string | null;
  } | null;
  createdAt: string;
}

export interface DashboardTemplate {
  id: string;
  metaTemplateId: string | null;
  wabaId: string;
  name: string;
  language: string;
  category: TemplateCategory;
  status: TemplateStatus;
  quality: string | null;
  rejectedReason: string | null;
  components: Array<{
    id: string;
    type: "HEADER" | "BODY" | "FOOTER" | "BUTTONS";
    format: string | null;
    text: string | null;
    examples: unknown;
    position: number;
    buttons: Array<{
      id: string;
      type: string;
      text: string;
      url: string | null;
      phoneNumber: string | null;
    }>;
  }>;
}

export interface DashboardBulkJob {
  id: string;
  type: "MESSAGE" | "TEMPLATE";
  status: "PENDING" | "RUNNING" | "COMPLETED" | "PARTIAL" | "FAILED" | "CANCELLED";
  title: string | null;
  content: string | null;
  totalRecipients: number;
  queuedCount: number;
  sendingCount: number;
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  failedCount: number;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}
