import { AdminLayout } from "@/components/admin-layout";
import {
  useListCoupons,
  useCreateCoupon,
  useUpdateCoupon,
  useDeleteCoupon,
  useListCategories,
  useListBrands,
  getListCouponsQueryKey,
} from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { Plus, Edit, Trash2, Layers } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { toast } from "@/components/ui/use-toast";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

type CouponType = "percentage" | "fixed" | "free_shipping";

const emptyForm = {
  code: "",
  type: "percentage" as CouponType,
  value: 0,
  maxDiscountAmount: 0,
  minOrderAmount: 0,
  startsAt: "",
  expiresAt: "",
  usageLimit: 0,
  usageLimitPerUser: 0,
  applicableCategories: [] as number[],
  applicableBrands: [] as number[],
  isActive: true,
  isStackable: false,
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="pt-2">
      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">{children}</p>
      <Separator className="mb-3" />
    </div>
  );
}

function MultiCheckList({
  label,
  items,
  selected,
  onChange,
}: {
  label: string;
  items: { id: number; label: string }[];
  selected: number[];
  onChange: (ids: number[]) => void;
}) {
  const toggle = (id: number) => {
    onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);
  };
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label} <span className="text-muted-foreground font-normal">(ריק = הכל)</span></Label>
      <div className="border border-border rounded-lg p-3 max-h-36 overflow-y-auto grid grid-cols-2 gap-y-1.5 gap-x-3">
        {items.map(item => (
          <label key={item.id} className="flex items-center gap-2 cursor-pointer text-sm hover:text-foreground text-muted-foreground">
            <Checkbox
              checked={selected.includes(item.id)}
              onCheckedChange={() => toggle(item.id)}
              className="shrink-0"
            />
            <span className="truncate">{item.label}</span>
          </label>
        ))}
      </div>
      {selected.length > 0 && (
        <button
          type="button"
          className="text-xs text-muted-foreground underline"
          onClick={() => onChange([])}
        >
          נקה בחירה
        </button>
      )}
    </div>
  );
}

