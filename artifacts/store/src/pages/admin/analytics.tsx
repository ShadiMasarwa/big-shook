import { AdminLayout } from "@/components/admin-layout";
import { useGetAnalyticsDashboard, useGetRevenueChart, getGetRevenueChartQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPrice } from "@/lib/utils";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminAnalytics() {
  const { data: dashboard, isLoading: isLoadingDash } = useGetAnalyticsDashboard({ period: "month" });
  
  const { data: chartData, isLoading: isLoadingChart } = useGetRevenueChart({ period: "month" }, {
    query: {
      queryKey: getGetRevenueChartQueryKey({ period: "month" })
    }
  });

  if (isLoadingDash) {
    return <AdminLayout><div className="p-8">טוען נתונים...</div></AdminLayout>;
  }

  return (
    <AdminLayout>
      <h1 className="text-3xl font-bold mb-8">דוחות וסטטיסטיקה</h1>
      
      {dashboard && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">הכנסות (חודש)</CardTitle></CardHeader>
            <CardContent>
              <div className="text-3xl font-black">{formatPrice(dashboard.totalRevenue)}</div>
              <p className={`text-xs mt-1 font-bold ${dashboard.revenueChange > 0 ? 'text-green-500' : 'text-red-500'}`}>
                {dashboard.revenueChange > 0 ? '+' : ''}{dashboard.revenueChange}% מחודש שעבר
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">הזמנות (חודש)</CardTitle></CardHeader>
            <CardContent>
              <div className="text-3xl font-black">{dashboard.totalOrders}</div>
              <p className={`text-xs mt-1 font-bold ${dashboard.ordersChange > 0 ? 'text-green-500' : 'text-red-500'}`}>
                {dashboard.ordersChange > 0 ? '+' : ''}{dashboard.ordersChange}% מחודש שעבר
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">שווי הזמנה ממוצע</CardTitle></CardHeader>
            <CardContent>
              <div className="text-3xl font-black">{formatPrice(dashboard.averageOrderValue)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">יחס המרה</CardTitle></CardHeader>
            <CardContent>
              <div className="text-3xl font-black">{dashboard.conversionRate}%</div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="border-border">
        <CardHeader>
          <CardTitle>הכנסות לאורך זמן</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-96 w-full mt-4" dir="ltr">
            {isLoadingChart ? (
              <Skeleton className="w-full h-full rounded-xl" />
            ) : chartData && chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(val) => new Date(val).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' })} 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))" 
                    fontSize={12}
                    tickFormatter={(val) => `₪${val}`}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px', direction: 'rtl' }}
                    labelFormatter={(val) => new Date(val).toLocaleDateString('he-IL')}
                    formatter={(val: number) => [formatPrice(val), 'הכנסות']}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="revenue" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={3}
                    dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6 }} 
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                אין מספיק נתונים להצגת גרף
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </AdminLayout>
  );
}
