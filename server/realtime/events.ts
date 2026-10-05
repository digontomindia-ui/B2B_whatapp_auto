export type RealtimeEventType =
  | "CUSTOMER_CREATED"
  | "CUSTOMER_UPDATED"
  | "CUSTOMER_UNREAD_UPDATED"
  | "CONVERSATION_CREATED"
  | "CONVERSATION_UPDATED"
  | "MESSAGE_CREATED"
  | "MESSAGE_UPDATED"
  | "MESSAGE_SENT"
  | "MESSAGE_DELIVERED"
  | "MESSAGE_READ"
  | "MESSAGE_FAILED"
  | "BULK_JOB_CREATED"
  | "BULK_JOB_UPDATED"
  | "BULK_RECIPIENT_UPDATED";

export interface RealtimeEvent<T = unknown> {
  type: RealtimeEventType;
  data: T;
  timestamp: number;
}
