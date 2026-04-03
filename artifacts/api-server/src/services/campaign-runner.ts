import { db } from "@workspace/db";
import {
  campaignsTable,
  campaignContactsTable,
  messagesTable,
  messageEventsTable,
  contactsTable,
} from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import { mockProvider } from "./provider/index.js";
import { logger } from "../lib/logger.js";
import type { StatusUpdateEvent } from "./provider/types.js";

type CampaignState = "running" | "paused" | "cancelled";

const runnerStates = new Map<number, CampaignState>();
const pauseResolvers = new Map<number, (() => void)[]>();

function waitForResume(campaignId: number): Promise<void> {
  return new Promise((resolve) => {
    const resolvers = pauseResolvers.get(campaignId) ?? [];
    resolvers.push(resolve);
    pauseResolvers.set(campaignId, resolvers);
  });
}

function resumeCampaign(campaignId: number) {
  const resolvers = pauseResolvers.get(campaignId) ?? [];
  for (const r of resolvers) r();
  pauseResolvers.delete(campaignId);
}

async function updateMessageStatus(messageId: number, event: StatusUpdateEvent) {
  await db
    .update(messagesTable)
    .set({ lastStatus: event.status, updatedAt: new Date() })
    .where(eq(messagesTable.id, messageId));

  await db.insert(messageEventsTable).values({
    messageId,
    status: event.status,
    eventPayload: event as unknown as Record<string, unknown>,
    description: getStatusDescription(event.status, event.errorMessage),
  });

  const campaignContactStatus = mapStatusToCampaignContact(event.status);
  if (campaignContactStatus) {
    const [msg] = await db
      .select({ campaignId: messagesTable.campaignId, contactId: messagesTable.contactId })
      .from(messagesTable)
      .where(eq(messagesTable.id, messageId));

    if (msg) {
      await db
        .update(campaignContactsTable)
        .set({
          status: campaignContactStatus,
          ...(event.status === "sent" ? { sentAt: event.timestamp } : {}),
          ...(event.status === "delivered" ? { deliveredAt: event.timestamp } : {}),
          ...(event.status === "read" ? { readAt: event.timestamp } : {}),
          ...(event.status === "failed" || event.status === "noAccount" ? { failedAt: event.timestamp } : {}),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(campaignContactsTable.campaignId, msg.campaignId),
            eq(campaignContactsTable.contactId, msg.contactId)
          )
        );

      await updateCampaignCounters(msg.campaignId);
    }
  }
}

function mapStatusToCampaignContact(status: string): string | null {
  const map: Record<string, string> = {
    sent: "sent",
    delivered: "delivered",
    read: "read",
    failed: "failed",
    noAccount: "noAccount",
  };
  return map[status] ?? null;
}

function getStatusDescription(status: string, errorMessage?: string): string {
  switch (status) {
    case "queued": return "Message added to send queue";
    case "sent": return "Message accepted by provider and dispatched";
    case "delivered": return "Message delivered to recipient device";
    case "read": return "Message read by recipient";
    case "failed": return errorMessage ?? "Message delivery failed";
    case "noAccount": return "Target number has no WhatsApp account";
    default: return `Status updated to ${status}`;
  }
}

async function updateCampaignCounters(campaignId: number) {
  const counts = await db
    .select({ status: campaignContactsTable.status })
    .from(campaignContactsTable)
    .where(eq(campaignContactsTable.campaignId, campaignId));

  const counter = {
    queuedCount: 0,
    sentCount: 0,
    deliveredCount: 0,
    readCount: 0,
    failedCount: 0,
    noAccountCount: 0,
  };

  for (const r of counts) {
    if (r.status === "queued") counter.queuedCount++;
    else if (r.status === "sent") counter.sentCount++;
    else if (r.status === "delivered") counter.deliveredCount++;
    else if (r.status === "read") counter.readCount++;
    else if (r.status === "failed") counter.failedCount++;
    else if (r.status === "noAccount") counter.noAccountCount++;
  }

  await db
    .update(campaignsTable)
    .set({ ...counter, updatedAt: new Date() })
    .where(eq(campaignsTable.id, campaignId));
}

mockProvider.onStatusUpdate(async (event: StatusUpdateEvent) => {
  try {
    const [msg] = await db
      .select({ id: messagesTable.id })
      .from(messagesTable)
      .where(eq(messagesTable.externalMessageId, event.externalMessageId));

    if (msg) {
      await updateMessageStatus(msg.id, event);
    }
  } catch (err) {
    logger.error({ err, externalMessageId: event.externalMessageId }, "Error processing status update");
  }
});

