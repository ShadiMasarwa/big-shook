import { useState } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { useListOrders, useUpdateOrderStatus, getListOrdersQueryKey } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatPrice } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { ChevronDown, ChevronUp, Package } from "lucide-react";

const ORDER_STATUSES = [
  { value: "pending",    label: "ממתין" },
  { value: "confirmed",  label: "אושר" },
  { value: "processing", label: "בטיפול" },
  { value: "shipped",    label: "נשלח" },
  { value: "delivered",  label: "נמסר" },
  { value: "cancelled",  label: "בוטל" },
  { value: "refunded",   label: "זוכה" },
];

function getStatusLabel(status: string) {
  return ORDER_STATUSES.find(s => s.value === status)?.label ?? status;
}

function StatusBadge({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    pending:    "bg-yellow-100 text-yellow-800 border-yellow-200",
    confirmed:  "bg-blue-100 text-blue-800 border-blue-200",
    processing: "bg-purple-100 text-purple-800 border-purple-200",
    shipped:    "bg-indigo-100 text-indigo-800 border-indigo-200",
    delivered:  "bg-green-100 text-green-800 border-green-200",
    cancelled:  "bg-red-100 text-red-800 border-red-200",
    refunded:   "bg-gray-100 text-gray-700 border-gray-200",
  };
  return (
    <Badge variant="outline" className={colorMap[status] ?? ""}>
      {getStatusLabel(status)}
    </Badge>
  );
}

function authFetch(path: string, options?: RequestInit) {
  const token = localStorage.getItem("token");
  return fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers ?? {}),
    },
  }).then(async r => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });
}

interface OrderItem {
  id: number;
  orderId: number;
  productId: number;
  productName: string;
  productSku: string | null;
  quantity: number;
  price: number;
  subtotal: number;
  itemStatus: string;
  productImages: string[];
  productSlug: string | null;
}

