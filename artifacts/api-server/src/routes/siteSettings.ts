import { Router, type IRouter, type Request, type Response } from "express";
import { db, siteSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireManagerPrivilegeCheck } from "../lib/managerAuth.js";
import sanitizeHtml from "sanitize-html";

const RICH_TEXT_KEYS = new Set([
  "page_takanon", "page_delivery", "page_privacy",
  "page_accessibility", "page_cancellation", "page_loyalty",
]);

const RICH_TEXT_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p", "br", "b", "i", "u", "s", "strong", "em",
    "h1", "h2", "h3", "h4", "h5", "h6",
    "ul", "ol", "li",
    "blockquote", "pre", "code",
    "a", "img",
    "table", "thead", "tbody", "tr", "th", "td",
    "figure", "figcaption", "hr", "span",
  ],
  allowedAttributes: {
    "*": ["dir", "lang", "class"],
    a: ["href", "rel"],
    img: ["src", "alt", "width", "height"],
    td: ["colspan", "rowspan"],
    th: ["colspan", "rowspan"],
  },
  allowedSchemes: ["https"],
  allowedSchemesByTag: { img: ["https", "data"] },
  disallowedTagsMode: "discard",
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer" }),
  },
};

const PRIV_DENIED = "אין לך הרשאה לבצע פעולה זו";

const router: IRouter = Router();

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
  const { allowed } = await requireManagerPrivilegeCheck(req, "settings", "write");
  if (!allowed) { res.status(403).json({ error: PRIV_DENIED }); return; }
  const { value } = req.body;
  if (typeof value !== "string") {
    res.status(400).json({ error: "ערך לא תקין" });
    return;
  }

  const safeValue = RICH_TEXT_KEYS.has(key)
    ? sanitizeHtml(value, RICH_TEXT_OPTIONS)
    : sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} });

  const [existing] = await db.select().from(siteSettingsTable).where(eq(siteSettingsTable.key, key));
  if (existing) {
    const [updated] = await db
      .update(siteSettingsTable)
      .set({ value: safeValue, updatedAt: new Date() })
      .where(eq(siteSettingsTable.key, key))
      .returning();
    res.json(updated);
  } else {
    const [created] = await db
      .insert(siteSettingsTable)
      .values({ key, value: safeValue })
      .returning();
    res.json(created);
  }
});

export default router;
