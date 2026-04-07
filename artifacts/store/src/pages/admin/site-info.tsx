import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save, Settings2, Info } from "lucide-react";

const FIELD_DEFS = [
  {
    key: "topbar_left",
    label: 'שורה עליונה — טקסט שמאל',
    description: 'מופיע בצד שמאל של הרצועה הכחולה העליונה (טלפון, שעות פעילות וכו\')',
    placeholder: "שירות לקוחות: 077-1234577",
  },
  {
    key: "topbar_right",
    label: 'שורה עליונה — טקסט ימין',
    description: 'מופיע בצד ימין של הרצועה הכחולה העליונה (מבצעי משלוח וכו\')',
    placeholder: "משלוח חינם בקנייה מעל ₪299",
  },
  {
    key: "midbar_center",
    label: 'שורה אמצעית — טקסט מרכזי',
    description: 'מופיע ברצועה האמצעית מתחת לבאנרים הפרסומיים. ריק = הרצועה מוסתרת',
    placeholder: "הצטרפו למועדון הלקוחות וצברו נקודות בכל קנייה!",
  },
] as const;

export default function AdminSiteInfo() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});

  const { data: settings, isLoading } = useQuery<Record<string, string>>({
    queryKey: ["site-settings"],
    queryFn: async () => {
      const res = await fetch("/api/site-settings");
      if (!res.ok) throw new Error("שגיאה בטעינת ההגדרות");
      return res.json();
    },
  });

  useEffect(() => {
    if (settings) setValues(settings);
  }, [settings]);

  const handleSave = async (key: string) => {
    setSaving(key);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/admin/site-settings/${key}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ value: values[key] ?? "" }),
      });
      if (!res.ok) throw new Error("שגיאה בשמירה");
      await queryClient.invalidateQueries({ queryKey: ["site-settings"] });
      toast({ title: "נשמר בהצלחה ✓" });
    } catch {
      toast({ title: "שגיאה בשמירת ההגדרות", variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  return (
    <AdminLayout>
      <div className="max-w-2xl mx-auto" dir="rtl">
        <div className="flex items-center gap-3 mb-8">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Settings2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-black">מידע האתר</h1>
            <p className="text-muted-foreground text-sm">עריכת הטקסטים ברצועות הפרסומיות</p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-5">
            {FIELD_DEFS.map((field) => (
              <div key={field.key} className="bg-card border border-border rounded-2xl p-6">
                <Label className="text-base font-bold mb-1 block">{field.label}</Label>
                <p className="text-xs text-muted-foreground mb-3 flex items-start gap-1.5">
                  <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  {field.description}
                </p>
                <div className="flex gap-3">
                  <Input
                    value={values[field.key] ?? ""}
                    onChange={(e) => setValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                    placeholder={field.placeholder}
                    className="flex-1"
                    dir="rtl"
                  />
                  <Button
                    onClick={() => handleSave(field.key)}
                    disabled={saving === field.key}
                    className="shrink-0 gap-2"
                  >
                    {saving === field.key ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    שמור
                  </Button>
                </div>
              </div>
            ))}

            <div className="rounded-xl bg-muted/60 p-4 text-sm text-muted-foreground flex gap-3">
              <Info className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
              <span>שינויים יופיעו מיד בחנות לאחר השמירה. הרצועה האמצעית מוסתרת אוטומטית אם השדה שלה ריק.</span>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
