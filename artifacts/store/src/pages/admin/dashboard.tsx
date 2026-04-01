import { AdminLayout } from "@/components/admin-layout";
import { useGetAdminSummary, getGetAdminSummaryQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPrice } from "@/lib/utils";
import { DollarSign, ShoppingCart, Package, Users, AlertTriangle, Tag, Star, TrendingUp, Calendar } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

export default function AdminDashboard() {
  const { data: summary, isLoading } = useGetAdminSummary({
    query: {
      queryKey: getGetAdminSummaryQueryKey()
    }
  });

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[...Array(10)].map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (!summary) return null;

  const s = summary as any;

  const statCards = [
    { title: "הכנסות היום", value: formatPrice(s.todayRevenue ?? 0), icon: DollarSign, color: "text-green-500", bg: "bg-green-50" },
    { title: "הזמנות היום", value: (s.todayOrders ?? 0).toString(), icon: ShoppingCart, color: "text-blue-500", bg: "bg-blue-50" },
    { title: "הכנסות השבוע", value: formatPrice(s.weekRevenue ?? 0), icon: TrendingUp, color: "text-emerald-500", bg: "bg-emerald-50" },
    { title: "הזמנות השבוע", value: (s.weekOrders ?? 0).toString(), icon: ShoppingCart, color: "text-sky-500", bg: "bg-sky-50" },
    { title: "הכנסות החודש", value: formatPrice(s.monthRevenue ?? 0), icon: Calendar, color: "text-violet-500", bg: "bg-violet-50" },
    { title: "הזמנות החודש", value: (s.monthOrders ?? 0).toString(), icon: Calendar, color: "text-purple-500", bg: "bg-purple-50" },
    { title: "סה״כ מוצרים", value: (s.totalProducts ?? 0).toString(), icon: Package, color: "text-orange-500", bg: "bg-orange-50" },
    { title: "סה״כ לקוחות", value: (s.totalCustomers ?? 0).toString(), icon: Users, color: "text-pink-500", bg: "bg-pink-50" },
    { title: "הזמנות ממתינות", value: (s.pendingOrders ?? 0).toString(), icon: AlertTriangle, color: "text-yellow-500", bg: "bg-yellow-50" },
    { title: "התראות מלאי", value: (s.lowStockProducts ?? 0).toString(), icon: Package, color: "text-red-500", bg: "bg-red-50" },
  ];

  const activeCoupons: any[] = s.activeCouponsList ?? [];
  const totalEarned: number = s.totalLoyaltyPointsEarned ?? 0;
  const totalRedeemed: number = s.totalLoyaltyPointsRedeemed ?? 0;
  const netPoints: number = s.totalLoyaltyPoints ?? (totalEarned - totalRedeemed);

  const formatCouponValue = (type: string, value: number) => {
    if (type === "percentage") return `${value}%`;
    if (type === "free_shipping") return "משלוח חינם";
    return formatPrice(value);
  };

  const formatExpiry = (iso: string | null) => {
    if (!iso) return "ללא הגבלה";
    const d = new Date(iso);
    return d.toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "2-digit" });
  };

  const isExpiringSoon = (iso: string | null) => {
    if (!iso) return false;
    const diff = new Date(iso).getTime() - Date.now();
    return diff > 0 && diff < 7 * 24 * 60 * 60 * 1000;
  };

  return (
    <AdminLayout>
      <h1 className="text-3xl font-bold mb-8 text-foreground">לוח בקרה</h1>

      {/* Stat cards grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 mb-6">
        {statCards.map((card, i) => (
          <Card key={i} className="border-border shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.title}
              </CardTitle>
              <div className={`p-1.5 rounded-lg ${card.bg}`}>
                <card.icon className={`h-4 w-4 ${card.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-black">{card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Coupons + Points expanded cards */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Active Coupons card */}
        <Card className="border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-cyan-50">
                <Tag className="h-4 w-4 text-cyan-500" />
              </div>
              <CardTitle className="text-base font-bold">קופונים פעילים</CardTitle>
            </div>
            <Badge variant="secondary" className="text-xs font-bold">
              {activeCoupons.length} קופונים
            </Badge>
          </CardHeader>
          <CardContent className="pt-4">
            {activeCoupons.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">אין קופונים פעילים כרגע</p>
            ) : (
              <div className="space-y-2">
                {activeCoupons.map((c) => (
                  <div key={c.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                    <div className="flex items-center gap-2">
                      <code className="bg-muted px-2 py-0.5 rounded text-sm font-bold font-mono tracking-wide">{c.code}</code>
                      {isExpiringSoon(c.expiresAt) && (
                        <Badge variant="destructive" className="text-[10px] px-1.5 py-0">פג בקרוב</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="font-bold text-primary">{formatCouponValue(c.type, c.value)}</span>
                      <span className="text-muted-foreground text-xs">
                        {c.usageCount}/{c.usageLimit ?? "∞"} שימושים
                      </span>
                      <span className="text-muted-foreground text-xs hidden sm:block">
                        עד {formatExpiry(c.expiresAt)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Loyalty Points card */}
        <Card className="border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-amber-50">
                <Star className="h-4 w-4 text-amber-500" />
              </div>
              <CardTitle className="text-base font-bold">נקודות מועדון לקוחות</CardTitle>
            </div>
            <Badge variant="secondary" className="text-xs font-bold">
              {netPoints.toLocaleString("he-IL")} נקודות
            </Badge>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-green-50 rounded-xl p-3 text-center">
                <p className="text-xs text-muted-foreground mb-1">נצברו</p>
                <p className="text-xl font-black text-green-600">{totalEarned.toLocaleString("he-IL")}</p>
              </div>
              <div className="bg-red-50 rounded-xl p-3 text-center">
                <p className="text-xs text-muted-foreground mb-1">מומשו</p>
                <p className="text-xl font-black text-red-500">{totalRedeemed.toLocaleString("he-IL")}</p>
              </div>
              <div className="bg-primary/5 rounded-xl p-3 text-center border border-primary/20">
                <p className="text-xs text-muted-foreground mb-1">יתרה</p>
                <p className="text-xl font-black text-primary">{netPoints.toLocaleString("he-IL")}</p>
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>אחוז מימוש</span>
                <span>{totalEarned > 0 ? Math.round((totalRedeemed / totalEarned) * 100) : 0}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <div
                  className="bg-primary h-2 rounded-full transition-all duration-700"
                  style={{ width: `${totalEarned > 0 ? Math.min(100, Math.round((totalRedeemed / totalEarned) * 100)) : 0}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
