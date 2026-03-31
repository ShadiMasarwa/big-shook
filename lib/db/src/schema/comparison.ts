import {
  pgTable,
  text,
  serial,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const comparisonTable = pgTable("comparison", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  userId: integer("user_id"),
  productId: integer("product_id").notNull(),
  addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertComparisonSchema = createInsertSchema(comparisonTable).omit({
  id: true,
  addedAt: true,
});
export type InsertComparison = z.infer<typeof insertComparisonSchema>;
export type ComparisonEntry = typeof comparisonTable.$inferSelect;
