import { Router } from "express";
import { db } from "@workspace/db";
import {
  messagesTable,
  messageEventsTable,
  campaignsTable,
  contactsTable,
  campaignContactsTable,
} from "@workspace/db";
import { eq, and, ilike, or, sql, desc, inArray } from "drizzle-orm";
import { getProvider } from "../services/provider/index.js";

const router = Router();

router.get("/tracking/overview", async (_req, res) => {
  const stats = await db
    .select({ status: messagesTable.lastStatus, count: sql<number>`count(*)` })
    .from(messagesTable)
    .groupBy(messagesTable.lastStatus);

  const result = {
    totalMessages: 0,
    queued: 0,
    sent: 0,
    delivered: 0,
    read: 0,
    failed: 0,
    noAccount: 0,
    deliveryRate: 0,
    readRate: 0,
    failureRate: 0,
  };

  for (const row of stats) {
    const count = Number(row.count);
    result.totalMessages += count;
    if (row.status === "queued") result.queued = count;
    else if (row.status === "sent") result.sent = count;
    else if (row.status === "delivered") result.delivered = count;
    else if (row.status === "read") result.read = count;
    else if (row.status === "failed") result.failed = count;
    else if (row.status === "noAccount") result.noAccount = count;
  }

  const delivered = result.delivered + result.read;
  const total = result.totalMessages;
  if (total > 0) {
    result.deliveryRate = Math.round((delivered / total) * 100);
    result.readRate = Math.round((result.read / total) * 100);
    result.failureRate = Math.round(((result.failed + result.noAccount) / total) * 100);
  }

  return res.json(result);
});

router.get("/tracking/messages", async (req, res) => {
  const {
    status,
    campaignId,
    search,
    page = "1",
    limit = "50",
  } = req.query as Record<string, string>;

  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(200, Math.max(1, parseInt(limit)));
  const offset = (pageNum - 1) * limitNum;

  const conditions = [];
  if (status) conditions.push(eq(messagesTable.lastStatus, status));
  if (campaignId) conditions.push(eq(messagesTable.campaignId, parseInt(campaignId)));
  if (search) {
    conditions.push(
      or(
        ilike(contactsTable.name, `%${search}%`),
        ilike(contactsTable.phone, `%${search}%`)
      )!
    );
  }

  const messages = await db
    .select({
      id: messagesTable.id,
      campaignId: messagesTable.campaignId,
      campaignName: campaignsTable.name,
      contactId: messagesTable.contactId,
      contactName: contactsTable.name,
      contactPhone: contactsTable.phone,
      externalMessageId: messagesTable.externalMessageId,
      provider: messagesTable.provider,
      lastStatus: messagesTable.lastStatus,
      errorMessage: messagesTable.errorMessage,
      retryCount: messagesTable.retryCount,
      createdAt: messagesTable.createdAt,
      updatedAt: messagesTable.updatedAt,
    })
    .from(messagesTable)
    .leftJoin(campaignsTable, eq(campaignsTable.id, messagesTable.campaignId))
    .leftJoin(contactsTable, eq(contactsTable.id, messagesTable.contactId))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .limit(limitNum)
    .offset(offset)
    .orderBy(messagesTable.createdAt);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(messagesTable)
    .leftJoin(contactsTable, eq(contactsTable.id, messagesTable.contactId))
    .leftJoin(campaignsTable, eq(campaignsTable.id, messagesTable.campaignId))
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  return res.json({
    messages: messages.map((m) => ({
      ...m,
      contactName: m.contactName ?? "",
      contactPhone: m.contactPhone ?? "",
      campaignName: m.campaignName ?? "",
    })),
    total: Number(count),
    page: pageNum,
    limit: limitNum,
  });
});

