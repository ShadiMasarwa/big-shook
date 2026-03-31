import { AdminLayout } from "@/components/admin-layout";
import { useGetAdminSummary, getGetAdminSummaryQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPrice } from "@/lib/utils";
import { DollarSign, ShoppingCart, Package, Users, AlertTriangle, Tag, Star } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminDashboard() {
  const { data: summary, isLoading } = useGetAdminSummary({
    query: {
      queryKey: getGetAdminSummaryQueryKey()
    }
  });

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      </AdminLayout>
    );
  }

  if (!summary) return null;

  const cards = [
    { title: "הכנסות היום", value: formatPrice(summary.todayRevenue), icon: DollarSign, color: "text-green-500" },
    { title: "הזמנות היום", value: summary.todayOrders.toString(), icon: ShoppingCart, color: "text-blue-500" },
    { title: "סה״כ מוצרים", value: summary.totalProducts.toString(), icon: Package, color: "text-purple-500" },
    { title: "סה״כ לקוחות", value: summary.totalCustomers.toString(), icon: Users, color: "text-orange-500" },
    { title: "הזמנות ממתינות", value: summary.pendingOrders.toString(), icon: AlertTriangle, color: "text-yellow-500" },
    { title: "התראות מלאי", value: summary.lowStockProducts.toString(), icon: Package, color: "text-red-500" },
    { title: "קופונים פעילים", value: summary.activeCoupons.toString(), icon: Tag, color: "text-cyan-500" },
    { title: "נקודות מועדון", value: summary.totalLoyaltyPoints.toString(), icon: Star, color: "text-amber-500" },
  ];

  return (
    <AdminLayout>
      <h1 className="text-3xl font-bold mb-8 text-foreground">לוח בקרה</h1>
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((card, i) => (
          <Card key={i} className="border-border shadow-sm hover-elevate">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.title}
              </CardTitle>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black">{card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </AdminLayout>
  );
}
