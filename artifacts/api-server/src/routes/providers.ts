import { Router } from "express";
import { db } from "@workspace/db";
import {
  providerConfigsTable,
  messagesTable,
  messageEventsTable,
  campaignContactsTable,
  campaignsTable,
} from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { mockProvider } from "../services/provider/index.js";

const router = Router();

router.get("/providers", async (_req, res) => {
  const providers = await db.select({
    id: providerConfigsTable.id,
    providerName: providerConfigsTable.providerName,
    baseUrl: providerConfigsTable.baseUrl,
    instanceId: providerConfigsTable.instanceId,
    isActive: providerConfigsTable.isActive,
    createdAt: providerConfigsTable.createdAt,
    updatedAt: providerConfigsTable.updatedAt,
  }).from(providerConfigsTable);
  return res.json(providers);
});

router.get("/providers/config", async (req, res) => {
  const { providerName } = req.query as Record<string, string>;

  if (providerName) {
    const [config] = await db
      .select({
        id: providerConfigsTable.id,
        providerName: providerConfigsTable.providerName,
        baseUrl: providerConfigsTable.baseUrl,
        instanceId: providerConfigsTable.instanceId,
        isActive: providerConfigsTable.isActive,
        createdAt: providerConfigsTable.createdAt,
        updatedAt: providerConfigsTable.updatedAt,
      })
      .from(providerConfigsTable)
      .where(eq(providerConfigsTable.providerName, providerName));

    if (!config) return res.status(404).json({ error: "Provider config not found" });
    return res.json(config);
  }

  const [active] = await db
    .select({
      id: providerConfigsTable.id,
      providerName: providerConfigsTable.providerName,
      baseUrl: providerConfigsTable.baseUrl,
      instanceId: providerConfigsTable.instanceId,
      isActive: providerConfigsTable.isActive,
      createdAt: providerConfigsTable.createdAt,
      updatedAt: providerConfigsTable.updatedAt,
    })
    .from(providerConfigsTable)
    .where(eq(providerConfigsTable.isActive, "true"));

  if (!active) return res.status(404).json({ error: "No active provider configured" });
  return res.json(active);
});

router.post("/providers/config", async (req, res) => {
  const { providerName, baseUrl, instanceId, apiToken, webhookSecret, isActive } = req.body;
  if (!providerName) return res.status(400).json({ error: "providerName is required" });

  const existing = await db
    .select()
    .from(providerConfigsTable)
    .where(eq(providerConfigsTable.providerName, providerName));

  let result;
  if (existing.length > 0) {
    const [updated] = await db
      .update(providerConfigsTable)
      .set({
        baseUrl: baseUrl ?? null,
        instanceId: instanceId ?? null,
        apiToken: apiToken ?? null,
        webhookSecret: webhookSecret ?? null,
        isActive: isActive ?? "false",
        updatedAt: new Date(),
      })
      .where(eq(providerConfigsTable.providerName, providerName))
      .returning();
    result = updated;
  } else {
    const [created] = await db
      .insert(providerConfigsTable)
      .values({
        providerName,
        baseUrl: baseUrl ?? null,
        instanceId: instanceId ?? null,
        apiToken: apiToken ?? null,
        webhookSecret: webhookSecret ?? null,
        isActive: isActive ?? "false",
      })
      .returning();
    result = created;
  }

  return res.json({
    id: result.id,
    providerName: result.providerName,
    baseUrl: result.baseUrl,
    instanceId: result.instanceId,
    isActive: result.isActive,
    createdAt: result.createdAt,
    updatedAt: result.updatedAt,
  });
});

router.post("/providers/test", async (req, res) => {
  const { providerName } = req.body;
  const start = Date.now();

  if (providerName === "mock") {
    const latencyMs = Date.now() - start + Math.floor(Math.random() * 50);
    return res.json({
      success: true,
      message: "Mock provider is active and ready to send messages",
      latencyMs,
    });
  }

  return res.json({
    success: false,
    message: `Provider "${providerName}" is not configured. Only the mock provider is available in this environment.`,
    latencyMs: null,
  });
});

router.post("/webhooks/:provider", async (req, res) => {
  const { provider } = req.params;
  req.log.info({ provider, body: req.body }, "Webhook received");

  try {
    const statusEvent = await mockProvider.handleWebhook(req.body as Record<string, unknown>);

    if (!statusEvent || !statusEvent.externalMessageId) {
      return res.json({ success: true, message: "Webhook acknowledged (no actionable event)" });
    }

    const [message] = await db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.externalMessageId, statusEvent.externalMessageId));

    if (!message) {
      req.log.warn({ externalMessageId: statusEvent.externalMessageId }, "Webhook: message not found");
      return res.json({ success: true, message: "Webhook acknowledged (message not tracked)" });
    }

    await db
      .update(messagesTable)
      .set({ lastStatus: statusEvent.status, errorMessage: statusEvent.errorMessage ?? null, updatedAt: new Date() })
      .where(eq(messagesTable.id, message.id));

    await db.insert(messageEventsTable).values({
      messageId: message.id,
      status: statusEvent.status,
      description: statusEvent.errorMessage ?? `Status updated to ${statusEvent.status} via webhook`,
      eventPayload: { provider, rawPayload: req.body },
    });

    await db
      .update(campaignContactsTable)
      .set({
        status: statusEvent.status,
        ...(statusEvent.status === "sent" ? { sentAt: statusEvent.timestamp } : {}),
        ...(statusEvent.status === "delivered" ? { deliveredAt: statusEvent.timestamp } : {}),
        ...(statusEvent.status === "read" ? { readAt: statusEvent.timestamp } : {}),
        ...((statusEvent.status === "failed" || statusEvent.status === "noAccount") ? { failedAt: statusEvent.timestamp } : {}),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(campaignContactsTable.campaignId, message.campaignId),
          eq(campaignContactsTable.contactId, message.contactId)
        )
      );

    const counts = await db
      .select({ status: campaignContactsTable.status, count: sql<number>`count(*)` })
      .from(campaignContactsTable)
      .where(eq(campaignContactsTable.campaignId, message.campaignId))
      .groupBy(campaignContactsTable.status);

    const counter = { queuedCount: 0, sentCount: 0, deliveredCount: 0, readCount: 0, failedCount: 0, noAccountCount: 0 };
    for (const row of counts) {
      const c = Number(row.count);
      if (row.status === "queued") counter.queuedCount = c;
      else if (row.status === "sent") counter.sentCount = c;
      else if (row.status === "delivered") counter.deliveredCount = c;
      else if (row.status === "read") counter.readCount = c;
      else if (row.status === "failed") counter.failedCount = c;
      else if (row.status === "noAccount") counter.noAccountCount = c;
    }

    await db.update(campaignsTable).set({ ...counter, updatedAt: new Date() }).where(eq(campaignsTable.id, message.campaignId));

    req.log.info({ messageId: message.id, status: statusEvent.status }, "Webhook: message status updated");
    return res.json({ success: true, message: "Status updated", messageId: message.id, status: statusEvent.status });
  } catch (err) {
    logger.error({ err }, "Webhook processing error");
    return res.json({ success: true, message: "Webhook acknowledged (processing error)" });
  }
});

export default router;
