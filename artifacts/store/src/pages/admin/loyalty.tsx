import { AdminLayout } from "@/components/admin-layout";
import { useGetLoyaltyRules, useUpdateLoyaltyRules, getGetLoyaltyRulesQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";
import { toast } from "@/components/ui/use-toast";

export default function AdminLoyalty() {
  const { data: rules, isLoading } = useGetLoyaltyRules();
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
    } catch (e) {
      toast({ title: "שגיאה בעדכון הגדרות", variant: "destructive" });
    }
  };

  if (isLoading) return <AdminLayout><div className="p-8">טוען...</div></AdminLayout>;

  return (
    <AdminLayout>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">הגדרות מועדון לקוחות</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>חוקי צבירה ומימוש</CardTitle>
            <CardDescription>הגדר את הערך של הנקודות במערכת</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label>צבירה: נקודות לכל שקל</Label>
                <div className="flex items-center gap-4">
                  <span>1 ₪ = </span>
                  <Input 
                    type="number" 
                    step="0.01"
                    className="w-24" 
                    value={formData.pointsPerShekel} 
                    onChange={e => setFormData({...formData, pointsPerShekel: Number(e.target.value)})} 
                  />
                  <span>נקודות</span>
                </div>
                <p className="text-xs text-muted-foreground">כמה נקודות הלקוח מקבל על כל שקל שהוא מוציא (לפני מכפיל הדרגה).</p>
              </div>

              <div className="space-y-2">
                <Label>מימוש: שווי שקלי לנקודה</Label>
                <div className="flex items-center gap-4">
                  <span>1 נקודה = </span>
                  <Input 
                    type="number" 
                    step="0.01"
                    className="w-24" 
                    value={formData.shekelPerPoint} 
                    onChange={e => setFormData({...formData, shekelPerPoint: Number(e.target.value)})} 
                  />
                  <span>₪</span>
                </div>
                <p className="text-xs text-muted-foreground">הערך הכספי של נקודה אחת בעת מימוש בקופה.</p>
              </div>

              <div className="space-y-2">
                <Label>מינימום נקודות למימוש</Label>
                <Input 
                  type="number" 
                  value={formData.minRedemptionPoints} 
                  onChange={e => setFormData({...formData, minRedemptionPoints: Number(e.target.value)})} 
                />
              </div>

              <div className="space-y-2">
                <Label>מקסימום מימוש מהזמנה (%)</Label>
                <Input 
                  type="number" 
                  max="100"
                  value={formData.maxRedemptionPercent} 
                  onChange={e => setFormData({...formData, maxRedemptionPercent: Number(e.target.value)})} 
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
              <h4 className="font-bold mb-2">קנייה ב-1,000 ₪ (דרגת ארד, מכפיל 1x)</h4>
              <ul className="text-sm space-y-1">
                <li>יצבור: <span className="font-bold text-primary">{1000 * formData.pointsPerShekel} נקודות</span></li>
                <li>שווי הנקודות שצבר: <span className="font-bold text-primary">₪{(1000 * formData.pointsPerShekel * formData.shekelPerPoint).toFixed(2)}</span></li>
              </ul>
            </div>
            <div className="bg-muted p-4 rounded-lg">
              <h4 className="font-bold mb-2">מימוש 1,000 נקודות</h4>
              <ul className="text-sm space-y-1">
                <li>הנחה בקופה: <span className="font-bold text-primary">₪{(1000 * formData.shekelPerPoint).toFixed(2)}</span></li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
