import {
  pgTable,
  text,
  serial,
  integer,
  timestamp,
  numeric,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const cartItemsTable = pgTable("cart_items", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  userId: integer("user_id"),
  productId: integer("product_id").notNull(),
  quantity: integer("quantity").notNull().default(1),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const cartCouponsTable = pgTable("cart_coupons", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  couponCode: text("coupon_code").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("cart_coupons_session_coupon_key").on(t.sessionId, t.couponCode)]);

export const cartLoyaltyTable = pgTable("cart_loyalty", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull().unique(),
  userId: integer("user_id").notNull(),
  pointsToUse: integer("points_to_use").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCartItemSchema = createInsertSchema(cartItemsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCartItem = z.infer<typeof insertCartItemSchema>;
export type CartItem = typeof cartItemsTable.$inferSelect;
