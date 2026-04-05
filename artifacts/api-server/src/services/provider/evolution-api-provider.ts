import type { ProviderInterface, SendMessageOptions, SendMessageResult, StatusUpdateEvent } from "./types.js";

/**
 * Evolution API Provider Stub
 * 
 * This is a placeholder implementation that returns "not configured" errors.
 * To implement fully, refer to: https://doc.evolution-api.com/
 * 
 * Required environment variables:
 * - EVOLUTION_API_URL (e.g., https://api.yourserver.com)
 * - EVOLUTION_API_KEY
 * - EVOLUTION_API_INSTANCE
 */
export class EvolutionApiProvider implements ProviderInterface {
  name = "evolution-api";

  private baseUrl: string | null;
  private apiKey: string | null;
  private instance: string | null;

  constructor() {
    this.baseUrl = process.env.EVOLUTION_API_URL || null;
    this.apiKey = process.env.EVOLUTION_API_KEY || null;
    this.instance = process.env.EVOLUTION_API_INSTANCE || null;
  }

  private isConfigured(): boolean {
    return Boolean(this.baseUrl && this.apiKey && this.instance);
  }

  async sendMessage(options: SendMessageOptions): Promise<SendMessageResult> {
    if (!this.isConfigured()) {
      throw new Error(
        "Evolution API is not configured. Please set EVOLUTION_API_URL, EVOLUTION_API_KEY, and EVOLUTION_API_INSTANCE environment variables."
      );
    }

    // TODO: Implement actual Evolution API call
    // POST {baseUrl}/message/sendText/{instance}
    // Headers: { "apikey": "{apiKey}" }
    // Body: { "number": "{phone}", "text": "{message}" }
    
    throw new Error(
      "Evolution API integration not yet implemented. Provider stub only."
    );
  }

  async getStatus(externalMessageId: string): Promise<StatusUpdateEvent> {
    if (!this.isConfigured()) {
      throw new Error("Evolution API is not configured.");
    }

    // TODO: Implement status check via Evolution API
    throw new Error("Evolution API getStatus not implemented.");
  }

  async handleWebhook(payload: Record<string, unknown>): Promise<StatusUpdateEvent | null> {
    // Evolution API webhook payload structure:
    // {
    //   "event": "messages.update",
    //   "instance": "...",
    //   "data": {
    //     "key": { "remoteJid": "...", "id": "..." },
    //     "status": "DELIVERY_ACK" | "READ" | "PLAYED" | "PENDING" | "ERROR"
    //   }
    // }

    const event = payload.event as string | undefined;
    
    if (event !== "messages.update") {
      return null; // Not a status update webhook
    }

    const data = payload.data as Record<string, unknown> | undefined;
    if (!data) return null;

    const key = data.key as Record<string, unknown> | undefined;
    const status = data.status as string | undefined;

    if (!key?.id || !status) {
      return null;
    }

    const statusMap: Record<string, StatusUpdateEvent["status"]> = {
      PENDING: "sent",
      SERVER_ACK: "sent",
      DELIVERY_ACK: "delivered",
      READ: "read",
      PLAYED: "read",
      ERROR: "failed",
    };

    const mappedStatus = statusMap[status];
    if (!mappedStatus) {
      return null;
    }

    return {
      externalMessageId: key.id as string,
      status: mappedStatus,
      errorMessage: status === "ERROR" ? "Message delivery failed" : undefined,
      timestamp: new Date(),
    };
  }
}

export const evolutionApiProvider = new EvolutionApiProvider();
