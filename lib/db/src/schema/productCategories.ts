import { pgTable, integer, primaryKey } from "drizzle-orm/pg-core";
import { productsTable } from "./products";
import { categoriesTable } from "./categories";

export const productCategoriesTable = pgTable(
  "product_categories",
  {
    productId: integer("product_id")
      .notNull()
      .references(() => productsTable.id, { onDelete: "cascade" }),
    categoryId: integer("category_id")
      .notNull()
      .references(() => categoriesTable.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.productId, t.categoryId] })],
);