router.get("/tracking/messages/:id", async (req, res) => {
  const id = parseInt(req.params.id);

  const [msg] = await db
    .select({
      id: messagesTable.id,
      campaignId: messagesTable.campaignId,
      campaignName: campaignsTable.name,
      contactId: messagesTable.contactId,
      contactName: contactsTable.name,
      contactPhone: contactsTable.phone,
      externalMessageId: messagesTable.externalMessageId,
      provider: messagesTable.provider,
      lastStatus: messagesTable.lastStatus,
      errorMessage: messagesTable.errorMessage,
      retryCount: messagesTable.retryCount,
      requestPayload: messagesTable.requestPayload,
      responsePayload: messagesTable.responsePayload,
      createdAt: messagesTable.createdAt,
      updatedAt: messagesTable.updatedAt,
    })
    .from(messagesTable)
    .leftJoin(campaignsTable, eq(campaignsTable.id, messagesTable.campaignId))
    .leftJoin(contactsTable, eq(contactsTable.id, messagesTable.contactId))
    .where(eq(messagesTable.id, id));

  if (!msg) return res.status(404).json({ error: "Message not found" });

  const events = await db
    .select()
    .from(messageEventsTable)
    .where(eq(messageEventsTable.messageId, id))
    .orderBy(messageEventsTable.createdAt);

  return res.json({
    ...msg,
    contactName: msg.contactName ?? "",
    contactPhone: msg.contactPhone ?? "",
    campaignName: msg.campaignName ?? "",
    events,
  });
});

router.post("/tracking/messages/:id/retry", async (req, res) => {
  const id = parseInt(req.params.id);

  const [msg] = await db.select().from(messagesTable).where(eq(messagesTable.id, id));
  if (!msg) return res.status(404).json({ error: "Message not found" });

  if (!["failed", "noAccount"].includes(msg.lastStatus)) {
    return res.status(400).json({ error: `Cannot retry message with status: ${msg.lastStatus}` });
  }

  const [contact] = await db
    .select()
    .from(contactsTable)
    .where(eq(contactsTable.id, msg.contactId));

  if (!contact) return res.status(404).json({ error: "Contact not found" });

  const cc = await db
    .select({ renderedMessage: campaignContactsTable.renderedMessage })
    .from(campaignContactsTable)
    .where(
      and(
        eq(campaignContactsTable.campaignId, msg.campaignId),
        eq(campaignContactsTable.contactId, msg.contactId)
      )
    );

  const message = cc[0]?.renderedMessage ?? "Retried message";

  const provider = getProvider(msg.provider ?? "mock");
  const result = await provider.sendMessage({
    contactId: msg.contactId,
    phone: contact.phone,
    message,
    campaignId: msg.campaignId,
  });

  const [updated] = await db
    .update(messagesTable)
    .set({
      externalMessageId: result.externalMessageId,
      lastStatus: "sent",
      errorMessage: null,
      retryCount: msg.retryCount + 1,
      responsePayload: result.responsePayload as Record<string, unknown>,
      updatedAt: new Date(),
    })
    .where(eq(messagesTable.id, id))
    .returning();

  await db.insert(messageEventsTable).values({
    messageId: id,
    status: "sent",
    description: `Message retried (attempt ${updated.retryCount})`,
  });

  await db
    .update(campaignContactsTable)
    .set({ status: "sent", sentAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(campaignContactsTable.campaignId, msg.campaignId),
        eq(campaignContactsTable.contactId, msg.contactId)
      )
    );

  const events = await db
    .select()
    .from(messageEventsTable)
    .where(eq(messageEventsTable.messageId, id))
    .orderBy(messageEventsTable.createdAt);

  const [msgDetail] = await db
    .select({
      id: messagesTable.id,
      campaignId: messagesTable.campaignId,
      campaignName: campaignsTable.name,
      contactId: messagesTable.contactId,
      contactName: contactsTable.name,
      contactPhone: contactsTable.phone,
      externalMessageId: messagesTable.externalMessageId,
      provider: messagesTable.provider,
      lastStatus: messagesTable.lastStatus,
      errorMessage: messagesTable.errorMessage,
      retryCount: messagesTable.retryCount,
      requestPayload: messagesTable.requestPayload,
      responsePayload: messagesTable.responsePayload,
      createdAt: messagesTable.createdAt,
      updatedAt: messagesTable.updatedAt,
    })
    .from(messagesTable)
    .leftJoin(campaignsTable, eq(campaignsTable.id, messagesTable.campaignId))
    .leftJoin(contactsTable, eq(contactsTable.id, messagesTable.contactId))
    .where(eq(messagesTable.id, id));

  return res.json({
    ...msgDetail,
    contactName: msgDetail?.contactName ?? "",
    contactPhone: msgDetail?.contactPhone ?? "",
    campaignName: msgDetail?.campaignName ?? "",
    events,
  });
});

