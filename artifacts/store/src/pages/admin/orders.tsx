import { AdminLayout } from "@/components/admin-layout";
import { useListOrders } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatPrice } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocation } from "wouter";
import { ChevronLeft } from "lucide-react";

const STATUS_LABEL: Record<string, string> = {
  pending: "ממתין", confirmed: "אושר", processing: "בטיפול",
  shipped: "נשלח", delivered: "נמסר", cancelled: "בוטל", refunded: "זוכה",
};

const STATUS_COLOR: Record<string, string> = {
  pending:    "bg-yellow-100 text-yellow-800 border-yellow-200",
  confirmed:  "bg-blue-100 text-blue-800 border-blue-200",
  processing: "bg-purple-100 text-purple-800 border-purple-200",
  shipped:    "bg-indigo-100 text-indigo-800 border-indigo-200",
  delivered:  "bg-green-100 text-green-800 border-green-200",
  cancelled:  "bg-red-100 text-red-800 border-red-200",
  refunded:   "bg-gray-100 text-gray-700 border-gray-200",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={STATUS_COLOR[status] ?? ""}>
      {STATUS_LABEL[status] ?? status}
    </Badge>
  );
}

export default function AdminOrders() {
  const { data, isLoading } = useListOrders({ limit: 50 });
  const [, navigate] = useLocation();

  return (
    <AdminLayout>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">ניהול הזמנות</h1>
        {data && (
          <p className="text-sm text-muted-foreground">
            סה"כ {data.total.toLocaleString("he-IL")} הזמנות
          </p>
        )}
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-right w-48">מספר הזמנה</TableHead>
              <TableHead className="text-right">תאריך</TableHead>
              <TableHead className="text-right">שעה</TableHead>
              <TableHead className="text-right">לקוח</TableHead>
              <TableHead className="text-center">פריטים</TableHead>
              <TableHead className="text-center">הנחות</TableHead>
              <TableHead className="text-center">סה"כ</TableHead>
              <TableHead className="text-center">סטטוס</TableHead>
              <TableHead className="w-8" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [...Array(6)].map((_, i) => (
                <TableRow key={i}>
                  {[...Array(9)].map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : data?.orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                  אין הזמנות עדיין
                </TableCell>
              </TableRow>
            ) : (
              data?.orders.map(order => {
                const items = (order as any).items ?? [];
                const coupon = Number(order.couponDiscount ?? 0);
                const loyalty = Number(order.discount ?? 0);
                const totalDiscount = coupon + loyalty;

                // Effective total: 0 if whole order cancelled/refunded,
                // otherwise original total minus cancelled item subtotals
                const isTerminal = ["cancelled", "refunded"].includes(order.status);
                const cancelledSubtotal = items
                  .filter((it: any) => ["cancelled", "refunded"].includes(it.itemStatus))
                  .reduce((sum: number, it: any) => sum + Number(it.subtotal), 0);
                const effectiveTotal = isTerminal ? 0 : Math.max(0, Number(order.total) - cancelledSubtotal);

                return (
                  <TableRow
                    key={order.id}
                    className="cursor-pointer hover:bg-muted/40 transition-colors"
                    onClick={() => navigate(`/admin/orders/${order.id}`)}
                  >
                    <TableCell className="font-semibold text-primary">
                      #{order.orderNumber}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(order.createdAt).toLocaleDateString("he-IL")}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(order.createdAt).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}
                    </TableCell>
                    <TableCell className="text-sm">
                      {(order as any).customerName ?? (order.userId ? `לקוח #${order.userId}` : "אורח")}
                    </TableCell>
                    <TableCell className="text-center text-sm">
                      {items.length > 0 ? (
                        <span className="text-muted-foreground">{items.length}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {totalDiscount === 0 ? (
                        <span className="text-muted-foreground text-xs">—</span>
                      ) : (
                        <div className="flex flex-col gap-0.5 items-center text-xs">
                          {coupon > 0 && (
                            <span className="text-green-600 font-medium">קופון: {formatPrice(coupon)}</span>
                          )}
                          {loyalty > 0 && (
                            <span className="text-amber-600 font-medium">נקודות: {formatPrice(loyalty)}</span>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-center font-bold">
                      {formatPrice(effectiveTotal)}
                      {cancelledSubtotal > 0 && !isTerminal && (
                        <div className="text-xs text-muted-foreground line-through font-normal">
                          {formatPrice(Number(order.total))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <StatusBadge status={order.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <ChevronLeft className="h-4 w-4" />
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </AdminLayout>
  );
}
