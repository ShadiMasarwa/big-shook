import { Router, type IRouter, type Request, type Response } from "express";
import { db, siteSettingsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getManagerFromRequest, isManagerToken } from "../lib/managerAuth.js";

const router: IRouter = Router();

// Keys that require manager/admin auth. Other site-settings keys remain
// editable through the existing pattern (admin-only UI). Protect this one
// because flipping it changes public-site availability.
const PROTECTED_KEYS = new Set<string>(["maintenance_mode"]);

async function isAdminOrManager(req: Request): Promise<boolean> {
  const authHeader = req.headers.authorization;
  if (!authHeader) return false;
  const token = authHeader.replace("Bearer ", "");
  if (isManagerToken(token)) {
    const m = await getManagerFromRequest(req);
    return !!(m && m.isActive);
  }
  try {
    const decoded = Buffer.from(token, "base64").toString("utf-8");
    const userId = parseInt(decoded.split(":")[0], 10);
    if (isNaN(userId)) return false;
    const [u] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    return !!(u && u.isActive && (u.role === "admin" || u.role === "manager"));
  } catch {
    return false;
  }
}

const DEFAULT_SETTINGS: Record<string, string> = {
  topbar_left:         "שירות לקוחות: 077-1234577",
  topbar_right:        "משלוח חינם בקנייה מעל ₪299",
  midbar_center:       "",
  page_takanon:        "",
  page_delivery:       "",
  page_privacy:        "",
  page_accessibility:  "",
  page_cancellation:   "",
  page_loyalty:        "",
  maintenance_mode:    "off", // "on" | "off"
  maintenance_message: "אנו מבצעים עבודות תחזוקה קצרות. נשוב בקרוב!",
};

router.get("/site-settings", async (_req: Request, res: Response): Promise<void> => {
  const rows = await db.select().from(siteSettingsTable);
  const result: Record<string, string> = { ...DEFAULT_SETTINGS };
  for (const row of rows) {
    result[row.key] = row.value;
  }
  res.setHeader("Cache-Control", "no-store");
  res.json(result);
});

router.put("/admin/site-settings/:key", async (req: Request, res: Response): Promise<void> => {
  const { key } = req.params;
  if (!Object.prototype.hasOwnProperty.call(DEFAULT_SETTINGS, key)) {
    res.status(400).json({ error: "מפתח לא מוכר" });
    return;
  }
  if (PROTECTED_KEYS.has(key) && !(await isAdminOrManager(req))) {
    res.status(401).json({ error: "אין הרשאה" });
    return;
  }
  const { value } = req.body;
  if (typeof value !== "string") {
    res.status(400).json({ error: "ערך לא תקין" });
    return;
  }

  const [existing] = await db.select().from(siteSettingsTable).where(eq(siteSettingsTable.key, key));
  if (existing) {
    const [updated] = await db
      .update(siteSettingsTable)
      .set({ value, updatedAt: new Date() })
      .where(eq(siteSettingsTable.key, key))
      .returning();
    res.json(updated);
  } else {
    const [created] = await db
      .insert(siteSettingsTable)
      .values({ key, value })
      .returning();
    res.json(created);
  }
});

export default router;
