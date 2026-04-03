import { AdminLayout } from "@/components/admin-layout";
import { useGetLoyaltyRules, useUpdateLoyaltyRules } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/use-toast";

interface LoyaltyTier {
  id: number;
  name: string;
  nameHe: string;
  minSpent: number;
  shekelPerPoint: number;
  color: string;
  icon: string;
  sortOrder: number;
}

const TIER_ICONS: Record<string, string> = {
  bronze: "🥉",
  silver: "🥈",
  gold: "🥇",
  vip: "💎",
};

function useLoyaltyTiers() {
  return useQuery<LoyaltyTier[]>({
    queryKey: ["loyalty-tiers"],
    queryFn: async () => {
      const res = await fetch("/api/loyalty/tiers");
      if (!res.ok) throw new Error("Failed to fetch tiers");
      return res.json();
    },
  });
}

function useUpdateLoyaltyTier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, data }: { name: string; data: Partial<LoyaltyTier> }) => {
      const res = await fetch(`/api/loyalty/tiers/${name}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update tier");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["loyalty-tiers"] });
    },
  });
}

function TierEditor({ tier }: { tier: LoyaltyTier }) {
  const [minSpent, setMinSpent] = useState(String(tier.minSpent));
  const [shekelPerPoint, setShekelPerPoint] = useState(String(tier.shekelPerPoint));
  const updateTier = useUpdateLoyaltyTier();

  useEffect(() => {
    setMinSpent(String(tier.minSpent));
    setShekelPerPoint(String(tier.shekelPerPoint));
  }, [tier.minSpent, tier.shekelPerPoint]);

  const handleSave = async () => {
    try {
      await updateTier.mutateAsync({
        name: tier.name,
        data: {
          minSpent: parseFloat(minSpent),
          shekelPerPoint: parseFloat(shekelPerPoint),
        },
      });
      toast({ title: `דרגת ${tier.nameHe} עודכנה` });
    } catch {
      toast({ title: "שגיאה בעדכון הדרגה", variant: "destructive" });
    }
  };

  return (
    <div
      className="rounded-xl border p-4 space-y-3"
      style={{ borderColor: tier.color + "60", background: tier.color + "0a" }}
    >
      <div className="flex items-center gap-2">
        <span className="text-2xl">{TIER_ICONS[tier.name] ?? "⭐"}</span>
        <div>
          <div className="font-bold text-base" style={{ color: tier.color }}>{tier.nameHe}</div>
          <Badge variant="outline" className="text-xs" style={{ borderColor: tier.color, color: tier.color }}>
            {tier.name.toUpperCase()}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">סף הצטרפות (הוצאה מצטברת ב-₪)</Label>
          {tier.name === "bronze" ? (
            <div className="h-9 px-3 py-2 text-sm text-muted-foreground border rounded-md bg-muted/50">0 (ברירת מחדל)</div>
          ) : (
            <div className="flex items-center gap-1">
              <span className="text-sm text-muted-foreground">₪</span>
              <Input
                type="number"
                min={0}
                step={50}
                value={minSpent}
                onChange={e => setMinSpent(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
          )}
        </div>

        <div className="space-y-1">
          <Label className="text-xs">שווי נקודה (₪ לנקודה)</Label>
          <div className="flex items-center gap-1">
            <Input
              type="number"
              min={0}
              step={0.001}
              value={shekelPerPoint}
              onChange={e => setShekelPerPoint(e.target.value)}
              className="h-9 text-sm"
            />
            <span className="text-sm text-muted-foreground">₪</span>
          </div>
        </div>
      </div>

      <div className="text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1">
        1,000 נקודות = <span className="font-bold text-foreground">₪{(1000 * parseFloat(shekelPerPoint || "0")).toFixed(2)}</span> הנחה בקופה
      </div>

      <Button
        size="sm"
        className="w-full"
        style={{ backgroundColor: tier.color, color: "#fff" }}
        onClick={handleSave}
        disabled={updateTier.isPending}
      >
        {updateTier.isPending ? "שומר..." : `עדכן דרגת ${tier.nameHe}`}
      </Button>
    </div>
  );
}

export default function AdminLoyalty() {
  const { data: rules, isLoading: rulesLoading } = useGetLoyaltyRules();
  const { data: tiers, isLoading: tiersLoading } = useLoyaltyTiers();
  const updateRules = useUpdateLoyaltyRules();

  const [formData, setFormData] = useState({
    pointsPerShekel: 0,
    shekelPerPoint: 0,
    minRedemptionPoints: 0,
    maxRedemptionPercent: 0,
  });

  useEffect(() => {
    if (rules) {
      setFormData({
        pointsPerShekel: rules.pointsPerShekel,
        shekelPerPoint: rules.shekelPerPoint,
        minRedemptionPoints: rules.minRedemptionPoints,
        maxRedemptionPercent: rules.maxRedemptionPercent,
      });
    }
  }, [rules]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateRules.mutateAsync({ data: formData });
      toast({ title: "הגדרות עודכנו בהצלחה" });
    } catch {
      toast({ title: "שגיאה בעדכון הגדרות", variant: "destructive" });
    }
  };

  if (rulesLoading || tiersLoading) return <AdminLayout><div className="p-8">טוען...</div></AdminLayout>;

  const sortedTiers = [...(tiers ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <AdminLayout>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">הגדרות מועדון לקוחות</h1>
      </div>

      <div className="space-y-8">
        {/* Tier Settings */}
        <Card>
          <CardHeader>
            <CardTitle>הגדרות דרגות חברות</CardTitle>
            <CardDescription>
              סף הצטרפות (₪ מצטבר) ושיעור המרת נקודות לכל דרגה — דרגה גבוהה יותר מעניקה שווי רב יותר לנקודה
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {sortedTiers.map(tier => (
                <TierEditor key={tier.name} tier={tier} />
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Rules + Example */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Card>
            <CardHeader>
              <CardTitle>חוקי צבירה ומימוש</CardTitle>
              <CardDescription>הגדר את הכללים הכלליים של הנקודות</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label>צבירה: נקודות לכל שקל</Label>
                  <div className="flex items-center gap-4">
                    <span>1 ₪ =</span>
                    <Input
                      type="number"
                      step="0.01"
                      className="w-24"
                      value={formData.pointsPerShekel}
                      onChange={e => setFormData({ ...formData, pointsPerShekel: Number(e.target.value) })}
                    />
                    <span>נקודות</span>
                  </div>
                  <p className="text-xs text-muted-foreground">כמה נקודות הלקוח מקבל על כל שקל שהוא מוציא.</p>
                </div>

                <div className="space-y-2">
                  <Label>מימוש: שווי שקלי לנקודה (ברירת מחדל)</Label>
                  <div className="flex items-center gap-4">
                    <span>1 נקודה =</span>
                    <Input
                      type="number"
                      step="0.001"
                      className="w-24"
                      value={formData.shekelPerPoint}
                      onChange={e => setFormData({ ...formData, shekelPerPoint: Number(e.target.value) })}
                    />
                    <span>₪</span>
                  </div>
                  <p className="text-xs text-muted-foreground">ערך ברירת מחדל — עיין בדרגות לעיל לשיעורים ספציפיים לכל דרגה.</p>
                </div>

                <div className="space-y-2">
                  <Label>מינימום נקודות למימוש</Label>
                  <Input
                    type="number"
                    value={formData.minRedemptionPoints}
                    onChange={e => setFormData({ ...formData, minRedemptionPoints: Number(e.target.value) })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>מקסימום מימוש מהזמנה (%)</Label>
                  <Input
                    type="number"
                    max="100"
                    value={formData.maxRedemptionPercent}
                    onChange={e => setFormData({ ...formData, maxRedemptionPercent: Number(e.target.value) })}
                  />
                  <p className="text-xs text-muted-foreground">האחוז המקסימלי מעלות ההזמנה שניתן לשלם בנקודות.</p>
                </div>

                <Button type="submit" className="w-full">שמור הגדרות</Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>חישוב לדוגמה</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted p-4 rounded-lg">
                <h4 className="font-bold mb-2">קנייה ב-1,000 ₪</h4>
                <ul className="text-sm space-y-1">
                  <li>יצבור: <span className="font-bold text-primary">{1000 * formData.pointsPerShekel} נקודות</span></li>
                </ul>
              </div>
              {sortedTiers.map(tier => (
                <div key={tier.name} className="bg-muted p-3 rounded-lg">
                  <h4 className="font-bold mb-1 text-sm flex items-center gap-1">
                    <span>{TIER_ICONS[tier.name]}</span> דרגת {tier.nameHe} — מימוש 1,000 נקודות
                  </h4>
                  <span className="font-bold" style={{ color: tier.color }}>
                    ₪{(1000 * tier.shekelPerPoint).toFixed(2)}
                  </span>
                  <span className="text-xs text-muted-foreground mr-1">הנחה בקופה</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
