import { Layout } from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import { useListOrders } from "@workspace/api-client-react";
import { Link, useLocation } from "wouter";
import { formatPrice } from "@/lib/utils";
import { Package, ChevronLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function Orders() {
  const { user } = useAuth();
  const [_, setLocation] = useLocation();

  if (!user) {
    setLocation("/auth");
    return null;
  }

  const { data, isLoading } = useListOrders({ userId: user.id });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":    return <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-200">ממתין לאישור</Badge>;
      case "confirmed":  return <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-200">אושר</Badge>;
      case "processing": return <Badge variant="outline" className="bg-purple-100 text-purple-800 border-purple-200">בטיפול</Badge>;
      case "shipped":    return <Badge variant="outline" className="bg-indigo-100 text-indigo-800 border-indigo-200">נשלח</Badge>;
      case "delivered":  return <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200">נמסר</Badge>;
      case "cancelled":  return <Badge variant="outline" className="bg-red-100 text-red-800 border-red-200">בוטל</Badge>;
      case "refunded":   return <Badge variant="outline" className="bg-gray-100 text-gray-600 border-gray-200">זוכה</Badge>;
      default:           return <Badge>{status}</Badge>;
    }
  };

  const isItemCancelled = (itemStatus: string) =>
    itemStatus === "cancelled" || itemStatus === "refunded";

  // Effective (active) total for an order, excluding cancelled items
  const getEffectiveTotal = (order: any): number => {
    const items        = order.items ?? [];
    const activeItems  = items.filter((it: any) => !isItemCancelled(it.itemStatus));
    const orderSubtotal = parseFloat(order.subtotal) || 0;
    const orderTotal    = parseFloat(order.total)    || 0;
    const orderShipping = parseFloat(order.shipping)  || 0;

    if (activeItems.length === items.length || orderSubtotal === 0) return orderTotal;

    const activeSubtotal = activeItems.reduce(
      (sum: number, it: any) => sum + (parseFloat(it.subtotal) || 0), 0
    );
    const proportion       = activeSubtotal / orderSubtotal;
    const discountedPortion = orderTotal - orderShipping;
    return activeItems.length > 0
      ? proportion * discountedPortion + orderShipping
      : 0;
  };

  return (
    <Layout>
      <div className="bg-muted py-8 mb-8">
        <div className="container mx-auto px-4">
          <h1 className="text-3xl font-bold">ההזמנות שלי</h1>
        </div>
      </div>

      <div className="container mx-auto px-4 pb-16 max-w-4xl">
        {isLoading ? (
          <div className="text-center py-12">טוען...</div>
        ) : !data || data.orders.length === 0 ? (
          <div className="text-center py-24 bg-card border border-border rounded-xl">
            <Package className="h-16 w-16 mx-auto text-muted-foreground mb-4 opacity-50" />
            <h2 className="text-2xl font-bold mb-2">אין הזמנות קודמות</h2>
            <p className="text-muted-foreground mb-6">עדיין לא ביצעת רכישות באתר.</p>
            <Link href="/catalog" className="text-primary font-bold hover:underline">התחל לקנות</Link>
          </div>
        ) : (
          <div className="space-y-4">
            {data.orders.map(order => {
              const items          = (order as any).items ?? [];
              const cancelledCount = items.filter((it: any) => isItemCancelled(it.itemStatus)).length;
              const hasPartial     = cancelledCount > 0 && cancelledCount < items.length;
              const effectiveTotal = getEffectiveTotal(order as any);

              return (
                <Link key={order.id} href={`/orders/${order.id}`}>
                  <div className="bg-card border border-border rounded-xl p-6 hover:border-primary hover:shadow-md transition-all cursor-pointer flex flex-col md:flex-row items-start md:items-center justify-between gap-4 group">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary shrink-0">
                        <Package className="h-6 w-6" />
                      </div>
                      <div>
                        <div className="font-bold text-lg">הזמנה #{order.orderNumber}</div>
                        <div className="text-sm text-muted-foreground">
                          {new Date(order.createdAt).toLocaleDateString("he-IL")}
                          {" · "}
                          {items.length - cancelledCount} פריטים פעילים
                          {cancelledCount > 0 && (
                            <span className="text-red-500"> · {cancelledCount} בוטלו</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center w-full md:w-auto justify-between md:justify-end gap-6 border-t md:border-0 border-border pt-4 md:pt-0 mt-4 md:mt-0">
                      {getStatusBadge(order.status)}

                      <div className="text-left w-28">
                        {hasPartial ? (
                          <>
                            <div className="font-black text-xl leading-tight">{formatPrice(effectiveTotal)}</div>
                            <div className="text-xs text-muted-foreground line-through">{formatPrice(order.total)}</div>
                          </>
                        ) : (
                          <div className="font-black text-xl">{formatPrice(effectiveTotal)}</div>
                        )}
                      </div>

                      <ChevronLeft className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors hidden md:block" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
