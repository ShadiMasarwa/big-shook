import { AdminLayout } from "@/components/admin-layout";
import { useListCoupons, getListCouponsQueryKey } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { formatPrice } from "@/lib/utils";

export default function AdminCoupons() {
  const { data, isLoading } = useListCoupons({});

  return (
    <AdminLayout>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">ניהול קופונים</h1>
        <Button>
          <Plus className="ml-2 h-4 w-4"/> קופון חדש
        </Button>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">קוד</TableHead>
              <TableHead className="text-right">סוג</TableHead>
              <TableHead className="text-right">ערך</TableHead>
              <TableHead className="text-center">מינימום הזמנה</TableHead>
              <TableHead className="text-center">סטטוס</TableHead>
              <TableHead className="text-center">פעמים שמומש</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
               [...Array(3)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16 mx-auto" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-16 mx-auto rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-8 mx-auto" /></TableCell>
                </TableRow>
              ))
            ) : !data?.coupons || data.coupons.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">אין קופונים</TableCell>
              </TableRow>
            ) : (
              data.coupons.map(coupon => (
                <TableRow key={coupon.id}>
                  <TableCell className="font-bold text-primary">{coupon.code}</TableCell>
                  <TableCell>
                    {coupon.type === 'percentage' ? 'אחוזים' : coupon.type === 'fixed' ? 'סכום קבוע' : 'משלוח חינם'}
                  </TableCell>
                  <TableCell className="font-medium">
                    {coupon.type === 'percentage' ? `${coupon.value}%` : coupon.type === 'fixed' ? formatPrice(coupon.value) : '-'}
                  </TableCell>
                  <TableCell className="text-center">{coupon.minOrderAmount ? formatPrice(coupon.minOrderAmount) : 'אין'}</TableCell>
                  <TableCell className="text-center">
                    {coupon.isActive ? <Badge variant="outline" className="text-green-600 border-green-600">פעיל</Badge> : <Badge variant="secondary">לא פעיל</Badge>}
                  </TableCell>
                  <TableCell className="text-center">{coupon.usedCount}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </AdminLayout>
  );
}
