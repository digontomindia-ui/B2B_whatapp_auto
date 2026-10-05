import { WHATSAPP_CONFIG } from "@/lib/env";

interface WhatsAppResponse {
  data: unknown;
  status: number;
  statusText: string;
}

interface WhatsAppMessage {
  messaging_product: "whatsapp";
  recipient_type?: "individual";
  to: string;
  type: string;
  [key: string]: unknown;
}

class WhatsAppClient {
  private static instance: WhatsAppClient;

  private constructor(
    private readonly phoneNumberId: string,
    private readonly accessToken: string
  ) {}

  static getInstance(): WhatsAppClient {
    if (!WhatsAppClient.instance) {
      const { PHONE_ID, ACCESS_TOKEN } = WHATSAPP_CONFIG;

      WhatsAppClient.instance = new WhatsAppClient(PHONE_ID, ACCESS_TOKEN);
    }

    return WhatsAppClient.instance;
  }

  private sanitizePhoneNumber(phone: string): string {
    const cleaned = phone.replace(/\D/g, "");

    return cleaned.length === 10 ? `91${cleaned}` : cleaned;
  }

  async sendMessage(message: WhatsAppMessage): Promise<WhatsAppResponse> {
    const response = await fetch(
      `https://graph.facebook.com/v23.0/${this.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ...message,
          to: this.sanitizePhoneNumber(message.to)
        })
      }
    );

    const data: unknown = await response.json();

    if (!response.ok) {
      throw new Error(
        `WhatsApp API Error: ${response.status} ${response.statusText} - ${JSON.stringify(data)}`
      );
    }

    return {
      data,
      status: response.status,
      statusText: response.statusText
    };
  }

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
  }): Promise<WhatsAppResponse> {
    return this.sendMessage({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "template",
      template: {
        name,
        language: {
          code: language
        },
        components
      }
    });
  }
}

export const whatsappClient = WhatsAppClient.getInstance();