export async function startCampaignRunner(campaignId: number) {
  runnerStates.set(campaignId, "running");

  const [campaign] = await db
    .select()
    .from(campaignsTable)
    .where(eq(campaignsTable.id, campaignId));

  if (!campaign) {
    logger.error({ campaignId }, "Campaign not found for runner");
    return;
  }

  await db
    .update(campaignsTable)
    .set({ status: "running", startedAt: new Date(), updatedAt: new Date() })
    .where(eq(campaignsTable.id, campaignId));

  const contacts = await db
    .select({
      ccId: campaignContactsTable.id,
      contactId: campaignContactsTable.contactId,
      renderedMessage: campaignContactsTable.renderedMessage,
      status: campaignContactsTable.status,
    })
    .from(campaignContactsTable)
    .where(
      and(
        eq(campaignContactsTable.campaignId, campaignId),
        inArray(campaignContactsTable.status, ["queued"])
      )
    );

  logger.info({ campaignId, count: contacts.length }, "Starting campaign runner");

  for (const cc of contacts) {
    const state = runnerStates.get(campaignId);
    if (state === "cancelled") {
      break;
    }
    if (state === "paused") {
      await waitForResume(campaignId);
      const newState = runnerStates.get(campaignId);
      if (newState === "cancelled") break;
    }

    try {
      const [contact] = await db
        .select({ phone: contactsTable.phone })
        .from(contactsTable)
        .where(eq(contactsTable.id, cc.contactId));

      if (!contact) continue;

      const isDryRun = campaign.dryRun === "true";

      if (isDryRun) {
        await db.insert(messagesTable).values({
          campaignId,
          contactId: cc.contactId,
          externalMessageId: `dry_${Date.now()}`,
          provider: campaign.provider,
          requestPayload: { phone: contact.phone, message: cc.renderedMessage, dryRun: true },
          responsePayload: { dryRun: true },
          lastStatus: "sent",
        });

        await db
          .update(campaignContactsTable)
          .set({ status: "sent", sentAt: new Date(), updatedAt: new Date() })
          .where(eq(campaignContactsTable.id, cc.ccId));
      } else {
        const result = await mockProvider.sendMessage({
          contactId: cc.contactId,
          phone: contact.phone,
          message: cc.renderedMessage,
          campaignId,
        });

        const [msg] = await db
          .insert(messagesTable)
          .values({
            campaignId,
            contactId: cc.contactId,
            externalMessageId: result.externalMessageId,
            provider: campaign.provider,
            requestPayload: { phone: contact.phone, message: cc.renderedMessage },
            responsePayload: result.responsePayload as Record<string, unknown>,
            lastStatus: "sent",
          })
          .returning();

        await db.insert(messageEventsTable).values({
          messageId: msg.id,
          status: "sent",
          description: "Message accepted by provider and dispatched",
        });

        await db
          .update(campaignContactsTable)
          .set({ status: "sent", sentAt: new Date(), updatedAt: new Date() })
          .where(eq(campaignContactsTable.id, cc.ccId));
      }

      await updateCampaignCounters(campaignId);

      if (campaign.delaySeconds > 0) {
        await new Promise((resolve) => setTimeout(resolve, campaign.delaySeconds * 1000));
      }
    } catch (err) {
      logger.error({ err, campaignId, contactId: cc.contactId }, "Error sending message");

      await db
        .update(campaignContactsTable)
        .set({ status: "failed", failedAt: new Date(), updatedAt: new Date() })
        .where(eq(campaignContactsTable.id, cc.ccId));

      await updateCampaignCounters(campaignId);
    }
  }

  const finalState = runnerStates.get(campaignId);
  if (finalState === "cancelled") {
    await db
      .update(campaignsTable)
      .set({ status: "cancelled", finishedAt: new Date(), updatedAt: new Date() })
      .where(eq(campaignsTable.id, campaignId));
  } else {
    await db
      .update(campaignsTable)
      .set({ status: "completed", finishedAt: new Date(), updatedAt: new Date() })
      .where(eq(campaignsTable.id, campaignId));
  }

  runnerStates.delete(campaignId);
  logger.info({ campaignId }, "Campaign runner finished");
}

export function pauseRunner(campaignId: number) {
  runnerStates.set(campaignId, "paused");
}

export function resumeRunner(campaignId: number) {
  runnerStates.set(campaignId, "running");
  resumeCampaign(campaignId);
}

export function cancelRunner(campaignId: number) {
  runnerStates.set(campaignId, "cancelled");
  resumeCampaign(campaignId);
}

export function getRunnerState(campaignId: number): CampaignState | undefined {
  return runnerStates.get(campaignId);
}