export default function AdminCoupons() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useListCoupons({});
  const { data: categoriesData } = useListCategories({});
  const { data: brandsData } = useListBrands({});
  const createCoupon = useCreateCoupon();
  const updateCoupon = useUpdateCoupon();
  const deleteCoupon = useDeleteCoupon();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);

  const categories: { id: number; label: string }[] = (
    Array.isArray(categoriesData) ? categoriesData : (categoriesData as any)?.categories ?? []
  ).map((c: any) => ({ id: c.id, label: c.nameHe }));

  const brands: { id: number; label: string }[] = (
    Array.isArray(brandsData) ? brandsData : (brandsData as any)?.brands ?? []
  ).map((b: any) => ({ id: b.id, label: b.nameEn ?? b.nameHe ?? b.name }));

  const set = (patch: Partial<typeof emptyForm>) => setForm(f => ({ ...f, ...patch }));

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (coupon: any) => {
    setEditingId(coupon.id);
    setForm({
      code: coupon.code,
      type: coupon.type,
      value: coupon.value ?? 0,
      maxDiscountAmount: coupon.maxDiscountAmount ?? 0,
      minOrderAmount: coupon.minOrderAmount ?? 0,
      startsAt: coupon.startsAt ? coupon.startsAt.split("T")[0] : "",
      expiresAt: coupon.expiresAt ? coupon.expiresAt.split("T")[0] : "",
      usageLimit: coupon.usageLimit ?? 0,
      usageLimitPerUser: coupon.usageLimitPerUser ?? 0,
      applicableCategories: coupon.applicableCategories ?? [],
      applicableBrands: coupon.applicableBrands ?? [],
      isActive: coupon.isActive ?? true,
      isStackable: coupon.isStackable ?? false,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.code.trim()) {
      toast({ title: "יש להזין קוד קופון", variant: "destructive" });
      return;
    }
    const payload: Record<string, any> = {
      code: form.code.toUpperCase().trim(),
      type: form.type,
      value: Number(form.value),
      maxDiscountAmount: form.type === "percentage" && Number(form.maxDiscountAmount) > 0 ? Number(form.maxDiscountAmount) : null,
      minOrderAmount: Number(form.minOrderAmount) > 0 ? Number(form.minOrderAmount) : null,
      startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
      expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
      usageLimit: Number(form.usageLimit) > 0 ? Number(form.usageLimit) : null,
      usageLimitPerUser: Number(form.usageLimitPerUser) > 0 ? Number(form.usageLimitPerUser) : null,
      applicableCategories: form.applicableCategories,
      applicableBrands: form.applicableBrands,
      isActive: form.isActive,
      isStackable: form.isStackable,
    };
    try {
      if (editingId) {
        await updateCoupon.mutateAsync({ id: editingId, data: payload });
        toast({ title: "קופון עודכן בהצלחה" });
      } else {
        await createCoupon.mutateAsync({ data: payload });
        toast({ title: "קופון נוצר בהצלחה" });
      }
      queryClient.invalidateQueries({ queryKey: getListCouponsQueryKey() });
      setDialogOpen(false);
    } catch {
      toast({ title: "שגיאה בשמירת קופון", variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteCoupon.mutateAsync({ id: deleteId });
      toast({ title: "קופון נמחק" });
      queryClient.invalidateQueries({ queryKey: getListCouponsQueryKey() });
    } catch {
      toast({ title: "שגיאה במחיקת קופון", variant: "destructive" });
    }
    setDeleteId(null);
  };

  const coupons: any[] = Array.isArray(data) ? data : (data as any)?.coupons ?? [];

  const formatDateShort = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "2-digit" }) : null;

  return (
    <AdminLayout>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">ניהול קופונים</h1>
          <p className="text-muted-foreground mt-1">צור ונהל קודי הנחה ומבצעים לחנות</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="ml-2 h-4 w-4" /> קופון חדש
        </Button>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">קוד</TableHead>
              <TableHead className="text-right">סוג / ערך</TableHead>
              <TableHead className="text-center">מינימום</TableHead>
              <TableHead className="text-center">תוקף</TableHead>
              <TableHead className="text-center">שימושים</TableHead>
              <TableHead className="text-center">הגבלות</TableHead>
              <TableHead className="text-center">סטטוס</TableHead>
              <TableHead className="text-left">פעולות</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [...Array(3)].map((_, i) => (
                <TableRow key={i}>
                  {[...Array(8)].map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : coupons.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                  אין קופונים. לחץ על "קופון חדש" להוספה.
                </TableCell>
              </TableRow>
            ) : (
              coupons.map((coupon: any) => (
                <TableRow key={coupon.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <code className="font-bold text-primary tracking-wider">{coupon.code}</code>
                      {coupon.isStackable && (
                        <Layers className="h-3.5 w-3.5 text-muted-foreground" title="ניתן לשילוב" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <span className="text-muted-foreground">
                        {coupon.type === "percentage" ? "אחוזים" : coupon.type === "fixed" ? "סכום קבוע" : "משלוח חינם"}
                      </span>
                      <div className="font-semibold">
                        {coupon.type === "percentage"
                          ? `${coupon.value}%${coupon.maxDiscountAmount ? ` (עד ${formatPrice(coupon.maxDiscountAmount)})` : ""}`
                          : coupon.type === "fixed"
                          ? formatPrice(coupon.value)
                          : "—"}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-center text-sm">
                    {coupon.minOrderAmount ? formatPrice(coupon.minOrderAmount) : "—"}
                  </TableCell>
                  <TableCell className="text-center text-xs text-muted-foreground">
                    {coupon.startsAt && <div className="text-green-600">מ- {formatDateShort(coupon.startsAt)}</div>}
                    {coupon.expiresAt ? <div>עד {formatDateShort(coupon.expiresAt)}</div> : <div>ללא תפוגה</div>}
                  </TableCell>
                  <TableCell className="text-center text-sm">
                    <div>{coupon.usedCount}{coupon.usageLimit ? ` / ${coupon.usageLimit}` : ""} כולל</div>
                    {coupon.usageLimitPerUser && (
                      <div className="text-xs text-muted-foreground">{coupon.usageLimitPerUser} למשתמש</div>
                    )}
                  </TableCell>
                  <TableCell className="text-center text-xs text-muted-foreground">
                    {(coupon.applicableCategories?.length > 0 || coupon.applicableBrands?.length > 0) ? (
                      <div className="space-y-0.5">
                        {coupon.applicableCategories?.length > 0 && (
                          <div>{coupon.applicableCategories.length} קטגוריות</div>
                        )}
                        {coupon.applicableBrands?.length > 0 && (
                          <div>{coupon.applicableBrands.length} מותגים</div>
                        )}
                      </div>
                    ) : (
                      <span>הכל</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {coupon.isActive
                      ? <Badge variant="outline" className="text-green-600 border-green-600">פעיל</Badge>
                      : <Badge variant="secondary">לא פעיל</Badge>}
                  </TableCell>
                  <TableCell className="text-left">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="outline" size="icon" onClick={() => openEdit(coupon)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="text-destructive hover:bg-destructive hover:text-white"
                        onClick={() => setDeleteId(coupon.id)}
                      >
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

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col" dir="rtl">
          <DialogHeader>
            <DialogTitle>{editingId ? "עריכת קופון" : "קופון חדש"}</DialogTitle>
          </DialogHeader>

          <div className="overflow-y-auto flex-1 px-1 space-y-5 py-2">
            {/* ─── Basic ─── */}
            <SectionTitle>פרטי הנחה</SectionTitle>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1 col-span-2 sm:col-span-1">
                <Label>קוד קופון *</Label>
                <Input
                  dir="ltr"
                  className="uppercase tracking-widest font-bold"
                  placeholder="SAVE20"
                  value={form.code}
                  onChange={e => set({ code: e.target.value.toUpperCase() })}
                />
              </div>
              <div className="space-y-1 col-span-2 sm:col-span-1">
                <Label>סוג הנחה *</Label>
                <Select value={form.type} onValueChange={v => set({ type: v as CouponType, maxDiscountAmount: 0 })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">הנחה באחוזים (%)</SelectItem>
                    <SelectItem value="fixed">הנחה בסכום קבוע (₪)</SelectItem>
                    <SelectItem value="free_shipping">משלוח חינם</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {form.type !== "free_shipping" && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>{form.type === "percentage" ? "אחוז הנחה (%)" : "סכום הנחה (₪)"}</Label>
                  <Input
                    type="number" min="0"
                    max={form.type === "percentage" ? "100" : undefined}
                    step={form.type === "percentage" ? "1" : "0.01"}
                    value={form.value || ""}
                    onChange={e => set({ value: Number(e.target.value) })}
                  />
                </div>
                {form.type === "percentage" && (
                  <div className="space-y-1">
                    <Label>הנחה מקסימלית (₪) <span className="text-muted-foreground font-normal">אופציונלי</span></Label>
                    <Input
                      type="number" min="0" step="0.01" placeholder="ללא תקרה"
                      value={form.maxDiscountAmount || ""}
                      onChange={e => set({ maxDiscountAmount: Number(e.target.value) })}
                    />
                  </div>
                )}
              </div>
            )}

            {/* ─── Validity ─── */}
            <SectionTitle>תקינות</SectionTitle>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>תאריך התחלה</Label>
                <Input
                  type="date" dir="ltr"
                  value={form.startsAt}
                  onChange={e => set({ startsAt: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>תאריך תפוגה</Label>
                <Input
                  type="date" dir="ltr"
                  value={form.expiresAt}
                  onChange={e => set({ expiresAt: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>מינימום הזמנה (₪)</Label>
                <Input
                  type="number" min="0" step="0.01" placeholder="0 = ללא הגבלה"
                  value={form.minOrderAmount || ""}
                  onChange={e => set({ minOrderAmount: Number(e.target.value) })}
                />
              </div>
            </div>

            {/* ─── Usage limits ─── */}
            <SectionTitle>מגבלות שימוש</SectionTitle>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>מגבלת שימוש כוללת</Label>
                <Input
                  type="number" min="0" placeholder="0 = ללא הגבלה"
                  value={form.usageLimit || ""}
                  onChange={e => set({ usageLimit: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1">
                <Label>מגבלת שימוש למשתמש</Label>
                <Input
                  type="number" min="0" placeholder="0 = ללא הגבלה"
                  value={form.usageLimitPerUser || ""}
                  onChange={e => set({ usageLimitPerUser: Number(e.target.value) })}
                />
              </div>
            </div>

            {/* ─── Audience ─── */}
            <SectionTitle>הגבלת קהל</SectionTitle>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <MultiCheckList
                label="קטגוריות"
                items={categories}
                selected={form.applicableCategories}
                onChange={ids => set({ applicableCategories: ids })}
              />
              <MultiCheckList
                label="מותגים"
                items={brands}
                selected={form.applicableBrands}
                onChange={ids => set({ applicableBrands: ids })}
              />
            </div>

            {/* ─── Settings ─── */}
            <SectionTitle>הגדרות</SectionTitle>

            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <Switch
                  id="coupon-active"
                  checked={form.isActive}
                  onCheckedChange={v => set({ isActive: v })}
                />
                <Label htmlFor="coupon-active" className="cursor-pointer">קופון פעיל</Label>
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  id="coupon-stackable"
                  checked={form.isStackable}
                  onCheckedChange={v => set({ isStackable: v })}
                />
                <Label htmlFor="coupon-stackable" className="cursor-pointer">
                  ניתן לשילוב עם קופונים אחרים
                </Label>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2 border-t border-border">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>ביטול</Button>
            <Button onClick={handleSave} disabled={createCoupon.isPending || updateCoupon.isPending}>
              {createCoupon.isPending || updateCoupon.isPending ? "שומר..." : "שמור"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={deleteId !== null} onOpenChange={open => !open && setDeleteId(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>מחיקת קופון</AlertDialogTitle>
            <AlertDialogDescription>האם אתה בטוח שברצונך למחוק את הקופון? פעולה זו אינה ניתנת לביטול.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={handleDelete}>מחק</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