router.get("/tracking/export", async (req, res) => {
  const { status, campaignId } = req.query as Record<string, string>;

  const conditions = [];
  if (status) conditions.push(eq(messagesTable.lastStatus, status));
  if (campaignId) conditions.push(eq(messagesTable.campaignId, parseInt(campaignId)));

  const messages = await db
    .select({
      id: messagesTable.id,
      campaignName: campaignsTable.name,
      contactName: contactsTable.name,
      contactPhone: contactsTable.phone,
      provider: messagesTable.provider,
      lastStatus: messagesTable.lastStatus,
      errorMessage: messagesTable.errorMessage,
      retryCount: messagesTable.retryCount,
      externalMessageId: messagesTable.externalMessageId,
      createdAt: messagesTable.createdAt,
      updatedAt: messagesTable.updatedAt,
    })
    .from(messagesTable)
    .leftJoin(campaignsTable, eq(campaignsTable.id, messagesTable.campaignId))
    .leftJoin(contactsTable, eq(contactsTable.id, messagesTable.contactId))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(messagesTable.createdAt);

  const csvRows = [
    ["ID", "Campaign", "Contact", "Phone", "Provider", "Status", "Error", "Retries", "External ID", "Created", "Updated"],
    ...messages.map((m) => [
      m.id,
      m.campaignName ?? "",
      m.contactName ?? "",
      m.contactPhone ?? "",
      m.provider,
      m.lastStatus,
      m.errorMessage ?? "",
      m.retryCount,
      m.externalMessageId ?? "",
      m.createdAt ? new Date(m.createdAt).toISOString() : "",
      m.updatedAt ? new Date(m.updatedAt).toISOString() : "",
    ]),
  ];

  const csv = csvRows.map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="messages-export-${Date.now()}.csv"`);
  return res.send(csv);
});

// Bulk retry failed messages
router.post("/tracking/messages/bulk-retry", async (req, res) => {
  const { messageIds, campaignId, status } = req.body as { 
    messageIds?: number[]; 
    campaignId?: number; 
    status?: string;
  };

  // Build conditions for which messages to retry
  const conditions = [
    or(eq(messagesTable.lastStatus, "failed"), eq(messagesTable.lastStatus, "noAccount"))!
  ];
  
  if (messageIds && messageIds.length > 0) {
    conditions.push(inArray(messagesTable.id, messageIds));
  }
  if (campaignId) {
    conditions.push(eq(messagesTable.campaignId, campaignId));
  }
  if (status) {
    conditions.push(eq(messagesTable.lastStatus, status));
  }

  // Get all eligible messages
  const messages = await db
    .select({
      id: messagesTable.id,
      campaignId: messagesTable.campaignId,
      contactId: messagesTable.contactId,
      provider: messagesTable.provider,
      retryCount: messagesTable.retryCount,
    })
    .from(messagesTable)
    .where(and(...conditions))
    .limit(100); // Cap at 100 to prevent overload

  if (messages.length === 0) {
    return res.json({ success: true, retriedCount: 0, message: "No failed messages found matching criteria" });
  }

  let retriedCount = 0;
  const errors: { messageId: number; error: string }[] = [];

  for (const msg of messages) {
    try {
      const [contact] = await db
        .select({ phone: contactsTable.phone })
        .from(contactsTable)
        .where(eq(contactsTable.id, msg.contactId));

      if (!contact) {
        errors.push({ messageId: msg.id, error: "Contact not found" });
        continue;
      }

      const cc = await db
        .select({ renderedMessage: campaignContactsTable.renderedMessage })
        .from(campaignContactsTable)
        .where(
          and(
            eq(campaignContactsTable.campaignId, msg.campaignId),
            eq(campaignContactsTable.contactId, msg.contactId)
          )
        );

      const message = cc[0]?.renderedMessage ?? "Retried message";
      const provider = getProvider(msg.provider ?? "mock");

      const result = await provider.sendMessage({
        contactId: msg.contactId,
        phone: contact.phone,
        message,
        campaignId: msg.campaignId,
      });

      await db
        .update(messagesTable)
        .set({
          externalMessageId: result.externalMessageId,
          lastStatus: "sent",
          errorMessage: null,
          retryCount: msg.retryCount + 1,
          responsePayload: result.responsePayload as Record<string, unknown>,
          updatedAt: new Date(),
        })
        .where(eq(messagesTable.id, msg.id));

      await db.insert(messageEventsTable).values({
        messageId: msg.id,
        status: "sent",
        description: `Bulk retry (attempt ${msg.retryCount + 1})`,
      });

      await db
        .update(campaignContactsTable)
        .set({ status: "sent", sentAt: new Date(), updatedAt: new Date() })
        .where(
          and(
            eq(campaignContactsTable.campaignId, msg.campaignId),
            eq(campaignContactsTable.contactId, msg.contactId)
          )
        );

      retriedCount++;
    } catch (err) {
      errors.push({ messageId: msg.id, error: String(err) });
    }
  }

  return res.json({
    success: true,
    retriedCount,
    totalEligible: messages.length,
    errors: errors.slice(0, 10),
  });
});

router.get("/dashboard", async (_req, res) => {
  const [{ totalCampaigns }] = await db
    .select({ totalCampaigns: sql<number>`count(*)` })
    .from(campaignsTable);

  const [{ activeCampaigns }] = await db
    .select({ activeCampaigns: sql<number>`count(*)` })
    .from(campaignsTable)
    .where(or(eq(campaignsTable.status, "running"), eq(campaignsTable.status, "paused")));

  const [{ totalContacts }] = await db
    .select({ totalContacts: sql<number>`count(*)` })
    .from(contactsTable);

  const [{ totalMessages }] = await db
    .select({ totalMessages: sql<number>`count(*)` })
    .from(messagesTable);

  const stats = await db
    .select({ status: messagesTable.lastStatus, count: sql<number>`count(*)` })
    .from(messagesTable)
    .groupBy(messagesTable.lastStatus);

  const messageSummary = {
    totalMessages: Number(totalMessages),
    queued: 0,
    sent: 0,
    delivered: 0,
    read: 0,
    failed: 0,
    noAccount: 0,
    deliveryRate: 0,
    readRate: 0,
    failureRate: 0,
  };

  for (const row of stats) {
    const count = Number(row.count);
    if (row.status === "queued") messageSummary.queued = count;
    else if (row.status === "sent") messageSummary.sent = count;
    else if (row.status === "delivered") messageSummary.delivered = count;
    else if (row.status === "read") messageSummary.read = count;
    else if (row.status === "failed") messageSummary.failed = count;
    else if (row.status === "noAccount") messageSummary.noAccount = count;
  }

  if (messageSummary.totalMessages > 0) {
    const delivered = messageSummary.delivered + messageSummary.read;
    messageSummary.deliveryRate = Math.round((delivered / messageSummary.totalMessages) * 100);
    messageSummary.readRate = Math.round((messageSummary.read / messageSummary.totalMessages) * 100);
    messageSummary.failureRate =
      Math.round(((messageSummary.failed + messageSummary.noAccount) / messageSummary.totalMessages) * 100);
  }

  const recentCampaigns = await db
    .select()
    .from(campaignsTable)
    .orderBy(desc(campaignsTable.createdAt))
    .limit(5);

  const recentFailures = await db
    .select({
      id: messagesTable.id,
      campaignId: messagesTable.campaignId,
      campaignName: campaignsTable.name,
      contactId: messagesTable.contactId,
      contactName: contactsTable.name,
      contactPhone: contactsTable.phone,
      externalMessageId: messagesTable.externalMessageId,
      provider: messagesTable.provider,
      lastStatus: messagesTable.lastStatus,
      errorMessage: messagesTable.errorMessage,
      retryCount: messagesTable.retryCount,
      createdAt: messagesTable.createdAt,
      updatedAt: messagesTable.updatedAt,
    })
    .from(messagesTable)
    .leftJoin(campaignsTable, eq(campaignsTable.id, messagesTable.campaignId))
    .leftJoin(contactsTable, eq(contactsTable.id, messagesTable.contactId))
    .where(or(eq(messagesTable.lastStatus, "failed"), eq(messagesTable.lastStatus, "noAccount")))
    .orderBy(desc(messagesTable.updatedAt))
    .limit(5);

  return res.json({
    totalCampaigns: Number(totalCampaigns),
    activeCampaigns: Number(activeCampaigns),
    totalContacts: Number(totalContacts),
    totalMessages: Number(totalMessages),
    messageSummary,
    recentCampaigns,
    recentFailures: recentFailures.map((m) => ({
      ...m,
      contactName: m.contactName ?? "",
      contactPhone: m.contactPhone ?? "",
      campaignName: m.campaignName ?? "",
    })),
  });
});

export default router;
