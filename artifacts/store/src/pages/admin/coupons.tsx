import { AdminLayout } from "@/components/admin-layout";
import { 
  useListCoupons, 
  useCreateCoupon, 
  useUpdateCoupon, 
  useDeleteCoupon,
  getListCouponsQueryKey 
} from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Edit, Trash2 } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { toast } from "@/components/ui/use-toast";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

type CouponType = "percentage" | "fixed" | "free_shipping";

const emptyCoupon = {
  code: "",
  type: "percentage" as CouponType,
  value: 0,
  minOrderAmount: 0,
  maxUsageCount: 0,
  isActive: true,
  expiresAt: "",
};

export default function AdminCoupons() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useListCoupons({});
  const createCoupon = useCreateCoupon();
  const updateCoupon = useUpdateCoupon();
  const deleteCoupon = useDeleteCoupon();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyCoupon);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyCoupon);
    setDialogOpen(true);
  };

  const openEdit = (coupon: any) => {
    setEditingId(coupon.id);
    setForm({
      code: coupon.code,
      type: coupon.type,
      value: coupon.value,
      minOrderAmount: coupon.minOrderAmount || 0,
      maxUsageCount: coupon.maxUsageCount || 0,
      isActive: coupon.isActive,
      expiresAt: coupon.expiresAt ? coupon.expiresAt.split("T")[0] : "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.code.trim()) {
      toast({ title: "יש להזין קוד קופון", variant: "destructive" });
      return;
    }
    const payload = {
      code: form.code.toUpperCase().trim(),
      type: form.type,
      value: Number(form.value),
      minOrderAmount: Number(form.minOrderAmount) > 0 ? Number(form.minOrderAmount) : null,
      maxUsageCount: Number(form.maxUsageCount) > 0 ? Number(form.maxUsageCount) : null,
      isActive: form.isActive,
      expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
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

  return (
    <AdminLayout>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">ניהול קופונים</h1>
          <p className="text-muted-foreground mt-1">צור ונהל קודי הנחה ומבצעים לחנות</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="ml-2 h-4 w-4"/> קופון חדש
        </Button>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">קוד</TableHead>
              <TableHead className="text-right">סוג הנחה</TableHead>
              <TableHead className="text-right">ערך</TableHead>
              <TableHead className="text-center">מינימום הזמנה</TableHead>
              <TableHead className="text-center">תוקף</TableHead>
              <TableHead className="text-center">סטטוס</TableHead>
              <TableHead className="text-center">שימושים</TableHead>
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
            ) : !data?.coupons || data.coupons.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                  אין קופונים. לחץ על "קופון חדש" להוספה.
                </TableCell>
              </TableRow>
            ) : (
              data.coupons.map(coupon => (
                <TableRow key={coupon.id}>
                  <TableCell className="font-bold text-primary tracking-wider">{coupon.code}</TableCell>
                  <TableCell>
                    {coupon.type === 'percentage' ? 'אחוזים' : coupon.type === 'fixed' ? 'סכום קבוע' : 'משלוח חינם'}
                  </TableCell>
                  <TableCell className="font-medium">
                    {coupon.type === 'percentage' ? `${coupon.value}%` : coupon.type === 'fixed' ? formatPrice(coupon.value) : '—'}
                  </TableCell>
                  <TableCell className="text-center">{coupon.minOrderAmount ? formatPrice(coupon.minOrderAmount) : '—'}</TableCell>
                  <TableCell className="text-center text-sm">
                    {coupon.expiresAt ? new Date(coupon.expiresAt).toLocaleDateString('he-IL') : 'ללא הגבלה'}
                  </TableCell>
                  <TableCell className="text-center">
                    {coupon.isActive 
                      ? <Badge variant="outline" className="text-green-600 border-green-600">פעיל</Badge> 
                      : <Badge variant="secondary">לא פעיל</Badge>
                    }
                  </TableCell>
                  <TableCell className="text-center font-medium">
                    {coupon.usedCount}
                    {coupon.maxUsageCount ? ` / ${coupon.maxUsageCount}` : ''}
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>{editingId ? "עריכת קופון" : "קופון חדש"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>קוד קופון *</Label>
              <Input 
                dir="ltr" 
                className="uppercase tracking-widest font-bold"
                placeholder="SAVE20"
                value={form.code}
                onChange={e => setForm({...form, code: e.target.value.toUpperCase()})}
              />
            </div>
            <div className="space-y-1">
              <Label>סוג הנחה *</Label>
              <Select value={form.type} onValueChange={v => setForm({...form, type: v as CouponType})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">הנחה באחוזים (%)</SelectItem>
                  <SelectItem value="fixed">הנחה בסכום קבוע (₪)</SelectItem>
                  <SelectItem value="free_shipping">משלוח חינם</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.type !== "free_shipping" && (
              <div className="space-y-1">
                <Label>{form.type === "percentage" ? "אחוז הנחה (%)" : "סכום הנחה (₪)"}</Label>
                <Input 
                  type="number" 
                  min="0" 
                  max={form.type === "percentage" ? "100" : undefined}
                  step={form.type === "percentage" ? "1" : "0.01"}
                  value={form.value}
                  onChange={e => setForm({...form, value: Number(e.target.value)})}
                />
              </div>
            )}
            <div className="space-y-1">
              <Label>מינימום הזמנה (₪)</Label>
              <Input 
                type="number" min="0" step="0.01" placeholder="0 = ללא הגבלה"
                value={form.minOrderAmount || ""}
                onChange={e => setForm({...form, minOrderAmount: Number(e.target.value)})}
              />
            </div>
            <div className="space-y-1">
              <Label>מגבלת שימוש (כמות)</Label>
              <Input 
                type="number" min="0" placeholder="0 = ללא הגבלה"
                value={form.maxUsageCount || ""}
                onChange={e => setForm({...form, maxUsageCount: Number(e.target.value)})}
              />
            </div>
            <div className="space-y-1">
              <Label>תאריך תפוגה</Label>
              <Input 
                type="date" dir="ltr"
                value={form.expiresAt}
                onChange={e => setForm({...form, expiresAt: e.target.value})}
              />
            </div>
            <div className="flex items-center gap-3 pt-1">
              <Switch 
                id="coupon-active"
                checked={form.isActive} 
                onCheckedChange={v => setForm({...form, isActive: v})} 
              />
              <Label htmlFor="coupon-active" className="cursor-pointer">קופון פעיל</Label>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>ביטול</Button>
            <Button onClick={handleSave} disabled={createCoupon.isPending || updateCoupon.isPending}>
              {createCoupon.isPending || updateCoupon.isPending ? "שומר..." : "שמור"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
