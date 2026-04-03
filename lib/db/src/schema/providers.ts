import {
  pgTable,
  text,
  serial,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const providerConfigsTable = pgTable("provider_configs", {
  id: serial("id").primaryKey(),
  providerName: text("provider_name").notNull(),
  baseUrl: text("base_url"),
  instanceId: text("instance_id"),
  apiToken: text("api_token"),
  webhookSecret: text("webhook_secret"),
  isActive: text("is_active").notNull().default("false"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertProviderConfigSchema = createInsertSchema(providerConfigsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertProviderConfig = z.infer<typeof insertProviderConfigSchema>;
export type ProviderConfig = typeof providerConfigsTable.$inferSelect;
