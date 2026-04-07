import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save, Settings2, Info, FileText } from "lucide-react";
import { RichTextEditor } from "@/components/rich-text-editor";

// ── Top-bar text fields ──────────────────────────────────────────────────────
const TOPBAR_FIELDS = [
  {
    key: "topbar_left",
    label: "טקסט שמאל",
    description: "מופיע בצד שמאל של הרצועה הכחולה העליונה",
    placeholder: "שירות לקוחות: 077-1234577",
  },
  {
    key: "topbar_right",
    label: "טקסט ימין",
    description: "מופיע בצד ימין של הרצועה הכחולה העליונה",
    placeholder: "משלוח חינם בקנייה מעל ₪299",
  },
] as const;

// ── Rich-text page sections ──────────────────────────────────────────────────
const PAGE_SECTIONS = [
  { key: "page_takanon",       title: "תקנון" },
  { key: "page_delivery",      title: "מדיניות הובלה" },
  { key: "page_privacy",       title: "הגנת הפרטיות" },
  { key: "page_accessibility", title: "נגישות" },
  { key: "page_cancellation",  title: "מדיניות ביטול עסקה" },
  { key: "page_safety",        title: "הוראות בטיחות" },
] as const;

// ── Helpers ──────────────────────────────────────────────────────────────────
async function saveSetting(key: string, value: string): Promise<void> {
  const token = localStorage.getItem("token");
  const res = await fetch(`/api/admin/site-settings/${key}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ value }),
  });
  if (!res.ok) throw new Error("שגיאה בשמירה");
}

// ── Component ────────────────────────────────────────────────────────────────
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
      await saveSetting(key, values[key] ?? "");
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
      <div dir="rtl" className="space-y-8">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Settings2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-black">מידע האתר</h1>
            <p className="text-muted-foreground text-sm">עריכת טקסטים ברצועה העליונה ודפי מידע</p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* ── Top bar section ── */}
            <div className="bg-card border border-border rounded-2xl p-6">
              <h2 className="text-base font-bold mb-5 flex items-center gap-2">
                <Settings2 className="h-4 w-4 text-primary" /> רצועה עליונה
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {TOPBAR_FIELDS.map((field) => (
                  <div key={field.key}>
                    <Label className="text-sm font-semibold mb-1 block">{field.label}</Label>
                    <p className="text-xs text-muted-foreground mb-2 flex items-start gap-1.5">
                      <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      {field.description}
                    </p>
                    <div className="flex gap-2">
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
                        className="shrink-0 gap-1.5"
                      >
                        {saving === field.key ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        שמור
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Page content sections ── */}
            {PAGE_SECTIONS.map((section) => (
              <div key={section.key} className="bg-card border border-border rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-bold flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    {section.title}
                  </h2>
                  <Button
                    onClick={() => handleSave(section.key)}
                    disabled={saving === section.key}
                    className="gap-1.5"
                  >
                    {saving === section.key ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    שמור
                  </Button>
                </div>
                <RichTextEditor
                  value={values[section.key] ?? ""}
                  onChange={(html) => setValues((prev) => ({ ...prev, [section.key]: html }))}
                  placeholder={`הקלד את תוכן ${section.title} כאן...`}
                  minHeight={220}
                />
              </div>
            ))}

            <div className="rounded-xl bg-muted/60 p-4 text-sm text-muted-foreground flex gap-3">
              <Info className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
              <span>שינויים יופיעו מיד לאחר השמירה.</span>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
