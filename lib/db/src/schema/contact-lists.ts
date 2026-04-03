import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { contactsTable } from "./contacts";

export const contactListsTable = pgTable("contact_lists", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  contactCount: integer("contact_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const contactListMembersTable = pgTable("contact_list_members", {
  id: serial("id").primaryKey(),
  listId: integer("list_id").notNull().references(() => contactListsTable.id, { onDelete: "cascade" }),
  contactId: integer("contact_id").notNull().references(() => contactsTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertContactListSchema = createInsertSchema(contactListsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertContactList = z.infer<typeof insertContactListSchema>;
export type ContactList = typeof contactListsTable.$inferSelect;

export const insertContactListMemberSchema = createInsertSchema(contactListMembersTable).omit({
  id: true,
  createdAt: true,
});
export type InsertContactListMember = z.infer<typeof insertContactListMemberSchema>;
export type ContactListMember = typeof contactListMembersTable.$inferSelect;
