import { pgTable, serial, text, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";

export type PrivilegeLevel = "read_only" | "read_write" | "all";

export type PrivilegeSection =
  | "products" | "categories" | "brands" | "orders" | "customers"
  | "coupons" | "suppliers" | "inventory" | "media" | "analytics"
  | "settings" | "ads" | "loyalty" | "import";

export type ManagerPrivileges = Record<PrivilegeSection, PrivilegeLevel>;

export const DEFAULT_MANAGER_PRIVILEGES: ManagerPrivileges = {
  products: "all",
  categories: "all",
  brands: "all",
  orders: "all",
  customers: "all",
  coupons: "all",
  suppliers: "all",
  inventory: "all",
  media: "all",
  analytics: "all",
  settings: "all",
  ads: "all",
  loyalty: "all",
  import: "all",
};

export const managersTable = pgTable("managers", {
  id: serial("id").primaryKey(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"),
  isActive: boolean("is_active").notNull().default(true),
  privileges: jsonb("privileges").$type<ManagerPrivileges>().notNull().$defaultFn(() => ({ ...DEFAULT_MANAGER_PRIVILEGES })),
  setupToken: text("setup_token"),
  setupTokenExpiry: timestamp("setup_token_expiry"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
