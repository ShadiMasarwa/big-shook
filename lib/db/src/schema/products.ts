import {
  pgTable,
  text,
  serial,
  integer,
  boolean,
  timestamp,
  numeric,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const productsTable = pgTable("products", {
  id: serial("id").primaryKey(),
  nameHe: text("name_he").notNull(),
  nameEn: text("name_en"),
  slug: text("slug").notNull().unique(),
  descriptionHe: text("description_he"),
  sku: text("sku"),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  salePrice: numeric("sale_price", { precision: 10, scale: 2 }),
  costPrice: numeric("cost_price", { precision: 10, scale: 2 }),
  deliveryCost: numeric("delivery_cost", { precision: 10, scale: 2 }),
  categoryId: integer("category_id"),
  brandId: integer("brand_id"),
  supplierId: integer("supplier_id"),
  images: text("images").array().notNull().default([]),
  videos: text("videos").array().notNull().default([]),
  tags: text("tags").array().notNull().default([]),
  specs: jsonb("specs").notNull().default({}),
  stockQuantity: integer("stock_quantity").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  isFeatured: boolean("is_featured").notNull().default(false),
  viewsCount: integer("views_count").notNull().default(0),
  salesCount: integer("sales_count").notNull().default(0),
  ratingAverage: numeric("rating_average", { precision: 3, scale: 2 }).notNull().default("0"),
  ratingCount: integer("rating_count").notNull().default(0),
  weight: numeric("weight", { precision: 8, scale: 3 }),
  metaTitle: text("meta_title"),
  metaDescription: text("meta_description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertProductSchema = createInsertSchema(productsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof productsTable.$inferSelect;
