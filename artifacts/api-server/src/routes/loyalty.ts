import { Router, type IRouter } from "express";
import { eq, desc, asc } from "drizzle-orm";
import { db, loyaltyTransactionsTable, loyaltyRulesTable, loyaltyTiersTable } from "@workspace/db";

const router: IRouter = Router();

const DEFAULT_TIERS = [
  { name: "bronze", nameHe: "ברונזה", minSpent: "0",    shekelPerPoint: "0.0100", color: "#cd7f32", icon: "Award",   sortOrder: 0 },
  { name: "silver", nameHe: "כסף",    minSpent: "500",  shekelPerPoint: "0.0120", color: "#c0c0c0", icon: "Star",    sortOrder: 1 },
  { name: "gold",   nameHe: "זהב",    minSpent: "2000", shekelPerPoint: "0.0150", color: "#ffd700", icon: "Crown",   sortOrder: 2 },
  { name: "vip",    nameHe: "VIP",    minSpent: "5000", shekelPerPoint: "0.0200", color: "#9b59b6", icon: "Diamond", sortOrder: 3 },
];

async function seedTiersIfEmpty() {
  const existing = await db.select().from(loyaltyTiersTable);
  if (existing.length === 0) {
    await db.insert(loyaltyTiersTable).values(DEFAULT_TIERS);
    return await db.select().from(loyaltyTiersTable).orderBy(asc(loyaltyTiersTable.sortOrder));
  }
  return existing.sort((a, b) => a.sortOrder - b.sortOrder);
}

// Exported helper: get tier name for a given total_spent value
export async function getTierBySpent(totalSpent: number): Promise<"bronze" | "silver" | "gold" | "vip"> {
  const tiers = await seedTiersIfEmpty();
  const sorted = [...tiers].sort((a, b) => parseFloat(b.minSpent) - parseFloat(a.minSpent));
  for (const tier of sorted) {
    if (totalSpent >= parseFloat(tier.minSpent)) {
      return tier.name as "bronze" | "silver" | "gold" | "vip";
    }
  }
  return "bronze";
}

// Exported helper: get shekelPerPoint for a given tier name
export async function getShekelPerPointForTier(tierName: string): Promise<number> {
  const tiers = await seedTiersIfEmpty();
  const tier = tiers.find(t => t.name === tierName);
  return tier ? parseFloat(tier.shekelPerPoint) : 0.01;
}

router.get("/loyalty/tiers", async (_req, res): Promise<void> => {
  const tiers = await seedTiersIfEmpty();
  res.json(tiers.map(t => ({
    ...t,
    minSpent: parseFloat(t.minSpent),
    shekelPerPoint: parseFloat(t.shekelPerPoint),
  })));
});

router.put("/loyalty/tiers/:name", async (req, res): Promise<void> => {
  const { name } = req.params;
  const { nameHe, minSpent, shekelPerPoint, color } = req.body;
  await seedTiersIfEmpty();
  const [existing] = await db.select().from(loyaltyTiersTable).where(eq(loyaltyTiersTable.name, name));
  if (!existing) {
    res.status(404).json({ error: "דרגה לא נמצאה" });
    return;
  }
  const updates: Record<string, any> = {};
  if (nameHe !== undefined) updates.nameHe = nameHe;
  if (minSpent !== undefined) updates.minSpent = String(minSpent);
  if (shekelPerPoint !== undefined) updates.shekelPerPoint = String(shekelPerPoint);
  if (color !== undefined) updates.color = color;

  const [updated] = await db.update(loyaltyTiersTable).set(updates)
    .where(eq(loyaltyTiersTable.name, name)).returning();
  res.json({ ...updated, minSpent: parseFloat(updated.minSpent), shekelPerPoint: parseFloat(updated.shekelPerPoint) });
});

router.get("/loyalty/rules", async (_req, res): Promise<void> => {
  const [rules] = await db.select().from(loyaltyRulesTable);
  if (!rules) {
    res.json({ pointsPerShekel: 1, shekelPerPoint: 0.01, minRedemptionPoints: 100, maxRedemptionPercent: 20 });
    return;
  }
  res.json({
    pointsPerShekel: parseFloat(rules.pointsPerShekel),
    shekelPerPoint: parseFloat(rules.shekelPerPoint),
    minRedemptionPoints: rules.minRedemptionPoints,
    maxRedemptionPercent: parseFloat(rules.maxRedemptionPercent),
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
  res.json({ pointsPerShekel, shekelPerPoint, minRedemptionPoints, maxRedemptionPercent });
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
