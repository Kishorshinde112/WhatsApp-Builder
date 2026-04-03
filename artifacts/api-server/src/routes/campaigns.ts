import { Router } from "express";
import { db } from "@workspace/db";
import {
  campaignsTable,
  campaignContactsTable,
  contactsTable,
  contactListMembersTable,
  contactListsTable,
} from "@workspace/db";
import { eq, and, sql, inArray } from "drizzle-orm";
import {
  startCampaignRunner,
  pauseRunner,
  resumeRunner,
  cancelRunner,
} from "../services/campaign-runner.js";

const router = Router();

function extractTemplateVars(template: string): string[] {
  const matches = template.matchAll(/\{\{(\w+)\}\}/g);
  return [...new Set([...matches].map((m) => m[1]))];
}

function renderTemplate(template: string, contact: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    return contact[key] ?? `{{${key}}}`;
  });
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) return "+55" + digits.slice(1);
  if (!digits.startsWith("55") && digits.length <= 11) return "+55" + digits;
  return "+" + digits;
}

function isValidPhone(phone: string): boolean {
  const normalized = normalizePhone(phone);
  return /^\+\d{8,15}$/.test(normalized);
}

router.get("/campaigns", async (req, res) => {
  const { status, page = "1", limit = "20" } = req.query as Record<string, string>;
  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
  const offset = (pageNum - 1) * limitNum;

  const conditions = status ? [eq(campaignsTable.status, status)] : [];

  const campaigns = await db
    .select()
    .from(campaignsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .limit(limitNum)
    .offset(offset)
    .orderBy(campaignsTable.createdAt);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(campaignsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  return res.json({ campaigns, total: Number(count), page: pageNum, limit: limitNum });
});

router.post("/campaigns", async (req, res) => {
  const { name, template, delaySeconds, provider, listId, dryRun } = req.body;
  if (!name || !template) {
    return res.status(400).json({ error: "name and template are required" });
  }

  const [campaign] = await db
    .insert(campaignsTable)
    .values({
      name,
      template,
      delaySeconds: delaySeconds ?? 5,
      provider: provider ?? "mock",
      listId: listId ?? null,
      dryRun: dryRun ?? "false",
      status: "draft",
    })
    .returning();

  return res.status(201).json(campaign);
});

router.get("/campaigns/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const [campaign] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, id));
  if (!campaign) return res.status(404).json({ error: "Campaign not found" });

  let listName: string | null = null;
  if (campaign.listId) {
    const [list] = await db
      .select({ name: contactListsTable.name })
      .from(contactListsTable)
      .where(eq(contactListsTable.id, campaign.listId));
    listName = list?.name ?? null;
  }

  return res.json({ ...campaign, listName });
});

router.patch("/campaigns/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const [existing] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, id));
  if (!existing) return res.status(404).json({ error: "Campaign not found" });

  if (!["draft"].includes(existing.status)) {
    return res.status(400).json({ error: "Can only edit campaigns in draft status" });
  }

  const updates: Partial<typeof existing> = {};
  if (req.body.name != null) updates.name = req.body.name;
  if (req.body.template != null) updates.template = req.body.template;
  if (req.body.delaySeconds != null) updates.delaySeconds = req.body.delaySeconds;
  if (req.body.provider != null) updates.provider = req.body.provider;
  if (req.body.listId != null) updates.listId = req.body.listId;
  if (req.body.dryRun != null) updates.dryRun = req.body.dryRun;

  const [updated] = await db
    .update(campaignsTable)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(campaignsTable.id, id))
    .returning();

  return res.json(updated);
});

