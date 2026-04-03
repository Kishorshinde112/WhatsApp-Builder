export interface SendMessageOptions {
  contactId: number;
  phone: string;
  message: string;
  campaignId: number;
}

export interface SendMessageResult {
  externalMessageId: string;
  responsePayload: Record<string, unknown>;
}

export interface StatusUpdateEvent {
  externalMessageId: string;
  status: "sent" | "delivered" | "read" | "failed" | "noAccount";
  errorMessage?: string;
  timestamp: Date;
}

export interface ProviderInterface {
  name: string;
  sendMessage(options: SendMessageOptions): Promise<SendMessageResult>;
  getStatus(externalMessageId: string): Promise<StatusUpdateEvent>;
  handleWebhook(payload: Record<string, unknown>): Promise<StatusUpdateEvent | null>;
}
