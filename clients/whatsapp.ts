import { WHATSAPP_CONFIG } from "@/lib/env";
import { normalizePhoneNumber } from "@/utils/phone";

export interface MetaSendResult {
  success: boolean;
  metaMessageId?: string;
  statusCode: number;
  errorCode?: string;
  errorMessage?: string;
  rawResponse: unknown;
}

export interface MetaTemplateSyncItem {
  id: string;
  name: string;
  status: string;
  category: string;
  language: string;
  components?: Array<{
    type: string;
    format?: string;
    text?: string;
    buttons?: Array<{
      type: string;
      text: string;
      url?: string;
      phone_number?: string;
    }>;
    example?: unknown;
  }>;
  quality_score?: {
    score?: string;
  };
  rejected_reason?: string;
}

export class WhatsAppClient {
  private static instance: WhatsAppClient;

  private constructor(
    private readonly phoneNumberId: string,
    private readonly businessId: string,
    private readonly accessToken: string
  ) {}

  static getInstance(): WhatsAppClient {
    if (!WhatsAppClient.instance) {
      const { PHONE_ID, BUSINESS_ID, ACCESS_TOKEN } = WHATSAPP_CONFIG;
      WhatsAppClient.instance = new WhatsAppClient(
        PHONE_ID,
        BUSINESS_ID,
        ACCESS_TOKEN
      );
    }
    return WhatsAppClient.instance;
  }

