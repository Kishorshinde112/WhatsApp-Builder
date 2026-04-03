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
import { campaignsTable } from "./campaigns";

export const messagesTable = pgTable("messages", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull().references(() => campaignsTable.id, { onDelete: "cascade" }),
  contactId: integer("contact_id").notNull(),
  externalMessageId: text("external_message_id"),
  provider: text("provider").notNull().default("mock"),
  requestPayload: jsonb("request_payload").notNull().default({}),
  responsePayload: jsonb("response_payload").notNull().default({}),
  lastStatus: text("last_status").notNull().default("queued"),
  errorMessage: text("error_message"),
  retryCount: integer("retry_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const messageEventsTable = pgTable("message_events", {
  id: serial("id").primaryKey(),
  messageId: integer("message_id").notNull().references(() => messagesTable.id, { onDelete: "cascade" }),
  status: text("status").notNull(),
  eventPayload: jsonb("event_payload").notNull().default({}),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertMessageSchema = createInsertSchema(messagesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messagesTable.$inferSelect;

export const insertMessageEventSchema = createInsertSchema(messageEventsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertMessageEvent = z.infer<typeof insertMessageEventSchema>;
export type MessageEvent = typeof messageEventsTable.$inferSelect;
