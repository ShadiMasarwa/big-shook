import { useParams, Link } from "wouter";
import { AdminLayout } from "@/components/admin-layout";
import { useGetUser, useListOrders } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatPrice } from "@/lib/utils";
import { ArrowRight, Mail, Phone, CalendarDays, ShoppingBag, Star, CreditCard, User } from "lucide-react";

const ORDER_STATUSES: Record<string, { label: string; className: string }> = {
  pending:    { label: "ממתין",   className: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  confirmed:  { label: "אושר",    className: "bg-blue-100 text-blue-800 border-blue-200" },
  processing: { label: "בטיפול",  className: "bg-purple-100 text-purple-800 border-purple-200" },
  shipped:    { label: "נשלח",    className: "bg-indigo-100 text-indigo-800 border-indigo-200" },
  delivered:  { label: "נמסר",    className: "bg-green-100 text-green-800 border-green-200" },
  cancelled:  { label: "בוטל",    className: "bg-red-100 text-red-800 border-red-200" },
  refunded:   { label: "זוכה",    className: "bg-gray-100 text-gray-800 border-gray-200" },
};

const TIER_LABELS: Record<string, { label: string; className: string }> = {
  bronze: { label: "ברונזה", className: "bg-orange-100 text-orange-800 border-orange-200" },
  silver: { label: "כסף",   className: "bg-slate-100 text-slate-700 border-slate-300" },
  gold:   { label: "זהב",   className: "bg-yellow-100 text-yellow-800 border-yellow-300" },
  vip:    { label: "VIP",   className: "bg-purple-100 text-purple-800 border-purple-200" },
};

export default function AdminUserDetail() {
  const { id } = useParams<{ id: string }>();
  const userId = parseInt(id!, 10);

  const { data: user, isLoading: userLoading } = useGetUser(userId);
  const { data: ordersData, isLoading: ordersLoading } = useListOrders({ userId, limit: 100 });

  const tier = user ? TIER_LABELS[user.loyaltyTier] ?? { label: user.loyaltyTier, className: "" } : null;

  return (
    <AdminLayout>
      <div className="mb-6">
        <Link href="/admin/customers" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowRight className="h-4 w-4" />
          חזרה לרשימת לקוחות
        </Link>

        {userLoading ? (
          <div className="space-y-2 mt-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        ) : user ? (
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold">{user.firstName} {user.lastName}</h1>
              <p className="text-muted-foreground mt-1">{user.email}</p>
            </div>
            <Badge className={`text-sm px-3 py-1 border ${tier?.className}`}>
              {tier?.label}
            </Badge>
          </div>
        ) : (
          <h1 className="text-3xl font-bold text-destructive">משתמש לא נמצא</h1>
        )}
      </div>

      {!userLoading && user && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-1">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Star className="h-4 w-4 text-amber-500" /> נקודות מועדון
              </div>
              <div className="text-2xl font-bold text-amber-600">{user.loyaltyPoints.toLocaleString()}</div>
            </div>
            <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-1">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <ShoppingBag className="h-4 w-4 text-primary" /> הזמנות
              </div>
              <div className="text-2xl font-bold">{user.ordersCount}</div>
            </div>
            <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-1">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <CreditCard className="h-4 w-4 text-green-600" /> סה"כ קניות
              </div>
              <div className="text-2xl font-bold text-primary">{formatPrice(user.totalSpent)}</div>
            </div>
            <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-1">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <User className="h-4 w-4" /> סטטוס
              </div>
              <div className="text-lg font-semibold">
                {user.isActive ? (
                  <span className="text-green-600">פעיל</span>
                ) : (
                  <span className="text-destructive">לא פעיל</span>
                )}
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <div className="bg-card border border-border rounded-xl p-5">
              <h2 className="text-lg font-bold mb-4">פרטי קשר</h2>
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span>{user.email}</span>
                </div>
                {user.phone && (
                  <div className="flex items-center gap-3 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span dir="ltr">{user.phone}</span>
                  </div>
                )}
                <div className="flex items-center gap-3 text-sm">
                  <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span>נרשם: {new Date(user.createdAt).toLocaleDateString("he-IL", { year: "numeric", month: "long", day: "numeric" })}</span>
                </div>
              </div>
            </div>

            <div className="bg-card border border-border rounded-xl p-5">
              <h2 className="text-lg font-bold mb-4">תוכנית נאמנות</h2>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">דרגה</span>
                  <Badge className={`border ${tier?.className}`}>{tier?.label}</Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">נקודות צבורות</span>
                  <span className="font-bold text-amber-600">{user.loyaltyPoints.toLocaleString()} נק'</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">סה"כ רכישות</span>
                  <span className="font-bold">{formatPrice(user.totalSpent)}</span>
                </div>
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-xl font-bold mb-4">היסטוריית הזמנות</h2>
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">מספר הזמנה</TableHead>
                    <TableHead className="text-right">תאריך</TableHead>
                    <TableHead className="text-center">פריטים</TableHead>
                    <TableHead className="text-center">סטטוס</TableHead>
                    <TableHead className="text-center">נקודות</TableHead>
                    <TableHead className="text-left">סכום</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ordersLoading ? (
                    [...Array(3)].map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-8 mx-auto" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-16 mx-auto rounded-full" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-12 mx-auto" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      </TableRow>
                    ))
                  ) : !ordersData?.orders || ordersData.orders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                        אין הזמנות ללקוח זה
                      </TableCell>
                    </TableRow>
                  ) : (
                    ordersData.orders.map(order => {
                      const statusInfo = ORDER_STATUSES[order.status] ?? { label: order.status, className: "" };
                      return (
                        <TableRow key={order.id}>
                          <TableCell className="font-mono font-medium text-primary">
                            <Link href={`/admin/orders`} className="hover:underline">
                              #{order.orderNumber}
                            </Link>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(order.createdAt).toLocaleDateString("he-IL", { year: "numeric", month: "short", day: "numeric" })}
                          </TableCell>
                          <TableCell className="text-center">{order.items?.length ?? "—"}</TableCell>
                          <TableCell className="text-center">
                            <Badge className={`border text-xs ${statusInfo.className}`}>
                              {statusInfo.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center text-amber-600 font-medium">
                            {order.loyaltyPointsEarned > 0 ? `+${order.loyaltyPointsEarned}` : "—"}
                          </TableCell>
                          <TableCell className="text-left font-bold">{formatPrice(order.totalAmount)}</TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </>
      )}
    </AdminLayout>
  );
}
