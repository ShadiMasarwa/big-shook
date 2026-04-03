import {
  pgTable,
  text,
  serial,
  integer,
  timestamp,
  numeric,
  boolean,
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

// Per-tier config: spending threshold + exchange rate
export const loyaltyTiersTable = pgTable("loyalty_tiers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),           // bronze | silver | gold | vip
  nameHe: text("name_he").notNull(),
  minSpent: numeric("min_spent", { precision: 10, scale: 2 }).notNull().default("0"),
  shekelPerPoint: numeric("shekel_per_point", { precision: 8, scale: 4 }).notNull().default("0.01"),
  color: text("color").notNull().default("#cd7f32"),
  icon: text("icon").notNull().default("Award"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const insertLoyaltyTransactionSchema = createInsertSchema(loyaltyTransactionsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertLoyaltyTransaction = z.infer<typeof insertLoyaltyTransactionSchema>;
export type LoyaltyTransaction = typeof loyaltyTransactionsTable.$inferSelect;