router.post("/campaigns/:id/validate", async (req, res) => {
  const id = parseInt(req.params.id);
  const [campaign] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, id));
  if (!campaign) return res.status(404).json({ error: "Campaign not found" });

  const errors: string[] = [];
  const warnings: string[] = [];

  if (!campaign.template || !campaign.template.trim()) {
    errors.push("Campaign template is empty");
  }

  if (!campaign.listId) {
    errors.push("No contact list assigned to campaign");
    return res.json({
      valid: false,
      totalContacts: 0,
      invalidPhones: 0,
      duplicateContacts: 0,
      missingVariables: [],
      emptyTemplateVars: [],
      estimatedDurationSeconds: 0,
      errors,
      warnings,
    });
  }

  const members = await db
    .select({ contactId: contactListMembersTable.contactId })
    .from(contactListMembersTable)
    .where(eq(contactListMembersTable.listId, campaign.listId));

  if (members.length === 0) {
    errors.push("Contact list is empty");
    return res.json({
      valid: false,
      totalContacts: 0,
      invalidPhones: 0,
      duplicateContacts: 0,
      missingVariables: [],
      emptyTemplateVars: [],
      estimatedDurationSeconds: 0,
      errors,
      warnings,
    });
  }

  const contactIds = members.map((m) => m.contactId);
  const contacts = await db
    .select()
    .from(contactsTable)
    .where(inArray(contactsTable.id, contactIds));

  const templateVars = extractTemplateVars(campaign.template);
  let invalidPhones = 0;
  const emptyTemplateVars: string[] = [];
  const phonesSeen = new Set<string>();
  let duplicateContacts = 0;

  for (const contact of contacts) {
    if (!isValidPhone(contact.phone)) {
      invalidPhones++;
    }

    if (phonesSeen.has(contact.normalizedPhone)) {
      duplicateContacts++;
    }
    phonesSeen.add(contact.normalizedPhone);

    for (const v of templateVars) {
      const val = (contact as Record<string, unknown>)[v] as string | undefined;
      if (v !== "name" && v !== "phone" && !val) {
        if (!emptyTemplateVars.includes(v)) emptyTemplateVars.push(v);
      }
    }
  }

  if (invalidPhones > 0) {
    warnings.push(`${invalidPhones} contacts have invalid phone numbers and will be skipped`);
  }

  if (duplicateContacts > 0) {
    warnings.push(`${duplicateContacts} duplicate phone numbers detected`);
  }

  const estimatedDurationSeconds = contacts.length * campaign.delaySeconds;

  return res.json({
    valid: errors.length === 0,
    totalContacts: contacts.length,
    invalidPhones,
    duplicateContacts,
    missingVariables: [],
    emptyTemplateVars,
    estimatedDurationSeconds,
    errors,
    warnings,
  });
});

router.post("/campaigns/:id/launch", async (req, res) => {
  const id = parseInt(req.params.id);
  const [campaign] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, id));
  if (!campaign) return res.status(404).json({ error: "Campaign not found" });

  if (!["draft", "ready"].includes(campaign.status)) {
    return res.status(400).json({ error: `Cannot launch campaign in ${campaign.status} status` });
  }

  if (!campaign.listId) {
    return res.status(400).json({ error: "Campaign has no contact list assigned" });
  }

  const members = await db
    .select({ contactId: contactListMembersTable.contactId })
    .from(contactListMembersTable)
    .where(eq(contactListMembersTable.listId, campaign.listId));

  if (members.length === 0) {
    return res.status(400).json({ error: "Contact list is empty" });
  }

  const contacts = await db
    .select()
    .from(contactsTable)
    .where(inArray(contactsTable.id, members.map((m) => m.contactId)));

  await db.delete(campaignContactsTable).where(eq(campaignContactsTable.campaignId, id));

  for (const contact of contacts) {
    const rendered = renderTemplate(campaign.template, {
      name: contact.name,
      phone: contact.phone,
      ...((contact.customFields as Record<string, string>) ?? {}),
    });

    await db.insert(campaignContactsTable).values({
      campaignId: id,
      contactId: contact.id,
      renderedMessage: rendered,
      status: "queued",
      queuedAt: new Date(),
    });
  }

  await db
    .update(campaignsTable)
    .set({
      status: "running",
      totalContacts: contacts.length,
      queuedCount: contacts.length,
      sentCount: 0,
      deliveredCount: 0,
      readCount: 0,
      failedCount: 0,
      noAccountCount: 0,
      updatedAt: new Date(),
    })
    .where(eq(campaignsTable.id, id));

  const [updated] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, id));

  setImmediate(() => {
    startCampaignRunner(id).catch((err) => {
      console.error("Campaign runner error:", err);
    });
  });

  return res.json(updated);
});

