import type { ProviderInterface, SendMessageOptions, SendMessageResult, StatusUpdateEvent } from "./types.js";

/**
 * Green API Provider Stub
 * 
 * This is a placeholder implementation that returns "not configured" errors.
 * To implement fully, refer to: https://green-api.com/docs/
 * 
 * Required environment variables:
 * - GREEN_API_INSTANCE_ID
 * - GREEN_API_TOKEN
 */
export class GreenApiProvider implements ProviderInterface {
  name = "green-api";

  private instanceId: string | null;
  private token: string | null;

  constructor() {
    this.instanceId = process.env.GREEN_API_INSTANCE_ID || null;
    this.token = process.env.GREEN_API_TOKEN || null;
  }

  private isConfigured(): boolean {
    return Boolean(this.instanceId && this.token);
  }

  async sendMessage(options: SendMessageOptions): Promise<SendMessageResult> {
    if (!this.isConfigured()) {
      throw new Error(
        "Green API is not configured. Please set GREEN_API_INSTANCE_ID and GREEN_API_TOKEN environment variables."
      );
    }

    // TODO: Implement actual Green API call
    // POST https://api.green-api.com/waInstance{instanceId}/sendMessage/{token}
    // Body: { chatId: "{phone}@c.us", message: "{message}" }
    
    throw new Error(
      "Green API integration not yet implemented. Provider stub only."
    );
  }

  async getStatus(externalMessageId: string): Promise<StatusUpdateEvent> {
    if (!this.isConfigured()) {
      throw new Error("Green API is not configured.");
    }

    // TODO: Implement status check via Green API
    throw new Error("Green API getStatus not implemented.");
  }

  async handleWebhook(payload: Record<string, unknown>): Promise<StatusUpdateEvent | null> {
    // Green API webhook payload structure:
    // {
    //   "typeWebhook": "outgoingMessageStatus",
    //   "instanceData": { "idInstance": 123, "wid": "..." },
    //   "timestamp": 1234567890,
    //   "idMessage": "...",
    //   "status": "sent" | "delivered" | "read" | "noAccount" | "failed"
    // }

    const typeWebhook = payload.typeWebhook as string | undefined;
    
    if (typeWebhook !== "outgoingMessageStatus") {
      return null; // Not a status update webhook
    }

    const idMessage = payload.idMessage as string | undefined;
    const status = payload.status as string | undefined;

    if (!idMessage || !status) {
      return null;
    }

    const statusMap: Record<string, StatusUpdateEvent["status"]> = {
      sent: "sent",
      delivered: "delivered",
      read: "read",
      noAccount: "noAccount",
      failed: "failed",
    };

    const mappedStatus = statusMap[status];
    if (!mappedStatus) {
      return null;
    }

    return {
      externalMessageId: idMessage,
      status: mappedStatus,
      timestamp: new Date(),
    };
  }
}

export const greenApiProvider = new GreenApiProvider();
