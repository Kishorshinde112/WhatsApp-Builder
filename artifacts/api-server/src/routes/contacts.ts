import { Router } from "express";
import multer from "multer";
import Papa from "papaparse";
import { db } from "@workspace/db";
import {
  contactsTable,
  contactListsTable,
  contactListMembersTable,
  importsTable,
  importRowsTable,
} from "@workspace/db";
import { eq, ilike, or, sql, and } from "drizzle-orm";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

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

router.get("/contacts", async (req, res) => {
  const { search, page = "1", limit = "50", listId, validationStatus } = req.query as Record<string, string>;
  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(200, Math.max(1, parseInt(limit)));
  const offset = (pageNum - 1) * limitNum;

  let query = db.select().from(contactsTable);
  let countQuery = db.select({ count: sql<number>`count(*)` }).from(contactsTable);

  const conditions = [];
  if (search) {
    conditions.push(
      or(
        ilike(contactsTable.name, `%${search}%`),
        ilike(contactsTable.phone, `%${search}%`),
        ilike(contactsTable.normalizedPhone, `%${search}%`)
      )
    );
  }
  if (validationStatus) {
    conditions.push(eq(contactsTable.validationStatus, validationStatus));
  }

  if (listId) {
    const members = await db
      .select({ contactId: contactListMembersTable.contactId })
      .from(contactListMembersTable)
      .where(eq(contactListMembersTable.listId, parseInt(listId)));
    const ids = members.map((m) => m.contactId);
    if (ids.length === 0) {
      return res.json({ contacts: [], total: 0, page: pageNum, limit: limitNum });
    }
    conditions.push(sql`${contactsTable.id} = ANY(${sql`ARRAY[${sql.join(ids.map((id) => sql`${id}`), sql`, `)}]::int[]`})`);
  }

  const contacts = await db
    .select()
    .from(contactsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .limit(limitNum)
    .offset(offset)
    .orderBy(contactsTable.createdAt);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(contactsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  return res.json({ contacts, total: Number(count), page: pageNum, limit: limitNum });
});

router.post("/contacts", async (req, res) => {
  const { name, phone, email, tags, customFields } = req.body;
  if (!name || !phone) {
    return res.status(400).json({ error: "name and phone are required" });
  }
  if (!isValidPhone(phone)) {
    return res.status(400).json({ error: "Invalid phone number format" });
  }
  const normalizedPhone = normalizePhone(phone);

  const [contact] = await db
    .insert(contactsTable)
    .values({
      name,
      phone,
      normalizedPhone,
      email: email ?? null,
      tags: tags ?? [],
      customFields: customFields ?? {},
      validationStatus: "valid",
    })
    .returning();

  return res.status(201).json(contact);
});

router.get("/contacts/:id", async (req, res) => {
  const [contact] = await db
    .select()
    .from(contactsTable)
    .where(eq(contactsTable.id, parseInt(req.params.id)));

  if (!contact) return res.status(404).json({ error: "Contact not found" });
  return res.json(contact);
});

router.patch("/contacts/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const [existing] = await db.select().from(contactsTable).where(eq(contactsTable.id, id));
  if (!existing) return res.status(404).json({ error: "Contact not found" });

  const updates: Partial<typeof existing> = {};
  if (req.body.name != null) updates.name = req.body.name;
  if (req.body.phone != null) {
    updates.phone = req.body.phone;
    updates.normalizedPhone = normalizePhone(req.body.phone);
    updates.validationStatus = isValidPhone(req.body.phone) ? "valid" : "invalid";
  }
  if (req.body.email != null) updates.email = req.body.email;
  if (req.body.tags != null) updates.tags = req.body.tags;
  if (req.body.customFields != null) updates.customFields = req.body.customFields;
  if (req.body.validationStatus != null) updates.validationStatus = req.body.validationStatus;

  const [updated] = await db
    .update(contactsTable)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(contactsTable.id, id))
    .returning();

  return res.json(updated);
});

router.delete("/contacts/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const [existing] = await db.select().from(contactsTable).where(eq(contactsTable.id, id));
  if (!existing) return res.status(404).json({ error: "Contact not found" });

  await db.delete(contactsTable).where(eq(contactsTable.id, id));
  return res.json({ success: true, message: "Contact deleted" });
});

router.post("/contacts/import/preview", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const csv = req.file.buffer.toString("utf-8");
  const result = Papa.parse(csv, { header: true, skipEmptyLines: true });

  const rows = result.data.slice(0, 10) as Record<string, unknown>[];
  const headers = result.meta.fields ?? [];

  return res.json({
    headers,
    rows,
    totalRows: (result.data as unknown[]).length,
    filename: req.file.originalname,
  });
});

