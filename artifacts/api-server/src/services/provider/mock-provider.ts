import type { ProviderInterface, SendMessageOptions, SendMessageResult, StatusUpdateEvent } from "./types.js";

const pendingUpdates = new Map<string, { status: StatusUpdateEvent; delay: number }[]>();

function scheduleStatusUpdates(
  externalMessageId: string,
  onUpdate: (event: StatusUpdateEvent) => void
) {
  const rand = Math.random();
  let sequence: { status: StatusUpdateEvent["status"]; delay: number; errorMessage?: string }[];

  if (rand < 0.05) {
    sequence = [
      { status: "failed", delay: 500, errorMessage: "Number not registered on WhatsApp" },
    ];
    sequence[0].status = "noAccount" as StatusUpdateEvent["status"];
  } else if (rand < 0.15) {
    sequence = [
      { status: "sent", delay: 500 },
      { status: "failed", delay: 1500, errorMessage: "Message delivery failed" },
    ];
  } else if (rand < 0.45) {
    sequence = [
      { status: "sent", delay: 500 },
      { status: "delivered", delay: 2000 },
    ];
  } else {
    sequence = [
      { status: "sent", delay: 500 },
      { status: "delivered", delay: 2000 },
      { status: "read", delay: 4000 },
    ];
  }

  for (const step of sequence) {
    setTimeout(() => {
      onUpdate({
        externalMessageId,
        status: step.status,
        errorMessage: step.errorMessage,
        timestamp: new Date(),
      });
    }, step.delay + Math.random() * 500);
  }
}

export class MockProvider implements ProviderInterface {
  name = "mock";

  private updateCallbacks = new Map<string, (event: StatusUpdateEvent) => void>();

  async sendMessage(options: SendMessageOptions): Promise<SendMessageResult> {
    const externalMessageId = `mock_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    if (this.updateCallbacks.has("*")) {
      const cb = this.updateCallbacks.get("*")!;
      scheduleStatusUpdates(externalMessageId, cb);
    }

    return {
      externalMessageId,
      responsePayload: {
        mock: true,
        phone: options.phone,
        message: options.message,
        timestamp: new Date().toISOString(),
      },
    };
  }

  async getStatus(externalMessageId: string): Promise<StatusUpdateEvent> {
    return {
      externalMessageId,
      status: "sent",
      timestamp: new Date(),
    };
  }

  async handleWebhook(payload: Record<string, unknown>): Promise<StatusUpdateEvent | null> {
    if (!payload.externalMessageId || !payload.status) return null;
    return {
      externalMessageId: payload.externalMessageId as string,
      status: payload.status as StatusUpdateEvent["status"],
      errorMessage: payload.errorMessage as string | undefined,
      timestamp: new Date(),
    };
  }

  onStatusUpdate(callback: (event: StatusUpdateEvent) => void) {
    this.updateCallbacks.set("*", callback);
  }
}

export const mockProvider = new MockProvider();
