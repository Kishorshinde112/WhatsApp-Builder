import { Router } from "express";
import { db } from "@workspace/db";
import { providerConfigsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

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
  return res.json({ success: true, message: "Webhook received" });
});

export default router;