router.post("/contacts/import", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const csv = req.file.buffer.toString("utf-8");
  const parsed = Papa.parse(csv, { header: true, skipEmptyLines: true });
  const rows = parsed.data as Record<string, string>[];

  let columnMapping: Record<string, string> = {};
  try {
    columnMapping = JSON.parse(req.body.columnMapping ?? "{}");
  } catch {
    columnMapping = {};
  }

  const listId = req.body.listId ? parseInt(req.body.listId) : null;
  const skipDuplicates = req.body.skipDuplicates !== "false";

  const [importRecord] = await db
    .insert(importsTable)
    .values({
      filename: req.file.originalname,
      status: "processing",
      totalRows: rows.length,
      columnMapping: columnMapping as Record<string, unknown>,
      listId,
    })
    .returning();

  let importedRows = 0;
  let duplicateRows = 0;
  let invalidRows = 0;
  const errors: Record<string, unknown>[] = [];

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i];
    const mapped: Record<string, string> = {};

    for (const [csvCol, field] of Object.entries(columnMapping)) {
      mapped[field] = raw[csvCol] ?? "";
    }

    const phone = mapped.phone ?? raw.phone ?? raw.Phone ?? raw.telefone ?? raw.numero ?? "";
    const name = mapped.name ?? raw.name ?? raw.Name ?? raw.nome ?? "";

    if (!phone || !name) {
      invalidRows++;
      await db.insert(importRowsTable).values({
        importId: importRecord.id,
        rowIndex: i,
        rawData: raw as Record<string, unknown>,
        mappedData: mapped as Record<string, unknown>,
        status: "invalid",
        errorMessage: "Missing required fields: name or phone",
      });
      errors.push({ row: i + 1, error: "Missing required fields" });
      continue;
    }

    if (!isValidPhone(phone)) {
      invalidRows++;
      await db.insert(importRowsTable).values({
        importId: importRecord.id,
        rowIndex: i,
        rawData: raw as Record<string, unknown>,
        mappedData: mapped as Record<string, unknown>,
        status: "invalid",
        errorMessage: `Invalid phone number: ${phone}`,
      });
      errors.push({ row: i + 1, error: `Invalid phone: ${phone}` });
      continue;
    }

    const normalizedPhone = normalizePhone(phone);
    const existing = await db
      .select({ id: contactsTable.id })
      .from(contactsTable)
      .where(eq(contactsTable.normalizedPhone, normalizedPhone));

    if (existing.length > 0 && skipDuplicates) {
      duplicateRows++;
      await db.insert(importRowsTable).values({
        importId: importRecord.id,
        rowIndex: i,
        rawData: raw as Record<string, unknown>,
        mappedData: mapped as Record<string, unknown>,
        status: "duplicate",
        errorMessage: "Duplicate phone number",
      });
      continue;
    }

    const [contact] = await db
      .insert(contactsTable)
      .values({
        name,
        phone,
        normalizedPhone,
        email: mapped.email ?? raw.email ?? null,
        tags: [],
        customFields: {},
        validationStatus: "valid",
      })
      .returning();

    await db.insert(importRowsTable).values({
      importId: importRecord.id,
      rowIndex: i,
      rawData: raw as Record<string, unknown>,
      mappedData: mapped as Record<string, unknown>,
      status: "imported",
      contactId: contact.id,
    });

    if (listId) {
      await db.insert(contactListMembersTable).values({ listId, contactId: contact.id }).onConflictDoNothing();
    }

    importedRows++;
  }

  await db
    .update(importsTable)
    .set({
      status: "completed",
      totalRows: rows.length,
      validRows: importedRows,
      invalidRows,
      duplicateRows,
      importedRows,
      updatedAt: new Date(),
    })
    .where(eq(importsTable.id, importRecord.id));

  if (listId) {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(contactListMembersTable)
      .where(eq(contactListMembersTable.listId, listId));
    await db
      .update(contactListsTable)
      .set({ contactCount: Number(count), updatedAt: new Date() })
      .where(eq(contactListsTable.id, listId));
  }

  return res.json({
    importId: importRecord.id,
    totalRows: rows.length,
    importedRows,
    duplicateRows,
    invalidRows,
    errors: errors.slice(0, 20),
  });
});

router.get("/contact-lists", async (_req, res) => {
  const lists = await db.select().from(contactListsTable).orderBy(contactListsTable.createdAt);
  return res.json(lists);
});

router.post("/contact-lists", async (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: "name is required" });

  const [list] = await db
    .insert(contactListsTable)
    .values({ name, description: description ?? null })
    .returning();

  return res.status(201).json(list);
});

router.get("/contact-lists/:id", async (req, res) => {
  const [list] = await db
    .select()
    .from(contactListsTable)
    .where(eq(contactListsTable.id, parseInt(req.params.id)));

  if (!list) return res.status(404).json({ error: "Contact list not found" });
  return res.json(list);
});

router.delete("/contact-lists/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const [existing] = await db.select().from(contactListsTable).where(eq(contactListsTable.id, id));
  if (!existing) return res.status(404).json({ error: "Contact list not found" });

  await db.delete(contactListsTable).where(eq(contactListsTable.id, id));
  return res.json({ success: true, message: "Contact list deleted" });
});

export default router;
