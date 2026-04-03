import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const importsTable = pgTable("imports", {
  id: serial("id").primaryKey(),
  filename: text("filename").notNull(),
  status: text("status").notNull().default("pending"),
  totalRows: integer("total_rows").notNull().default(0),
  validRows: integer("valid_rows").notNull().default(0),
  invalidRows: integer("invalid_rows").notNull().default(0),
  duplicateRows: integer("duplicate_rows").notNull().default(0),
  importedRows: integer("imported_rows").notNull().default(0),
  columnMapping: jsonb("column_mapping").notNull().default({}),
  listId: integer("list_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const importRowsTable = pgTable("import_rows", {
  id: serial("id").primaryKey(),
  importId: integer("import_id").notNull().references(() => importsTable.id, { onDelete: "cascade" }),
  rowIndex: integer("row_index").notNull(),
  rawData: jsonb("raw_data").notNull(),
  mappedData: jsonb("mapped_data").notNull().default({}),
  status: text("status").notNull().default("pending"),
  errorMessage: text("error_message"),
  contactId: integer("contact_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertImportSchema = createInsertSchema(importsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertImport = z.infer<typeof insertImportSchema>;
export type Import = typeof importsTable.$inferSelect;

export const insertImportRowSchema = createInsertSchema(importRowsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertImportRow = z.infer<typeof insertImportRowSchema>;
export type ImportRow = typeof importRowsTable.$inferSelect;
