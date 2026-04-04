import {
  pgTable,
  text,
  serial,
  integer,
  boolean,
  timestamp,
  numeric,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  phone: text("phone"),
  city: text("city"),
  street: text("street"),
  houseNumber: text("house_number"),
  zipCode: text("zip_code"),
  addressNote: text("address_note"),
  role: text("role", { enum: ["customer", "admin"] }).notNull().default("customer"),
  loyaltyPoints: integer("loyalty_points").notNull().default(0),
  loyaltyTier: text("loyalty_tier", { enum: ["bronze", "silver", "gold", "vip"] }).notNull().default("bronze"),
  totalSpent: numeric("total_spent", { precision: 12, scale: 2 }).notNull().default("0"),
  ordersCount: integer("orders_count").notNull().default(0),
  marketingEmails: boolean("marketing_emails").notNull().default(true),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