router.post("/campaigns/:id/pause", async (req, res) => {
  const id = parseInt(req.params.id);
  const [campaign] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, id));
  if (!campaign) return res.status(404).json({ error: "Campaign not found" });

  if (campaign.status !== "running") {
    return res.status(400).json({ error: "Campaign is not running" });
  }

  pauseRunner(id);

  const [updated] = await db
    .update(campaignsTable)
    .set({ status: "paused", updatedAt: new Date() })
    .where(eq(campaignsTable.id, id))
    .returning();

  return res.json(updated);
});

router.post("/campaigns/:id/resume", async (req, res) => {
  const id = parseInt(req.params.id);
  const [campaign] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, id));
  if (!campaign) return res.status(404).json({ error: "Campaign not found" });

  if (campaign.status !== "paused") {
    return res.status(400).json({ error: "Campaign is not paused" });
  }

  resumeRunner(id);

  const [updated] = await db
    .update(campaignsTable)
    .set({ status: "running", updatedAt: new Date() })
    .where(eq(campaignsTable.id, id))
    .returning();

  return res.json(updated);
});

router.post("/campaigns/:id/cancel", async (req, res) => {
  const id = parseInt(req.params.id);
  const [campaign] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, id));
  if (!campaign) return res.status(404).json({ error: "Campaign not found" });

  if (!["running", "paused"].includes(campaign.status)) {
    return res.status(400).json({ error: "Campaign cannot be cancelled in its current state" });
  }

  cancelRunner(id);

  const [updated] = await db
    .update(campaignsTable)
    .set({ status: "cancelled", finishedAt: new Date(), updatedAt: new Date() })
    .where(eq(campaignsTable.id, id))
    .returning();

  return res.json(updated);
});

router.get("/campaigns/:id/report", async (req, res) => {
  const id = parseInt(req.params.id);
  const { status, page = "1", limit = "50" } = req.query as Record<string, string>;
  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(200, Math.max(1, parseInt(limit)));
  const offset = (pageNum - 1) * limitNum;

  const [campaign] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, id));
  if (!campaign) return res.status(404).json({ error: "Campaign not found" });

  let listName: string | null = null;
  if (campaign.listId) {
    const [list] = await db
      .select({ name: contactListsTable.name })
      .from(contactListsTable)
      .where(eq(contactListsTable.id, campaign.listId));
    listName = list?.name ?? null;
  }

  const conditions = [eq(campaignContactsTable.campaignId, id)];
  if (status) {
    conditions.push(eq(campaignContactsTable.status, status));
  }

  const rows = await db
    .select({
      id: campaignContactsTable.id,
      contactId: campaignContactsTable.contactId,
      contactName: contactsTable.name,
      contactPhone: contactsTable.phone,
      renderedMessage: campaignContactsTable.renderedMessage,
      status: campaignContactsTable.status,
      validationError: campaignContactsTable.validationError,
      queuedAt: campaignContactsTable.queuedAt,
      sentAt: campaignContactsTable.sentAt,
      deliveredAt: campaignContactsTable.deliveredAt,
      readAt: campaignContactsTable.readAt,
      failedAt: campaignContactsTable.failedAt,
    })
    .from(campaignContactsTable)
    .leftJoin(contactsTable, eq(contactsTable.id, campaignContactsTable.contactId))
    .where(and(...conditions))
    .limit(limitNum)
    .offset(offset)
    .orderBy(campaignContactsTable.id);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(campaignContactsTable)
    .where(and(...conditions));

  return res.json({
    campaign: { ...campaign, listName },
    contacts: rows.map((r) => ({ ...r, contactName: r.contactName ?? "", contactPhone: r.contactPhone ?? "" })),
    total: Number(count),
    page: pageNum,
    limit: limitNum,
  });
});

export default router;
