import { Router, type IRouter } from "express";
import { eq, desc, sql } from "drizzle-orm";
import { db, loyaltyTransactionsTable, loyaltyRulesTable } from "@workspace/db";

const router: IRouter = Router();

const LOYALTY_TIERS = [
  { id: "bronze", nameHe: "ברונזה", minPoints: 0, maxPoints: 499, multiplier: 1, benefits: ["צבירת נקודות בסיסית"], color: "#cd7f32", icon: "Award" },
  { id: "silver", nameHe: "כסף", minPoints: 500, maxPoints: 1999, multiplier: 1.5, benefits: ["1.5x נקודות על כל קנייה", "משלוח חינם מ-150₪"], color: "#c0c0c0", icon: "Star" },
  { id: "gold", nameHe: "זהב", minPoints: 2000, maxPoints: 4999, multiplier: 2, benefits: ["2x נקודות על כל קנייה", "משלוח חינם על כל הזמנה", "גישה ראשונה למבצעים"], color: "#ffd700", icon: "Crown" },
  { id: "vip", nameHe: "VIP", minPoints: 5000, maxPoints: null, multiplier: 3, benefits: ["3x נקודות על כל קנייה", "משלוח מהיר חינם", "מנהל לקוחות אישי", "הנחת VIP 10%"], color: "#9b59b6", icon: "Diamond" },
];

router.get("/loyalty/tiers", async (_req, res): Promise<void> => {
  res.json(LOYALTY_TIERS);
});

router.get("/loyalty/rules", async (_req, res): Promise<void> => {
  const [rules] = await db.select().from(loyaltyRulesTable);
  if (!rules) {
    res.json({ pointsPerShekel: 1, shekelPerPoint: 0.01, minRedemptionPoints: 100, maxRedemptionPercent: 20, tierMultipliers: {} });
    return;
  }
  res.json({
    pointsPerShekel: parseFloat(rules.pointsPerShekel),
    shekelPerPoint: parseFloat(rules.shekelPerPoint),
    minRedemptionPoints: rules.minRedemptionPoints,
    maxRedemptionPercent: parseFloat(rules.maxRedemptionPercent),
    tierMultipliers: {},
  });
});

router.put("/loyalty/rules", async (req, res): Promise<void> => {
  const { pointsPerShekel, shekelPerPoint, minRedemptionPoints, maxRedemptionPercent } = req.body;
  const [existing] = await db.select().from(loyaltyRulesTable);
  if (existing) {
    await db.update(loyaltyRulesTable).set({
      pointsPerShekel: String(pointsPerShekel),
      shekelPerPoint: String(shekelPerPoint),
      minRedemptionPoints,
      maxRedemptionPercent: String(maxRedemptionPercent),
    }).where(eq(loyaltyRulesTable.id, existing.id));
  } else {
    await db.insert(loyaltyRulesTable).values({
      pointsPerShekel: String(pointsPerShekel),
      shekelPerPoint: String(shekelPerPoint),
      minRedemptionPoints,
      maxRedemptionPercent: String(maxRedemptionPercent),
    });
  }
  res.json({ pointsPerShekel, shekelPerPoint, minRedemptionPoints, maxRedemptionPercent, tierMultipliers: {} });
});

router.get("/loyalty/history/:userId", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
  const userId = parseInt(raw, 10);
  const page = parseInt(String(req.query.page ?? "1"), 10);
  const limit = parseInt(String(req.query.limit ?? "20"), 10);
  const offset = (page - 1) * limit;
  const transactions = await db.select().from(loyaltyTransactionsTable)
    .where(eq(loyaltyTransactionsTable.userId, userId))
    .orderBy(desc(loyaltyTransactionsTable.createdAt))
    .limit(limit).offset(offset);
  res.json(transactions.map(t => ({ ...t, createdAt: t.createdAt.toISOString() })));
});

export default router;
