import { useParams, Link } from "wouter";
import { Layout } from "@/components/layout";
import { useGetOrder, getGetOrderQueryKey } from "@workspace/api-client-react";
import { formatPrice } from "@/lib/utils";
import { Package, ChevronRight, Clock, Truck, CheckCircle2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export default function OrderDetail() {
  const { id } = useParams();
  const orderId = Number(id);

  const { data: order, isLoading } = useGetOrder(orderId, {
    query: {
      enabled: !!orderId,
      queryKey: getGetOrderQueryKey(orderId)
    }
  });

  if (isLoading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <Skeleton className="h-10 w-48 mb-8" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-2"><Skeleton className="h-64 rounded-xl" /></div>
            <div><Skeleton className="h-64 rounded-xl" /></div>
          </div>
        </div>
      </Layout>
    );
  }

  if (!order) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-16 text-center">הזמנה לא נמצאה</div>
      </Layout>
    );
  }

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case "pending":   return { label: "ממתין לאישור", icon: Clock,         color: "text-yellow-600", bg: "bg-yellow-100" };
      case "confirmed": return { label: "אושר",         icon: CheckCircle2,  color: "text-blue-600",   bg: "bg-blue-100"   };
      case "processing":return { label: "בטיפול",       icon: Package,       color: "text-purple-600", bg: "bg-purple-100" };
      case "shipped":   return { label: "נשלח",         icon: Truck,         color: "text-indigo-600", bg: "bg-indigo-100" };
      case "delivered": return { label: "נמסר",         icon: CheckCircle2,  color: "text-green-600",  bg: "bg-green-100"  };
      case "cancelled": return { label: "בוטל",         icon: XCircle,       color: "text-red-600",    bg: "bg-red-100"    };
      case "refunded":  return { label: "זוכה",         icon: XCircle,       color: "text-gray-600",   bg: "bg-gray-100"   };
      default:          return { label: status,          icon: Package,       color: "text-gray-600",   bg: "bg-gray-100"   };
    }
  };

  const getItemStatusBadge = (itemStatus: string) => {
    switch (itemStatus) {
      case "cancelled": return <Badge variant="outline" className="text-xs bg-red-50 text-red-600 border-red-200">בוטל</Badge>;
      case "refunded":  return <Badge variant="outline" className="text-xs bg-gray-50 text-gray-500 border-gray-200">זוכה</Badge>;
      default:          return null;
    }
  };

  const isItemCancelled = (itemStatus: string) =>
    itemStatus === "cancelled" || itemStatus === "refunded";

  // ── Effective totals (excluding cancelled / refunded items) ───────────────
  const activeItems   = order.items.filter(it => !isItemCancelled((it as any).itemStatus));
  const cancelledItems = order.items.filter(it => isItemCancelled((it as any).itemStatus));
  const hasCancelled  = cancelledItems.length > 0;
  const orderSubtotal = parseFloat(order.subtotal as unknown as string);
  const orderTotal    = parseFloat(order.total    as unknown as string);
  const orderShipping = parseFloat(order.shipping as unknown as string) || 0;

  // Active subtotal from non-cancelled items
  const activeSubtotal = activeItems.reduce(
    (sum, it) => sum + parseFloat(it.subtotal as unknown as string), 0
  );

  // Proportional discounts on active items (coupons, loyalty, etc.)
  // formula: activePaid = proportion_of_subtotal * (total - shipping) + shipping_if_any_active
  const discountedPortion = orderTotal - orderShipping; // total after discounts, excl. shipping
  const proportion = orderSubtotal > 0 ? activeSubtotal / orderSubtotal : 0;
  const effectiveTotal = activeItems.length > 0
    ? proportion * discountedPortion + orderShipping
    : 0;

  const couponDiscount     = parseFloat(order.couponDiscount as unknown as string) || 0;
  const loyaltyDiscount    = parseFloat((order as any).loyaltyPointsUsedAmount ?? order.discount as unknown as string) || 0;
  const activeCoupon       = hasCancelled ? couponDiscount  * proportion : couponDiscount;
  const activeLoyalty      = hasCancelled ? loyaltyDiscount * proportion : loyaltyDiscount;
  const earnedPoints       = hasCancelled
    ? Math.floor((order.loyaltyPointsEarned ?? 0) * proportion)
    : (order.loyaltyPointsEarned ?? 0);

  const statusDisplay = getStatusDisplay(order.status);
  const StatusIcon    = statusDisplay.icon;

  return (
    <Layout>
      <div className="bg-muted py-6 mb-8">
        <div className="container mx-auto px-4">
          <Link href="/orders" className="text-sm font-medium text-muted-foreground flex items-center hover:text-primary mb-4 w-fit">
            <ChevronRight className="h-4 w-4" /> חזרה להזמנות
          </Link>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <h1 className="text-3xl font-bold">הזמנה #{order.orderNumber}</h1>
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full font-bold ${statusDisplay.bg} ${statusDisplay.color}`}>
              <StatusIcon className="h-5 w-5" />
              {statusDisplay.label}
            </div>
          </div>
          <p className="text-muted-foreground mt-2">
            תאריך הזמנה: {new Date(order.createdAt).toLocaleDateString("he-IL", { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 pb-16 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* ── Items table ─────────────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="p-4 border-b border-border bg-muted/30 font-bold flex items-center justify-between">
              <span>פריטים בהזמנה</span>
              {hasCancelled && (
                <span className="text-xs font-normal text-muted-foreground">
                  {activeItems.length} פעילים · {cancelledItems.length} בוטלו
                </span>
              )}
            </div>

            {/* Active items */}
            {activeItems.map(item => (
              <div key={item.id} className="flex items-center p-4 border-b border-border last:border-0 gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{item.productName}</div>
                  {(item as any).productSku && (
                    <div className="text-xs text-muted-foreground">מק"ט: {(item as any).productSku}</div>
                  )}
                </div>
                <div className="text-sm text-muted-foreground w-20 text-center">{formatPrice(item.price)}</div>
                <div className="text-sm text-center w-12">× {item.quantity}</div>
                <div className="font-bold w-24 text-left">{formatPrice(item.subtotal)}</div>
              </div>
            ))}

            {/* Cancelled items — visually dimmed */}
            {hasCancelled && cancelledItems.map(item => (
              <div key={item.id} className="flex items-center p-4 border-b border-border last:border-0 gap-3 bg-muted/30 opacity-60">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium line-through text-muted-foreground">{item.productName}</span>
                    {getItemStatusBadge((item as any).itemStatus)}
                  </div>
                  {(item as any).productSku && (
                    <div className="text-xs text-muted-foreground">מק"ט: {(item as any).productSku}</div>
                  )}
                </div>
                <div className="text-sm text-muted-foreground w-20 text-center line-through">{formatPrice(item.price)}</div>
                <div className="text-sm text-center w-12 text-muted-foreground">× {item.quantity}</div>
                <div className="font-bold w-24 text-left text-muted-foreground line-through">{formatPrice(item.subtotal)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Summary sidebar ──────────────────────────────────────────────── */}
        <div className="space-y-6">
          <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="font-bold border-b border-border pb-4 mb-4">סיכום הזמנה</h3>
            <div className="space-y-3 text-sm">

              <div className="flex justify-between">
                <span className="text-muted-foreground">סכום ביניים</span>
                <span>{formatPrice(activeSubtotal)}</span>
              </div>

              {hasCancelled && (
                <div className="flex justify-between text-red-500">
                  <span>פריטים שבוטלו ({cancelledItems.length})</span>
                  <span>
                    -{formatPrice(cancelledItems.reduce(
                      (s, it) => s + parseFloat(it.subtotal as unknown as string), 0
                    ))}
                  </span>
                </div>
              )}

              <div className="flex justify-between">
                <span className="text-muted-foreground">משלוח</span>
                <span>{orderShipping > 0 ? formatPrice(orderShipping) : "חינם"}</span>
              </div>

              {activeCoupon > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>הנחה{order.couponCode ? ` (קופון ${order.couponCode})` : ""}</span>
                  <span>-{formatPrice(activeCoupon)}</span>
                </div>
              )}

              {activeLoyalty > 0 && order.loyaltyPointsUsed > 0 && (
                <div className="flex justify-between text-primary">
                  <span>שימוש בנקודות מועדון ({order.loyaltyPointsUsed})</span>
                  <span>-{formatPrice(activeLoyalty)}</span>
                </div>
              )}

              <div className="flex justify-between font-black text-lg pt-4 border-t border-border mt-4">
                <span>סה"כ לתשלום</span>
                <span className="text-primary">{formatPrice(effectiveTotal)}</span>
              </div>

              {hasCancelled && order.status !== "cancelled" && order.status !== "refunded" && (
                <p className="text-xs text-muted-foreground text-center pt-1">
                  * הסכום המקורי היה {formatPrice(orderTotal)} — זיכוי על פריטים שבוטלו יחושב בנפרד
                </p>
              )}
            </div>

            {activeItems.length > 0 && earnedPoints > 0 && (
              <div className="mt-6 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800 flex items-center justify-center gap-2">
                <Star className="h-4 w-4" />
                צברת {earnedPoints} נקודות בהזמנה זו!
              </div>
            )}
          </div>

          {order.shippingAddress && (
            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="font-bold border-b border-border pb-4 mb-4">כתובת למשלוח</h3>
              <div className="text-sm space-y-1">
                <div>{(order.shippingAddress as any).firstName} {(order.shippingAddress as any).lastName}</div>
                <div>{(order.shippingAddress as any).fullName}</div>
                <div>{(order.shippingAddress as any).street} {(order.shippingAddress as any).houseNumber}</div>
                <div>{(order.shippingAddress as any).city}{(order.shippingAddress as any).zipCode ? `, ${(order.shippingAddress as any).zipCode}` : ""}</div>
                {(order.shippingAddress as any).phone && (
                  <div className="pt-2 text-muted-foreground">טלפון: {(order.shippingAddress as any).phone}</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

function Star({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  );
}
