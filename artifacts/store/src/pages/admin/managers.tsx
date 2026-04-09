import { useState } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, UserCog, Mail, Shield, Pencil, Trash2, RefreshCw } from "lucide-react";

const API = "/api";

const SECTIONS: { key: string; label: string }[] = [
  { key: "products", label: "מוצרים" },
  { key: "categories", label: "קטגוריות" },
  { key: "brands", label: "מותגים" },
  { key: "orders", label: "הזמנות" },
  { key: "customers", label: "לקוחות" },
  { key: "coupons", label: "קופונים" },
  { key: "suppliers", label: "ספקים" },
  { key: "inventory", label: "מלאי" },
  { key: "media", label: "ספריית מדיה" },
  { key: "analytics", label: "דוחות וסטטיסטיקה" },
  { key: "settings", label: "הגדרות האתר" },
  { key: "ads", label: "מודעות" },
  { key: "loyalty", label: "מועדון לקוחות" },
  { key: "import", label: "ייבוא וייצוא" },
];

const PRIVILEGE_OPTIONS = [
  { value: "read_only", label: "צפייה בלבד" },
  { value: "read_write", label: "צפייה והוספה/עריכה" },
  { value: "all", label: "כל ההרשאות" },
];

const DEFAULT_PRIVILEGES = Object.fromEntries(SECTIONS.map((s) => [s.key, "all"]));

function authHeader() {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiJson(url: string, opts: RequestInit = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: { "Content-Type": "application/json", ...authHeader(), ...(opts.headers ?? {}) },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "שגיאה");
  return data;
}

