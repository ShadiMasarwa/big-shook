import { useState } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { useListBrands, useCreateBrand, getListBrandsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/use-toast";
import { MediaPickerButton } from "@/components/media-picker";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Edit, Trash2 } from "lucide-react";

const EMPTY_FORM = {
  nameHe: "",
  nameEn: "",
  slug: "",
  description: "",
  logoUrl: "",
  isActive: true,
};

function toSlug(str: string) {
  return str.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^\w-]/g, "").replace(/-+/g, "-");
}

export default function AdminBrands() {
  const queryClient = useQueryClient();
  const { data: brands = [], isLoading } = useListBrands();
  const createMutation = useCreateBrand();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [slugManual, setSlugManual] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListBrandsQueryKey() });

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setSlugManual(false);
    setDialogOpen(true);
  };

  const openEdit = (brand: any) => {
    setEditing(brand);
    setForm({
      nameHe: brand.nameHe ?? "",
      nameEn: brand.nameEn ?? "",
      slug: brand.slug ?? "",
      description: brand.description ?? "",
      logoUrl: brand.logoUrl ?? "",
      isActive: brand.isActive ?? true,
    });
    setSlugManual(true);
    setDialogOpen(true);
  };

  const handleNameHeChange = (val: string) => {
    setForm((f) => ({ ...f, nameHe: val }));
  };

  const handleNameEnChange = (val: string) => {
    setForm((f) => ({ ...f, nameEn: val, slug: slugManual ? f.slug : toSlug(val) }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      nameHe: form.nameHe,
      nameEn: form.nameEn || undefined,
      slug: form.slug,
      description: form.description || undefined,
      logoUrl: form.logoUrl || undefined,
      isActive: form.isActive,
    };
    setIsSaving(true);
    try {
      if (editing) {
        const token = localStorage.getItem("token");
        const res = await fetch(`/api/brands/${editing.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify(payload),
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
        toast({ title: "המותג עודכן" });
      } else {
        await createMutation.mutateAsync({ data: payload as any });
        toast({ title: "המותג נוצר" });
      }
      setDialogOpen(false);
      invalidate();
    } catch (err: any) {
      toast({ title: err?.message ?? "שגיאה בשמירה", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setIsDeleting(true);
    try {
      const token = localStorage.getItem("token");
      await fetch(`/api/brands/${deleteId}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      toast({ title: "המותג נמחק" });
      invalidate();
    } catch {
      toast({ title: "שגיאה במחיקה", variant: "destructive" });
    } finally {
      setIsDeleting(false);
      setDeleteId(null);
    }
  };

  return (
    <AdminLayout>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">ניהול מותגים</h1>
          <p className="text-muted-foreground mt-1">הוסף ונהל מותגים לחנות</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="ml-2 h-4 w-4" /> מותג חדש
        </Button>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-right w-16">לוגו</TableHead>
              <TableHead className="text-right">שם (עברית)</TableHead>
              <TableHead className="text-right">שם (אנגלית)</TableHead>
              <TableHead className="text-right">Slug</TableHead>
              <TableHead className="text-right">תיאור</TableHead>
              <TableHead className="text-center">סטטוס</TableHead>
              <TableHead className="text-left">פעולות</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  {[...Array(7)].map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : (brands as any[]).length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                  אין מותגים. לחץ על "מותג חדש" להוספה.
                </TableCell>
              </TableRow>
            ) : (
              (brands as any[]).map((brand) => (
                <TableRow key={brand.id}>
                  <TableCell>
                    {brand.logoUrl ? (
                      <img src={brand.logoUrl} alt={brand.nameHe} className="h-8 w-8 object-contain rounded" />
                    ) : (
                      <div className="h-8 w-8 rounded bg-muted flex items-center justify-center text-xs text-muted-foreground">—</div>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{brand.nameHe}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{brand.nameEn || "—"}</TableCell>
                  <TableCell><code className="text-xs bg-muted px-1 rounded">{brand.slug}</code></TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{brand.description || "—"}</TableCell>
                  <TableCell className="text-center">
                    {brand.isActive
                      ? <Badge variant="outline" className="text-green-600 border-green-600">פעיל</Badge>
                      : <Badge variant="secondary">לא פעיל</Badge>}
                  </TableCell>
                  <TableCell className="text-left">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(brand)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setDeleteId(brand.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "עריכת מותג" : "מותג חדש"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>שם בעברית *</Label>
                <Input
                  required
                  value={form.nameHe}
                  onChange={(e) => handleNameHeChange(e.target.value)}
                  placeholder="לדוגמה: סמסונג"
                />
              </div>
              <div className="space-y-2">
                <Label>שם באנגלית</Label>
                <Input
                  value={form.nameEn}
                  onChange={(e) => handleNameEnChange(e.target.value)}
                  placeholder="Samsung"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Slug *</Label>
              <Input
                required
                value={form.slug}
                onChange={(e) => { setSlugManual(true); setForm((f) => ({ ...f, slug: e.target.value })); }}
                placeholder="samsung"
                className="font-mono text-sm"
                dir="ltr"
              />
              <p className="text-xs text-muted-foreground">כתובת URL ייחודית — מתמלאת אוטומטית מהשם</p>
            </div>

            <div className="space-y-2">
              <Label>תיאור</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="תיאור קצר של המותג"
              />
            </div>

            <div className="space-y-2">
              <Label>לוגו</Label>
              <MediaPickerButton
                value={form.logoUrl}
                onChange={(url) => setForm((f) => ({ ...f, logoUrl: url }))}
                label="בחר לוגו מהמדיה"
              />
            </div>

            <div className="flex items-center gap-3">
              <Switch
                checked={form.isActive}
                onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v }))}
              />
              <Label>{form.isActive ? "פעיל" : "לא פעיל"}</Label>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>ביטול</Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "שומר..." : editing ? "עדכן מותג" : "צור מותג"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>מחיקת מותג</AlertDialogTitle>
            <AlertDialogDescription>
              פעולה זו תמחק את המותג לצמיתות. מוצרים המשויכים למותג זה לא יושפעו.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeleting ? "מוחק..." : "מחק"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