function OrderItemsRow({ orderId, items, onItemStatusChange }: {
  orderId: number;
  items: OrderItem[];
  onItemStatusChange: (itemId: number, newStatus: string) => void;
}) {
  const [pendingItems, setPendingItems] = useState<Record<number, boolean>>({});

  const handleItemStatus = async (itemId: number, newStatus: string) => {
    setPendingItems(p => ({ ...p, [itemId]: true }));
    try {
      await authFetch(`/api/orders/${orderId}/items/${itemId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ itemStatus: newStatus }),
      });
      onItemStatusChange(itemId, newStatus);
      toast({ title: "סטטוס פריט עודכן" });
    } catch {
      toast({ title: "שגיאה בעדכון סטטוס פריט", variant: "destructive" });
    } finally {
      setPendingItems(p => ({ ...p, [itemId]: false }));
    }
  };

  return (
    <TableRow className="bg-muted/30 hover:bg-muted/40">
      <TableCell colSpan={6} className="p-0">
        <div className="px-4 py-3 border-t border-border">
          <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">פריטי הזמנה</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground border-b border-border">
                <th className="text-right py-1.5 w-10" />
                <th className="text-right py-1.5 pr-2">מוצר</th>
                <th className="text-center py-1.5 w-16">כמות</th>
                <th className="text-center py-1.5 w-24">מחיר יח'</th>
                <th className="text-center py-1.5 w-24">סה"כ</th>
                <th className="text-right py-1.5 w-36">סטטוס פריט</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id} className="border-b border-border/50 last:border-0">
                  <td className="py-2 w-10">
                    <div className="h-9 w-9 rounded border border-border bg-white flex items-center justify-center overflow-hidden shrink-0">
                      {item.productImages?.[0] ? (
                        <img src={item.productImages[0]} alt="" className="h-full w-full object-contain" />
                      ) : (
                        <Package className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </td>
                  <td className="py-2 pr-2">
                    <div>
                      <Link
                        href={`/product/${item.productId}`}
                        className="font-medium text-primary hover:underline"
                        target="_blank"
                      >
                        {item.productName}
                      </Link>
                      {item.productSku && (
                        <p className="text-xs text-muted-foreground" dir="ltr">{item.productSku}</p>
                      )}
                    </div>
                  </td>
                  <td className="py-2 text-center font-medium">{item.quantity}</td>
                  <td className="py-2 text-center">{formatPrice(item.price)}</td>
                  <td className="py-2 text-center font-bold">{formatPrice(item.subtotal)}</td>
                  <td className="py-2">
                    <Select
                      value={item.itemStatus}
                      onValueChange={(v) => handleItemStatus(item.id, v)}
                      disabled={pendingItems[item.id]}
                    >
                      <SelectTrigger className="h-7 text-xs w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ORDER_STATUSES.map(s => (
                          <SelectItem key={s.value} value={s.value} className="text-xs">{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </TableCell>
    </TableRow>
  );
}

export default function AdminOrders() {
  const { data, isLoading } = useListOrders({ limit: 50 });
  const updateStatus = useUpdateOrderStatus();
  const queryClient = useQueryClient();
  const [expandedOrders, setExpandedOrders] = useState<Set<number>>(new Set());
  const [localItems, setLocalItems] = useState<Record<number, OrderItem[]>>({});

  const toggleOrder = (orderId: number, items: OrderItem[]) => {
    setExpandedOrders(prev => {
      const next = new Set(prev);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
        setLocalItems(li => ({ ...li, [orderId]: items }));
      }
      return next;
    });
  };

  const handleItemStatusChange = (orderId: number, itemId: number, newStatus: string) => {
    setLocalItems(li => ({
      ...li,
      [orderId]: (li[orderId] ?? []).map(item =>
        item.id === itemId ? { ...item, itemStatus: newStatus } : item
      ),
    }));
  };

  const handleStatusChange = async (orderId: number, newStatus: string) => {
    try {
      await updateStatus.mutateAsync({ id: orderId, data: { status: newStatus } });
      toast({ title: "סטטוס הזמנה עודכן" });
      queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
    } catch {
      toast({ title: "שגיאה בעדכון סטטוס", variant: "destructive" });
    }
  };

  return (
    <AdminLayout>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">ניהול הזמנות</h1>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-right w-40">מספר הזמנה</TableHead>
              <TableHead className="text-right">תאריך</TableHead>
              <TableHead className="text-right">לקוח</TableHead>
              <TableHead className="text-center">סה"כ</TableHead>
              <TableHead className="text-center">סטטוס</TableHead>
              <TableHead className="text-left">שנה סטטוס</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  {[...Array(6)].map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : data?.orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">אין הזמנות</TableCell>
              </TableRow>
            ) : (
              data?.orders.flatMap(order => {
                const items: OrderItem[] = (order as any).items ?? [];
                const isExpanded = expandedOrders.has(order.id);
                const displayItems = localItems[order.id] ?? items;

                return [
                  <TableRow
                    key={`order-${order.id}`}
                    className={isExpanded ? "bg-primary/5 border-b-0" : undefined}
                  >
                    <TableCell className="font-medium">
                      <button
                        onClick={() => toggleOrder(order.id, items)}
                        className="flex items-center gap-1.5 text-primary hover:underline font-semibold group"
                      >
                        {isExpanded
                          ? <ChevronUp className="h-4 w-4 text-primary shrink-0" />
                          : <ChevronDown className="h-4 w-4 text-muted-foreground group-hover:text-primary shrink-0" />
                        }
                        #{order.orderNumber}
                        {items.length > 0 && (
                          <span className="text-xs text-muted-foreground font-normal">
                            ({items.length} פריטים)
                          </span>
                        )}
                      </button>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(order.createdAt).toLocaleString("he-IL")}
                    </TableCell>
                    <TableCell className="text-sm">{order.userId ? `לקוח ${order.userId}` : 'אורח'}</TableCell>
                    <TableCell className="text-center font-bold">{formatPrice(order.total)}</TableCell>
                    <TableCell className="text-center"><StatusBadge status={order.status} /></TableCell>
                    <TableCell className="text-left">
                      <Select value={order.status} onValueChange={(v) => handleStatusChange(order.id, v)}>
                        <SelectTrigger className="w-[130px] h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ORDER_STATUSES.map(s => (
                            <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>,

                  isExpanded && items.length > 0 ? (
                    <OrderItemsRow
                      key={`items-${order.id}`}
                      orderId={order.id}
                      items={displayItems}
                      onItemStatusChange={(itemId, newStatus) =>
                        handleItemStatusChange(order.id, itemId, newStatus)
                      }
                    />
                  ) : isExpanded ? (
                    <TableRow key={`empty-${order.id}`} className="bg-muted/20">
                      <TableCell colSpan={6} className="text-center py-4 text-muted-foreground text-sm">
                        אין פריטים בהזמנה זו
                      </TableCell>
                    </TableRow>
                  ) : null,
                ].filter(Boolean);
              })
            )}
          </TableBody>
        </Table>
      </div>
    </AdminLayout>
  );
}
