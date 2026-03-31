import {
  pgTable,
  text,
  serial,
  integer,
  timestamp,
  numeric,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const loyaltyTransactionsTable = pgTable("loyalty_transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  points: integer("points").notNull(),
  type: text("type", { enum: ["earned", "redeemed", "adjusted", "expired"] }).notNull(),
  reason: text("reason").notNull(),
  orderId: integer("order_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const loyaltyRulesTable = pgTable("loyalty_rules", {
  id: serial("id").primaryKey(),
  pointsPerShekel: numeric("points_per_shekel", { precision: 5, scale: 2 }).notNull().default("1"),
  shekelPerPoint: numeric("shekel_per_point", { precision: 8, scale: 4 }).notNull().default("0.01"),
  minRedemptionPoints: integer("min_redemption_points").notNull().default(100),
  maxRedemptionPercent: numeric("max_redemption_percent", { precision: 5, scale: 2 }).notNull().default("20"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertLoyaltyTransactionSchema = createInsertSchema(loyaltyTransactionsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertLoyaltyTransaction = z.infer<typeof insertLoyaltyTransactionSchema>;
export type LoyaltyTransaction = typeof loyaltyTransactionsTable.$inferSelect;
