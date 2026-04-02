import { useState } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { useListOrders, useUpdateOrderStatus, getListOrdersQueryKey, useGetProduct } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatPrice } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronDown, ChevronUp, Package, Star, Tag, Layers, Truck } from "lucide-react";
import { useLocation } from "wouter";

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

function ProductDetailDialog({ productId, open, onClose }: { productId: number; open: boolean; onClose: () => void }) {
  const { data: product, isLoading } = useGetProduct(productId, { query: { enabled: open && productId > 0 } });
  const [, navigate] = useLocation();

  const handleSupplierClick = () => {
    if (!product?.supplierId) return;
    onClose();
    navigate(`/admin/suppliers/${product.supplierId}`);
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {isLoading ? <Skeleton className="h-6 w-48" /> : product?.nameHe}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4 mt-2">
            <Skeleton className="h-48 w-full rounded-lg" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ) : product ? (
          <div className="space-y-5 mt-1">
            {/* Images */}
            {product.images && product.images.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {product.images.map((img, i) => (
                  <img
                    key={i}
                    src={img}
                    alt=""
                    className="h-40 w-40 object-contain rounded-lg border border-border bg-white shrink-0"
                    onError={e => (e.currentTarget.style.display = "none")}
                  />
                ))}
              </div>
            )}

            {/* Name + SKU */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">שם בעברית</p>
                <p className="font-semibold">{product.nameHe}</p>
              </div>
              {product.nameEn && (
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">שם באנגלית</p>
                  <p className="font-semibold" dir="ltr">{product.nameEn}</p>
                </div>
              )}
              {product.sku && (
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">מק"ט</p>
                  <p dir="ltr" className="font-mono text-sm">{product.sku}</p>
                </div>
              )}
            </div>

            {/* Description */}
            {product.descriptionHe && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">תיאור</p>
                <p className="text-sm text-muted-foreground leading-relaxed">{product.descriptionHe}</p>
              </div>
            )}

            {/* Price + Stock */}
            <div className="grid grid-cols-3 gap-4 bg-muted/30 rounded-lg p-3">
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-1">מחיר רגיל</p>
                <p className="font-bold text-lg">{formatPrice(product.price)}</p>
              </div>
              {product.salePrice && (
                <div className="text-center">
                  <p className="text-xs text-muted-foreground mb-1">מחיר מבצע</p>
                  <p className="font-bold text-lg text-green-600">{formatPrice(product.salePrice)}</p>
                </div>
              )}
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-1">מלאי</p>
                <p className={`font-bold text-lg ${product.stockQuantity === 0 ? "text-destructive" : ""}`}>
                  {product.stockQuantity}
                </p>
              </div>
            </div>

            {/* Rating + Status */}
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-1.5 text-sm">
                <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                <span className="font-medium">{parseFloat(String(product.ratingAverage)).toFixed(1)}</span>
                <span className="text-muted-foreground">({product.ratingCount} דירוגים)</span>
              </div>
              <Badge variant={product.isActive ? "default" : "secondary"}>
                {product.isActive ? "פעיל" : "לא פעיל"}
              </Badge>
              {product.isFeatured && <Badge variant="outline" className="border-yellow-300 text-yellow-700">מומלץ</Badge>}
            </div>

            {/* Supplier */}
            {product.supplierId && (
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm text-muted-foreground">ספק:</span>
                <button
                  type="button"
                  className="text-sm font-medium text-primary hover:underline"
                  onClick={handleSupplierClick}
                >
                  {(product as any).supplierName ?? `ספק #${product.supplierId}`}
                </button>
              </div>
            )}

            {/* Tags */}
            {product.tags && product.tags.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1"><Tag className="h-3 w-3" />תגיות</p>
                <div className="flex flex-wrap gap-1.5">
                  {product.tags.map(tag => (
                    <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Specs */}
            {product.specs && Object.keys(product.specs as object).length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1"><Layers className="h-3 w-3" />מפרט טכני</p>
                <div className="border border-border rounded-lg overflow-hidden text-sm">
                  {Object.entries(product.specs as Record<string, string>).map(([k, v]) => (
                    <div key={k} className="flex border-b border-border last:border-0">
                      <div className="w-1/3 px-3 py-2 bg-muted/40 font-medium">{k}</div>
                      <div className="flex-1 px-3 py-2">{String(v)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-muted-foreground text-center py-8">מוצר לא נמצא</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

function OrderItemsRow({ orderId, items, onItemStatusChange }: {
  orderId: number;
  items: OrderItem[];
  onItemStatusChange: (itemId: number, newStatus: string) => void;
}) {
  const [pendingItems, setPendingItems] = useState<Record<number, boolean>>({});
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);

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
    <>
    <TableRow className="bg-muted/30 hover:bg-muted/40">
      <TableCell colSpan={7} className="p-0">
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
                      <button
                        type="button"
                        className="font-medium text-primary hover:underline text-right"
                        onClick={() => setSelectedProductId(item.productId)}
                      >
                        {item.productName}
                      </button>
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
    {selectedProductId !== null && (
      <ProductDetailDialog
        productId={selectedProductId}
        open={selectedProductId !== null}
        onClose={() => setSelectedProductId(null)}
      />
    )}
  </>
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
              <TableHead className="text-center">הנחות</TableHead>
              <TableHead className="text-center">סה"כ</TableHead>
              <TableHead className="text-center">סטטוס</TableHead>
              <TableHead className="text-left">שנה סטטוס</TableHead>
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
            ) : data?.orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">אין הזמנות</TableCell>
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
                    <TableCell className="text-sm">
                      {(order as any).customerName ?? (order.userId ? `לקוח #${order.userId}` : 'אורח')}
                    </TableCell>
                    <TableCell className="text-center">
                      {(() => {
                        const coupon = order.couponDiscount ?? 0;
                        const loyalty = order.discount ?? 0;
                        const total = coupon + loyalty;
                        if (total === 0) return <span className="text-muted-foreground text-xs">—</span>;
                        return (
                          <div className="flex flex-col gap-0.5 items-center text-xs">
                            {coupon > 0 && (
                              <span className="text-green-600 font-medium">קופון: {formatPrice(coupon)}</span>
                            )}
                            {loyalty > 0 && (
                              <span className="text-amber-600 font-medium">נקודות: {formatPrice(loyalty)}</span>
                            )}
                          </div>
                        );
                      })()}
                    </TableCell>
                    <TableCell className="text-center font-bold">{formatPrice(order.total)}</TableCell>
                    <TableCell className="text-center"><StatusBadge status={order.status} /></TableCell>
                    <TableCell className="text-left">
                      <div className="flex justify-end">
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
                      </div>
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
                      <TableCell colSpan={7} className="text-center py-4 text-muted-foreground text-sm">
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
