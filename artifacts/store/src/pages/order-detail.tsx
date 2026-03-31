import { useParams, Link } from "wouter";
import { Layout } from "@/components/layout";
import { useGetOrder, getGetOrderQueryKey } from "@workspace/api-client-react";
import { formatPrice } from "@/lib/utils";
import { Package, ChevronRight, Clock, Truck, CheckCircle2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

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
      case "pending": return { label: "ממתין לאישור", icon: Clock, color: "text-yellow-600", bg: "bg-yellow-100" };
      case "confirmed": return { label: "אושר", icon: CheckCircle2, color: "text-blue-600", bg: "bg-blue-100" };
      case "processing": return { label: "בטיפול", icon: Package, color: "text-purple-600", bg: "bg-purple-100" };
      case "shipped": return { label: "נשלח", icon: Truck, color: "text-indigo-600", bg: "bg-indigo-100" };
      case "delivered": return { label: "נמסר", icon: CheckCircle2, color: "text-green-600", bg: "bg-green-100" };
      case "cancelled": return { label: "בוטל", icon: XCircle, color: "text-red-600", bg: "bg-red-100" };
      case "refunded": return { label: "זוכה", icon: XCircle, color: "text-gray-600", bg: "bg-gray-100" };
      default: return { label: status, icon: Package, color: "text-gray-600", bg: "bg-gray-100" };
    }
  };

  const statusDisplay = getStatusDisplay(order.status);
  const StatusIcon = statusDisplay.icon;

  return (
    <Layout>
      <div className="bg-muted py-6 mb-8">
        <div className="container mx-auto px-4">
          <Link href="/orders" className="text-sm font-medium text-muted-foreground flex items-center hover:text-primary mb-4 w-fit">
            <ChevronRight className="h-4 w-4" /> חזרה להזמנות
          </Link>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <h1 className="text-3xl font-bold flex items-center gap-3">
              הזמנה #{order.orderNumber}
            </h1>
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full font-bold ${statusDisplay.bg} ${statusDisplay.color}`}>
              <StatusIcon className="h-5 w-5" />
              {statusDisplay.label}
            </div>
          </div>
          <p className="text-muted-foreground mt-2">
            תאריך הזמנה: {new Date(order.createdAt).toLocaleDateString("he-IL", { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 pb-16 grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="p-4 border-b border-border bg-muted/30 font-bold">פריטים בהזמנה</div>
            <div className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">מוצר</TableHead>
                    <TableHead className="text-center">מחיר</TableHead>
                    <TableHead className="text-center">כמות</TableHead>
                    <TableHead className="text-left">סה"כ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.items.map(item => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="font-medium">{item.productName}</div>
                        {item.productSku && <div className="text-xs text-muted-foreground">מק"ט: {item.productSku}</div>}
                      </TableCell>
                      <TableCell className="text-center">{formatPrice(item.price)}</TableCell>
                      <TableCell className="text-center">{item.quantity}</TableCell>
                      <TableCell className="text-left font-bold">{formatPrice(item.subtotal)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="font-bold border-b border-border pb-4 mb-4">סיכום הזמנה</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">סכום ביניים</span>
                <span>{formatPrice(order.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">משלוח</span>
                <span>{order.shipping > 0 ? formatPrice(order.shipping) : 'חינם'}</span>
              </div>
              {order.couponDiscount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>הנחה (קופון {order.couponCode})</span>
                  <span>-{formatPrice(order.couponDiscount)}</span>
                </div>
              )}
              {order.loyaltyPointsUsed > 0 && (
                <div className="flex justify-between text-primary">
                  <span>שימוש בנקודות מועדון ({order.loyaltyPointsUsed})</span>
                  <span>-₪{order.loyaltyPointsUsed * 0.1}</span> {/* Approximation, backend handles exact math */}
                </div>
              )}
              <div className="flex justify-between font-black text-lg pt-4 border-t border-border mt-4">
                <span>סה"כ לתשלום</span>
                <span className="text-primary">{formatPrice(order.total)}</span>
              </div>
            </div>
            
            {order.loyaltyPointsEarned > 0 && (
              <div className="mt-6 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800 flex items-center justify-center gap-2">
                <Star className="h-4 w-4" />
                צברת {order.loyaltyPointsEarned} נקודות בהזמנה זו!
              </div>
            )}
          </div>

          {order.shippingAddress && (
            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="font-bold border-b border-border pb-4 mb-4">כתובת למשלוח</h3>
              <div className="text-sm space-y-1">
                <div>{(order.shippingAddress as any).firstName} {(order.shippingAddress as any).lastName}</div>
                <div>{(order.shippingAddress as any).street} {(order.shippingAddress as any).houseNumber}</div>
                <div>{(order.shippingAddress as any).city}, {(order.shippingAddress as any).zipCode || ''}</div>
                <div className="pt-2 text-muted-foreground">טלפון: {(order.shippingAddress as any).phone}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

// Simple internal table components
function Table({ children }: { children: React.ReactNode }) { return <div className="w-full text-sm">{children}</div>; }
function TableHeader({ children }: { children: React.ReactNode }) { return <div className="bg-muted/50 border-b border-border flex p-3">{children}</div>; }
function TableHead({ children, className = "" }: { children: React.ReactNode, className?: string }) { return <div className={`flex-1 font-bold text-muted-foreground ${className}`}>{children}</div>; }
function TableBody({ children }: { children: React.ReactNode }) { return <div>{children}</div>; }
function TableRow({ children }: { children: React.ReactNode }) { return <div className="flex p-3 border-b border-border last:border-0 items-center">{children}</div>; }
function TableCell({ children, className = "" }: { children: React.ReactNode, className?: string }) { return <div className={`flex-1 ${className}`}>{children}</div>; }
function Star({ className }: { className?: string }) { return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>; }
