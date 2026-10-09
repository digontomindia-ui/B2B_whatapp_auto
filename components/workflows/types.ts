export type WorkflowTriggerType = "KEYWORD" | "ANY_INBOUND" | "MANUAL";

export type WorkflowActionType =
  | "QUESTION"
  | "SEND_MESSAGE"
  | "SEND_MEDIA"
  | "WAIT_DELAY"
  | "UPDATE_CUSTOMER"
  | "CALL_API"
  | "START_WORKFLOW";

export interface QuickReplyOption {
  id: string;
  title: string;
  actions: WorkflowAction[];
}

export interface QuestionConfig {
  bodyText: string;
  headerText?: string;
  footerText?: string;
  options: QuickReplyOption[];
}

export interface SendMessageConfig {
  text: string;
}

export interface SendMediaConfig {
  mediaType: "DOCUMENT" | "IMAGE" | "VIDEO" | "AUDIO";
  mediaUrl: string;
  fileName?: string;
  caption?: string;
}

export interface WaitDelayConfig {
  delaySeconds: number;
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

export interface WorkflowItem {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  triggerType: WorkflowTriggerType;
  triggerKeywords: string[];
  steps: WorkflowAction[];
  totalExecutions?: number;
  completedCount?: number;
  waitingCount?: number;
  failedCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowExecutionItem {
  id: string;
  workflowId: string;
  customerId: string;
  status:
    "RUNNING" | "WAITING_FOR_INPUT" | "COMPLETED" | "FAILED" | "CANCELLED";
  currentStepId?: string | null;
  waitingForReply: boolean;
  contextData?: Record<string, unknown> | null;
  errorLog?: string | null;
  createdAt: string;
  updatedAt: string;
  customer?: {
    id: string;
    customName?: string | null;
    whatsappName?: string | null;
    normalizedPhone: string;
  };
}