export default function AdminManagers() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [addOpen, setAddOpen] = useState(false);
  const [editManager, setEditManager] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  const [addForm, setAddForm] = useState({ firstName: "", lastName: "", email: "" });
  const [editPrivileges, setEditPrivileges] = useState<Record<string, string>>(DEFAULT_PRIVILEGES);
  const [editActive, setEditActive] = useState(true);
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");

  const { data: managers = [], isLoading } = useQuery({
    queryKey: ["/api/managers"],
    queryFn: () => apiJson(`${API}/managers`),
  });

  const createMutation = useMutation({
    mutationFn: (body: any) => apiJson(`${API}/managers`, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/managers"] });
      setAddOpen(false);
      setAddForm({ firstName: "", lastName: "", email: "" });
      const msg = data.emailSent
        ? "מנהל נוצר ואימייל הוגדרה נשלח בהצלחה"
        : `מנהל נוצר. קישור הגדרה (dev): ${data.devLink}`;
      toast({ title: "מנהל חדש", description: msg });
    },
    onError: (e: any) => toast({ title: "שגיאה", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: any }) =>
      apiJson(`${API}/managers/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/managers"] });
      setEditManager(null);
      toast({ title: "מנהל עודכן בהצלחה" });
    },
    onError: (e: any) => toast({ title: "שגיאה", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiJson(`${API}/managers/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/managers"] });
      setDeleteTarget(null);
      toast({ title: "מנהל נמחק" });
    },
    onError: (e: any) => toast({ title: "שגיאה", description: e.message, variant: "destructive" }),
  });

  const resendMutation = useMutation({
    mutationFn: (id: number) => apiJson(`${API}/managers/${id}/resend-setup`, { method: "POST" }),
    onSuccess: (data) => {
      const msg = data.emailSent ? "אימייל נשלח" : `קישור (dev): ${data.devLink}`;
      toast({ title: "אימייל הגדרה", description: msg });
    },
    onError: (e: any) => toast({ title: "שגיאה", description: e.message, variant: "destructive" }),
  });

  const openEdit = (m: any) => {
    setEditManager(m);
    setEditFirstName(m.firstName);
    setEditLastName(m.lastName);
    setEditActive(m.isActive);
    setEditPrivileges({ ...DEFAULT_PRIVILEGES, ...(m.privileges ?? {}) });
  };

  const saveEdit = () => {
    updateMutation.mutate({
      id: editManager.id,
      patch: {
        firstName: editFirstName,
        lastName: editLastName,
        isActive: editActive,
        privileges: editPrivileges,
      },
    });
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">ניהול מנהלים</h1>
            <p className="text-muted-foreground text-sm mt-1">הוספה וניהול מנהלי מערכת</p>
          </div>
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="ml-2 h-4 w-4" />
            הוסף מנהל
          </Button>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">טוען...</div>
        ) : managers.length === 0 ? (
          <div className="text-center py-16 border-2 border-dashed border-border rounded-xl">
            <UserCog className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground">אין מנהלים עדיין</p>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="text-right px-4 py-3 font-medium">שם</th>
                  <th className="text-right px-4 py-3 font-medium">אימייל</th>
                  <th className="text-right px-4 py-3 font-medium">סטטוס</th>
                  <th className="text-right px-4 py-3 font-medium">סיסמה</th>
                  <th className="text-right px-4 py-3 font-medium">תאריך יצירה</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {managers.map((m: any) => (
                  <tr key={m.id} className="hover:bg-muted/20">
                    <td className="px-4 py-3 font-medium">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                          {m.firstName?.[0]}{m.lastName?.[0]}
                        </div>
                        {m.firstName} {m.lastName}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{m.email}</td>
                    <td className="px-4 py-3">
                      <Badge variant={m.isActive ? "default" : "secondary"}>
                        {m.isActive ? "פעיל" : "לא פעיל"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {m.passwordSet ? (
                        <Badge variant="outline" className="text-green-600 border-green-300">הוגדרה</Badge>
                      ) : (
                        <Badge variant="outline" className="text-amber-600 border-amber-300">ממתין להגדרה</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {new Date(m.createdAt).toLocaleDateString("he-IL")}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => resendMutation.mutate(m.id)} title="שלח שוב אימייל הגדרה">
                          <Mail className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(m)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(m)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Manager Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>הוספת מנהל חדש</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => { e.preventDefault(); createMutation.mutate(addForm); }}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>שם פרטי *</Label>
                <Input required value={addForm.firstName} onChange={(e) => setAddForm((f) => ({ ...f, firstName: e.target.value }))} placeholder="ישראל" />
              </div>
              <div className="space-y-2">
                <Label>שם משפחה *</Label>
                <Input required value={addForm.lastName} onChange={(e) => setAddForm((f) => ({ ...f, lastName: e.target.value }))} placeholder="ישראלי" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>כתובת אימייל *</Label>
              <Input required type="email" value={addForm.email} onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))} placeholder="manager@store.co.il" dir="ltr" />
            </div>
            <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
              המנהל יקבל אימייל עם קישור להגדרת סיסמה. ברירת המחדל היא כל ההרשאות — ניתן לשנות לאחר יצירה.
            </p>
            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={createMutation.isPending} className="flex-1">
                {createMutation.isPending ? "יוצר..." : "צור מנהל ושלח אימייל"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>ביטול</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Manager Dialog */}
      <Dialog open={!!editManager} onOpenChange={(o) => !o && setEditManager(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              עריכת מנהל: {editManager?.firstName} {editManager?.lastName}
            </DialogTitle>
          </DialogHeader>
          {editManager && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>שם פרטי</Label>
                  <Input value={editFirstName} onChange={(e) => setEditFirstName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>שם משפחה</Label>
                  <Input value={editLastName} onChange={(e) => setEditLastName(e.target.value)} />
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-muted/40 rounded-lg">
                <div>
                  <p className="font-medium text-sm">סטטוס מנהל</p>
                  <p className="text-xs text-muted-foreground">מנהל לא פעיל לא יוכל להתחבר לממשק הניהול</p>
                </div>
                <Switch checked={editActive} onCheckedChange={setEditActive} />
              </div>

              <div className="space-y-3">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  הרשאות לפי מודול
                </h3>
                <div className="border border-border rounded-xl overflow-hidden">
                  {SECTIONS.map((section, i) => (
                    <div key={section.key} className={`flex items-center justify-between px-4 py-3 ${i !== 0 ? "border-t border-border" : ""}`}>
                      <span className="text-sm font-medium">{section.label}</span>
                      <Select
                        value={editPrivileges[section.key] ?? "all"}
                        onValueChange={(val) => setEditPrivileges((p) => ({ ...p, [section.key]: val }))}
                      >
                        <SelectTrigger className="w-52 h-8 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PRIVILEGE_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button onClick={saveEdit} disabled={updateMutation.isPending} className="flex-1">
                  {updateMutation.isPending ? "שומר..." : "שמור שינויים"}
                </Button>
                <Button variant="outline" onClick={() => setEditManager(null)}>ביטול</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>מחיקת מנהל</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            האם אתה בטוח שברצונך למחוק את <strong>{deleteTarget?.firstName} {deleteTarget?.lastName}</strong>?
            פעולה זו אינה הפיכה.
          </p>
          <div className="flex gap-2 pt-2">
            <Button variant="destructive" onClick={() => deleteMutation.mutate(deleteTarget?.id)} disabled={deleteMutation.isPending} className="flex-1">
              {deleteMutation.isPending ? "מוחק..." : "מחק"}
            </Button>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>ביטול</Button>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
