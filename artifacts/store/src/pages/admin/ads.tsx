import { useMemo, useState } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { MediaPickerModal } from "@/components/media-picker";
import { toast } from "sonner";
import { ImageIcon, Trash2, Save, ExternalLink } from "lucide-react";

interface Ad {
  id?: number;
  position: number;
  imageUrl: string;
  linkUrl?: string | null;
  title?: string | null;
  isActive: boolean;
}

const POSITIONS = [1, 2, 3, 4];
const ADS_QUERY_KEY = ["admin-ads"];

const authHeaders = () => {
  const token = localStorage.getItem("token");
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
};

const emptySlot = (position: number): Ad => ({
  position,
  imageUrl: "",
  linkUrl: "",
  title: "",
  isActive: true,
});

export default function AdminAds() {
  const queryClient = useQueryClient();
  const [pickerOpenFor, setPickerOpenFor] = useState<number | null>(null);
  const [localEdits, setLocalEdits] = useState<Record<number, Ad>>({});

  const { data: adsFromServer = [], isLoading } = useQuery<Ad[]>({
    queryKey: ADS_QUERY_KEY,
    queryFn: async () => {
      const res = await fetch("/api/admin/ads", { headers: authHeaders() });
      if (!res.ok) throw new Error("Failed to load ads");
      return res.json();
    },
  });

  const slots: Record<number, Ad> = useMemo(() => {
    const base: Record<number, Ad> = Object.fromEntries(
      POSITIONS.map(p => [p, emptySlot(p)])
    );
    for (const ad of adsFromServer) {
      base[ad.position] = {
        position: ad.position,
        imageUrl: ad.imageUrl,
        linkUrl: ad.linkUrl ?? "",
        title: ad.title ?? "",
        isActive: ad.isActive,
      };
    }
    for (const [posStr, edit] of Object.entries(localEdits)) {
      base[Number(posStr)] = edit;
    }
    return base;
  }, [adsFromServer, localEdits]);

  const update = (position: number, field: keyof Ad, value: any) => {
    setLocalEdits(prev => ({
      ...prev,
      [position]: { ...slots[position], ...prev[position], [field]: value },
    }));
  };

  const saveMutation = useMutation({
    mutationFn: async (ad: Ad) => {
      const res = await fetch(`/api/admin/ads/${ad.position}`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({
          imageUrl: ad.imageUrl,
          linkUrl: ad.linkUrl || null,
          title: ad.title || null,
          isActive: ad.isActive,
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
      return res.json();
    },
    onSuccess: (_: any, ad: Ad) => {
      setLocalEdits(prev => { const n = { ...prev }; delete n[ad.position]; return n; });
      queryClient.invalidateQueries({ queryKey: ADS_QUERY_KEY });
      toast.success("המודעה נשמרה בהצלחה");
    },
    onError: () => toast.error("שגיאה בשמירת המודעה"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (position: number) => {
      const res = await fetch(`/api/admin/ads/${position}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: (_: any, position: number) => {
      setLocalEdits(prev => { const n = { ...prev }; delete n[position]; return n; });
      queryClient.invalidateQueries({ queryKey: ADS_QUERY_KEY });
      toast.success("המודעה הוסרה");
    },
    onError: () => toast.error("שגיאה במחיקת המודעה"),
  });

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">ניהול מודעות</h1>
          <p className="text-sm text-muted-foreground mt-1">
            4 פרסומות מתחת לתפריט הראשי — מומלץ להשתמש בתמונות בגודל <strong>800 × 400 פיקסל</strong> (יחס 2:1)
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-muted-foreground">טוען מודעות...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {POSITIONS.map(pos => {
            const slot = slots[pos];
            const hasImage = !!slot.imageUrl;

            return (
              <Card key={pos} className="overflow-hidden">
                <CardHeader className="pb-3 border-b bg-muted/30">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold">מודעה #{pos}</CardTitle>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        {slot.isActive ? "פעילה" : "מושבתת"}
                      </span>
                      <Switch
                        checked={slot.isActive}
                        onCheckedChange={v => update(pos, "isActive", v)}
                      />
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-4 space-y-4">
                  <div
                    className="relative w-full rounded-lg overflow-hidden border border-border bg-muted cursor-pointer group"
                    style={{ aspectRatio: "2/1" }}
                    onClick={() => setPickerOpenFor(pos)}
                  >
                    {hasImage ? (
                      <>
                        <img
                          src={slot.imageUrl}
                          alt={slot.title || `מודעה ${pos}`}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <span className="text-white text-sm font-medium bg-black/60 px-3 py-1.5 rounded-full">
                            החלף תמונה
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
                        <ImageIcon className="h-10 w-10 opacity-40" />
                        <span className="text-sm">לחץ לבחירת תמונה מהמדיה</span>
                        <span className="text-xs opacity-60">800 × 400 px מומלץ</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-sm">קישור (אופציונלי)</Label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <ExternalLink className="absolute top-1/2 -translate-y-1/2 right-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          value={slot.linkUrl ?? ""}
                          onChange={e => update(pos, "linkUrl", e.target.value)}
                          placeholder="https://..."
                          dir="ltr"
                          className="pr-9"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-sm">כותרת / תיאור (לנגישות)</Label>
                    <Input
                      value={slot.title ?? ""}
                      onChange={e => update(pos, "title", e.target.value)}
                      placeholder="תיאור המודעה..."
                    />
                  </div>

                  <div className="flex gap-2 pt-1">
                    <Button
                      className="flex-1"
                      disabled={!hasImage || saveMutation.isPending}
                      onClick={() => saveMutation.mutate(slot)}
                    >
                      <Save className="h-4 w-4 ml-2" />
                      שמור
                    </Button>
                    {hasImage && (
                      <Button
                        variant="outline"
                        size="icon"
                        className="text-destructive border-destructive hover:bg-destructive hover:text-white"
                        onClick={() => deleteMutation.mutate(pos)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <MediaPickerModal
        open={pickerOpenFor !== null}
        onOpenChange={open => { if (!open) setPickerOpenFor(null); }}
        onSelect={url => {
          if (pickerOpenFor !== null) {
            update(pickerOpenFor, "imageUrl", url);
            setPickerOpenFor(null);
          }
        }}
        title="בחר תמונה למודעה"
        filter="image"
      />
    </AdminLayout>
  );
}