  private async callGraphApi<T = unknown>(
    path: string,
    options: RequestInit = {}
  ): Promise<{ ok: boolean; status: number; data: T }> {
    const url = `https://graph.facebook.com/v23.0/${path}`;
    const headers = {
      Authorization: `Bearer ${this.accessToken}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers
      });

      const data = (await response.json().catch(() => ({}))) as T;
      return {
        ok: response.ok,
        status: response.status,
        data
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        status: 500,
        data: {
          error: {
            message: `Network/transport error: ${errorMsg}`,
            code: 500
          }
        } as unknown as T
      };
    }
  }

  private parseError(data: unknown): { code?: string; message?: string } {
    if (!data || typeof data !== "object") return {};
    const d = data as {
      error?: {
        code?: number | string;
        message?: string;
        error_subcode?: number;
        error_user_msg?: string;
        error_user_title?: string;
      };
    };
    if (d.error) {
      let msg =
        d.error.error_user_msg || d.error.message || "Meta WhatsApp API Error";
      if (d.error.code === 131047) {
        msg =
          "Customer service window closed (24 hours elapsed since last customer response). A template message is required.";
      }
      return {
        code: String(d.error.code ?? d.error.error_subcode ?? "META_ERROR"),
        message: msg
      };
    }
    return {};
  }

  /**
   * Send arbitrary message payload to WhatsApp Cloud API
   */
  async sendMessage(payload: Record<string, unknown>): Promise<MetaSendResult> {
    const recipient = String(payload.to || "");
    const normalizedTo = normalizePhoneNumber(recipient);

    const fullPayload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      ...payload,
      to: normalizedTo
    };

    const res = await this.callGraphApi<{
      messages?: Array<{ id: string }>;
      error?: unknown;
    }>(`${this.phoneNumberId}/messages`, {
      method: "POST",
      body: JSON.stringify(fullPayload)
    });

    if (!res.ok || !res.data?.messages?.[0]?.id) {
      const { code, message } = this.parseError(res.data);
      return {
        success: false,
        statusCode: res.status,
        errorCode: code || `HTTP_${res.status}`,
        errorMessage:
          message || "Failed to deliver message via WhatsApp Cloud API",
        rawResponse: res.data
      };
    }

    return {
      success: true,
      metaMessageId: res.data.messages[0].id,
      statusCode: res.status,
      rawResponse: res.data
    };
  }

  /**
   * Send plain text message
   */
  async sendText(
    to: string,
    text: string,
    previewUrl = false
  ): Promise<MetaSendResult> {
    return this.sendMessage({
      to,
      type: "text",
      text: {
        preview_url: previewUrl,
        body: text
      }
    });
  }

  /**
   * Send media message (image, video, audio, document)
   */
  async sendMedia({
    to,
    type,
    mediaId,
    link,
    caption,
    filename
  }: {
    to: string;
    type: "image" | "video" | "audio" | "document" | "sticker";
    mediaId?: string;
    link?: string;
    caption?: string;
    filename?: string;
  }): Promise<MetaSendResult> {
    const mediaPayload: Record<string, unknown> = {};
    if (mediaId) {
      mediaPayload.id = mediaId;
    } else if (link) {
      mediaPayload.link = link;
    }

    if (caption && type !== "audio" && type !== "sticker") {
      mediaPayload.caption = caption;
    }
    if (filename && type === "document") {
      mediaPayload.filename = filename;
    }

    return this.sendMessage({
      to,
      type,
      [type]: mediaPayload
    });
  }

  /**
   * Send approved WhatsApp template message
   */
  async sendTemplate({
    to,
    name,
    language = "en",
    components = []
  }: {
    to: string;
    name: string;
    language?: string;
    components?: unknown[];
  }): Promise<MetaSendResult> {
    return this.sendMessage({
      to,
      type: "template",
      template: {
        name,
        language: { code: language },
        components
      }
    });
  }

  /**
   * Mark an incoming message as read
   */
  async markAsRead(messageId: string): Promise<boolean> {
    const res = await this.callGraphApi<{ success?: boolean }>(
      `${this.phoneNumberId}/messages`,
      {
        method: "POST",
        body: JSON.stringify({
          messaging_product: "whatsapp",
          status: "read",
          message_id: messageId
        })
      }
    );
    return res.ok;
  }

  /**
   * Retrieve media URL and metadata from Meta Graph API
   */
  async getMediaMetadata(mediaId: string): Promise<{
    url?: string;
    mime_type?: string;
    file_size?: number;
    id?: string;
    error?: string;
  }> {
    const res = await this.callGraphApi<{
      url?: string;
      mime_type?: string;
      file_size?: number;
      id?: string;
    }>(mediaId, { method: "GET" });

    if (!res.ok || !res.data?.url) {
      const { message } = this.parseError(res.data);
      return { error: message || "Failed to retrieve media metadata" };
    }

    return res.data;
  }

  /**
   * Download media binary from Meta (requires Bearer token authentication)
   */
  async downloadMedia(mediaId: string): Promise<{
    buffer: Buffer;
    mimeType: string;
  } | null> {
    const meta = await this.getMediaMetadata(mediaId);
    if (!meta.url) return null;

    try {
      const response = await fetch(meta.url, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`
        }
      });

      if (!response.ok) {
        console.error(
          `Failed to download media ${mediaId}: ${response.status} ${response.statusText}`
        );
        return null;
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const mimeType =
        meta.mime_type ||
        response.headers.get("content-type") ||
        "application/octet-stream";

      return { buffer, mimeType };
    } catch (err) {
      console.error(`Error downloading media from Meta:`, err);
      return null;
    }
  }

  /**
   * Fetch approved/available templates from WhatsApp Business Account (WABA)
   */
  async fetchTemplates(wabaId?: string): Promise<{
    templates: MetaTemplateSyncItem[];
    error?: string;
  }> {
    const accountId = wabaId || this.businessId;
    if (!accountId) {
      return { templates: [], error: "Missing WhatsApp Business Account ID" };
    }

    const res = await this.callGraphApi<{
      data?: MetaTemplateSyncItem[];
      error?: unknown;
    }>(`${accountId}/message_templates?limit=100`, {
      method: "GET"
    });

    if (!res.ok) {
      const { message } = this.parseError(res.data);
      return {
        templates: [],
        error: message || "Failed to fetch WABA templates"
      };
    }

    return { templates: res.data?.data || [] };
  }

  /**
   * Create a new message template in Meta WABA
   */
  async createTemplate(
    payload: Record<string, unknown>,
    wabaId?: string
  ): Promise<{
    success: boolean;
    templateId?: string;
    status?: string;
    error?: string;
    raw?: unknown;
  }> {
    const accountId = wabaId || this.businessId;
    if (!accountId) {
      return { success: false, error: "Missing WhatsApp Business Account ID" };
    }

    const res = await this.callGraphApi<{
      id?: string;
      status?: string;
      error?: unknown;
    }>(`${accountId}/message_templates`, {
      method: "POST",
      body: JSON.stringify(payload)
    });

    if (!res.ok || !res.data?.id) {
      const { message } = this.parseError(res.data);
      return {
        success: false,
        error: message || "Failed to create template on Meta",
        raw: res.data
      };
    }

    return {
      success: true,
      templateId: res.data.id,
      status: res.data.status,
      raw: res.data
    };
  }
}

export const whatsappClient = WhatsAppClient.getInstance();
