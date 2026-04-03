import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const campaignsTable = pgTable("campaigns", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  template: text("template").notNull(),
  status: text("status").notNull().default("draft"),
  delaySeconds: integer("delay_seconds").notNull().default(5),
  provider: text("provider").notNull().default("mock"),
  listId: integer("list_id"),
  totalContacts: integer("total_contacts").notNull().default(0),
  queuedCount: integer("queued_count").notNull().default(0),
  sentCount: integer("sent_count").notNull().default(0),
  deliveredCount: integer("delivered_count").notNull().default(0),
  readCount: integer("read_count").notNull().default(0),
  failedCount: integer("failed_count").notNull().default(0),
  noAccountCount: integer("no_account_count").notNull().default(0),
  dryRun: text("dry_run").notNull().default("false"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  startedAt: timestamp("started_at", { withTimezone: true }),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
});

export const campaignContactsTable = pgTable("campaign_contacts", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull().references(() => campaignsTable.id, { onDelete: "cascade" }),
  contactId: integer("contact_id").notNull(),
  renderedMessage: text("rendered_message").notNull().default(""),
  status: text("status").notNull().default("queued"),
  validationError: text("validation_error"),
  queuedAt: timestamp("queued_at", { withTimezone: true }),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  readAt: timestamp("read_at", { withTimezone: true }),
  failedAt: timestamp("failed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertCampaignSchema = createInsertSchema(campaignsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCampaign = z.infer<typeof insertCampaignSchema>;
export type Campaign = typeof campaignsTable.$inferSelect;

export const insertCampaignContactSchema = createInsertSchema(campaignContactsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCampaignContact = z.infer<typeof insertCampaignContactSchema>;
export type CampaignContact = typeof campaignContactsTable.$inferSelect;
