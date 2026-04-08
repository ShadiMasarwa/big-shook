import {
  pgTable,
  text,
  serial,
  integer,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const productReviewsTable = pgTable(
  "product_reviews",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull(),
    productId: integer("product_id").notNull(),
    orderId: integer("order_id").notNull(),
    orderItemId: integer("order_item_id").notNull(),
    rating: integer("rating").notNull(),
    comment: text("comment"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [unique("uq_review_user_order_item").on(t.userId, t.orderItemId)],
);

export const insertProductReviewSchema = createInsertSchema(productReviewsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertProductReview = z.infer<typeof insertProductReviewSchema>;
export type ProductReview = typeof productReviewsTable.$inferSelect;
