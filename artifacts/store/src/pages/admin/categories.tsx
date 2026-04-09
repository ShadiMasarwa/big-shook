import { useState } from "react";
import { AdminLayout } from "@/components/admin-layout";
import {
  useListCategories,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
  getListCategoriesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/use-toast";
import { Plus, Edit, Trash2, ChevronLeft } from "lucide-react";
import { MediaPickerButton } from "@/components/media-picker";

const EMPTY_FORM = {
  nameHe: "",
  nameEn: "",
  slug: "",
  description: "",
  imageUrl: "",
  parentId: "" as string | number,
  sortOrder: 0,
  isActive: true,
};

function toSlug(str: string) {
  return str
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w\u0590-\u05FF-]/g, "")
    .replace(/-+/g, "-");
}

export default function AdminCategories() {
  const queryClient = useQueryClient();
  const { data: categories = [], isLoading } = useListCategories();
  const createMutation = useCreateCategory();
  const updateMutation = useUpdateCategory();
  const deleteMutation = useDeleteCategory();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [slugManual, setSlugManual] = useState(false);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getListCategoriesQueryKey() });

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setSlugManual(false);
    setDialogOpen(true);
  };

  const openEdit = (cat: any) => {
    setEditing(cat);
    setForm({
      nameHe: cat.nameHe ?? "",
      nameEn: cat.nameEn ?? "",
      slug: cat.slug ?? "",
      description: cat.description ?? "",
      imageUrl: cat.imageUrl ?? "",
      parentId: cat.parentId ?? "",
      sortOrder: cat.sortOrder ?? 0,
      isActive: cat.isActive ?? true,
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
      imageUrl: form.imageUrl || undefined,
      parentId: form.parentId !== "" ? Number(form.parentId) : undefined,
      sortOrder: Number(form.sortOrder),
      isActive: form.isActive,
    };
    try {
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, data: payload as any });
        toast({ title: "הקטגוריה עודכנה" });
      } else {
        await createMutation.mutateAsync({ data: payload as any });
        toast({ title: "הקטגוריה נוצרה" });
      }
      setDialogOpen(false);
      invalidate();
    } catch (e: any) {
      toast({ title: e?.data?.error ?? "שגיאה בשמירה", variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteMutation.mutateAsync({ id: deleteId });
      toast({ title: "הקטגוריה נמחקה" });
      invalidate();
    } catch {
      toast({ title: "לא ניתן למחוק קטגוריה זו", variant: "destructive" });
    } finally {
      setDeleteId(null);
    }
  };

  const roots = (categories as any[]).filter((c) => !c.parentId);
  const children = (id: number) =>
    (categories as any[]).filter((c) => c.parentId === id);
  const parentMap = new Map((categories as any[]).map((c) => [c.id, c.nameHe]));

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <AdminLayout>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">ניהול קטגוריות</h1>
          <p className="text-muted-foreground mt-1">הוסף ונהל קטגוריות ותת-קטגוריות לחנות</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="ml-2 h-4 w-4" /> קטגוריה חדשה
        </Button>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">שם (עברית)</TableHead>
              <TableHead className="text-right">שם (אנגלית)</TableHead>
              <TableHead className="text-right">Slug</TableHead>
              <TableHead className="text-right">קטגוריית אב</TableHead>
              <TableHead className="text-center">סדר</TableHead>
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
            ) : (categories as any[]).length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                  אין קטגוריות. לחץ על "קטגוריה חדשה" להוספה.
                </TableCell>
              </TableRow>
            ) : (
              roots.flatMap((root) => [
                <TableRow key={root.id} className="bg-muted/30 font-medium">
                  <TableCell>
                    <span className="font-bold">{root.nameHe}</span>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{root.nameEn || "—"}</TableCell>
                  <TableCell><code className="text-xs bg-muted px-1 rounded">{root.slug}</code></TableCell>
                  <TableCell className="text-muted-foreground text-sm">—</TableCell>
                  <TableCell className="text-center text-sm">{root.sortOrder}</TableCell>
                  <TableCell className="text-center">
                    {root.isActive
                      ? <Badge variant="outline" className="text-green-600 border-green-600">פעיל</Badge>
                      : <Badge variant="secondary">לא פעיל</Badge>}
                  </TableCell>
                  <TableCell className="text-left">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(root)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setDeleteId(root.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>,
                ...children(root.id).map((child: any) => (
                  <TableRow key={child.id}>
                    <TableCell>
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <ChevronLeft className="h-3.5 w-3.5 shrink-0" />
                        {child.nameHe}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{child.nameEn || "—"}</TableCell>
                    <TableCell><code className="text-xs bg-muted px-1 rounded">{child.slug}</code></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{parentMap.get(child.parentId) ?? "—"}</TableCell>
                    <TableCell className="text-center text-sm">{child.sortOrder}</TableCell>
                    <TableCell className="text-center">
                      {child.isActive
                        ? <Badge variant="outline" className="text-green-600 border-green-600">פעיל</Badge>
                        : <Badge variant="secondary">לא פעיל</Badge>}
                    </TableCell>
                    <TableCell className="text-left">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(child)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setDeleteId(child.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )),
              ])
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "עריכת קטגוריה" : "קטגוריה חדשה"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>שם בעברית *</Label>
                <Input
                  required
                  value={form.nameHe}
                  onChange={(e) => handleNameHeChange(e.target.value)}
                  placeholder="לדוגמה: סמארטפונים"
                />
              </div>
              <div className="space-y-2">
                <Label>שם באנגלית</Label>
                <Input
                  value={form.nameEn}
                  onChange={(e) => handleNameEnChange(e.target.value)}
                  placeholder="Smartphones"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Slug *</Label>
              <Input
                required
                value={form.slug}
                onChange={(e) => { setSlugManual(true); setForm((f) => ({ ...f, slug: e.target.value })); }}
                placeholder="smartphones"
                className="font-mono text-sm"
                dir="ltr"
              />
              <p className="text-xs text-muted-foreground">כתובת URL ייחודית — מתמלאת אוטומטית מהשם</p>
            </div>

            <div className="space-y-2">
              <Label>קטגוריית אב</Label>
              <select
                className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                value={String(form.parentId)}
                onChange={(e) => setForm((f) => ({ ...f, parentId: e.target.value }))}
              >
                <option value="">ללא (קטגוריה ראשית)</option>
                {(categories as any[])
                  .filter((c) => !c.parentId && (!editing || c.id !== editing.id))
                  .map((c) => (
                    <option key={c.id} value={c.id}>{c.nameHe}</option>
                  ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>תיאור</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="תיאור קצר של הקטגוריה"
              />
            </div>

            <div className="space-y-2">
              <Label>תמונה</Label>
              <MediaPickerButton
                value={form.imageUrl}
                onChange={(url) => setForm((f) => ({ ...f, imageUrl: url }))}
                label="בחר תמונה מהמדיה"
              />
            </div>

            <div className="grid grid-cols-2 gap-4 items-center">
              <div className="space-y-2">
                <Label>סדר מיון</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.sortOrder}
                  onChange={(e) => setForm((f) => ({ ...f, sortOrder: Number(e.target.value) }))}
                />
              </div>
              <div className="flex items-center gap-3 pt-6">
                <Switch
                  checked={form.isActive}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v }))}
                />
                <Label>{form.isActive ? "פעיל" : "לא פעיל"}</Label>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>ביטול</Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "שומר..." : editing ? "עדכן" : "צור קטגוריה"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>מחיקת קטגוריה</AlertDialogTitle>
            <AlertDialogDescription>
              פעולה זו תמחק את הקטגוריה לצמיתות. קטגוריות עם מוצרים לא ניתן למחוק.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              מחק
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
