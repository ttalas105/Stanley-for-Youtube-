import { sql } from "drizzle-orm";
import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const creatorMemories = sqliteTable("creator_memories", {
  ownerId: text("owner_id").primaryKey(),
  summary: text("summary").notNull().default(""),
  factsJson: text("facts_json").notNull().default("[]"),
  version: integer("version").notNull().default(1),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const projectMemories = sqliteTable("project_memories", {
  ownerId: text("owner_id").notNull(),
  projectId: text("project_id").notNull(),
  summary: text("summary").notNull().default(""),
  factsJson: text("facts_json").notNull().default("[]"),
  version: integer("version").notNull().default(1),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [primaryKey({ columns: [table.ownerId, table.projectId] })]);
