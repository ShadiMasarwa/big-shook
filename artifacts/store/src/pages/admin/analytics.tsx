import { useState } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { useGetAnalyticsDashboard, useGetRevenueChart } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPrice } from "@/lib/utils";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";

type Period = "current-month" | "month" | "3months" | "year";

const PERIODS: { value: Period; label: string; cardLabel: string }[] = [
  { value: "current-month", label: "חודש נוכחי", cardLabel: "חודש נוכחי" },
  { value: "month",         label: "30 יום",      cardLabel: "30 יום אחרון" },
  { value: "3months",       label: "3 חודשים",    cardLabel: "3 חודשים אחרונים" },
  { value: "year",          label: "שנה",          cardLabel: "12 חודשים אחרונים" },
];

function tickFormatter(period: Period, val: string): string {
  const d = new Date(val);
  if (period === "year") {
    return d.toLocaleDateString("he-IL", { month: "short", year: "2-digit" });
  }
  if (period === "3months") {
    return d.toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit" });
  }
  return d.toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit" });
}

function labelFormatter(period: Period, val: string): string {
  const d = new Date(val);
  if (period === "year") {
    return d.toLocaleDateString("he-IL", { month: "long", year: "numeric" });
  }
  if (period === "3months") {
    const weekEnd = new Date(d.getTime() + 6 * 24 * 60 * 60 * 1000);
    return `${d.toLocaleDateString("he-IL")} – ${weekEnd.toLocaleDateString("he-IL")}`;
  }
  return d.toLocaleDateString("he-IL");
}

export default function AdminAnalytics() {
  const [period, setPeriod] = useState<Period>("current-month");

  const { data: dashboard, isLoading: isLoadingDash } = useGetAnalyticsDashboard(
    { period },
    { query: { queryKey: ["analytics-dashboard", period] } }
  );

  const { data: chartData, isLoading: isLoadingChart } = useGetRevenueChart(
    { period },
    { query: { queryKey: ["analytics-revenue", period] } }
  );

  const selectedPeriod = PERIODS.find(p => p.value === period)!;

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <h1 className="text-3xl font-bold">דוחות וסטטיסטיקה</h1>

        <div className="flex gap-1 bg-muted rounded-lg p-1">
          {PERIODS.map(p => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                period === p.value
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {isLoadingDash ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      ) : dashboard && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">הכנסות ({selectedPeriod.cardLabel})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black">{formatPrice(dashboard.totalRevenue)}</div>
              <p className={`text-xs mt-1 font-bold ${dashboard.revenueChange > 0 ? "text-green-500" : "text-red-500"}`}>
                {dashboard.revenueChange > 0 ? "+" : ""}{dashboard.revenueChange}% מהתקופה הקודמת
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">הזמנות ({selectedPeriod.cardLabel})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black">{dashboard.totalOrders}</div>
              <p className={`text-xs mt-1 font-bold ${dashboard.ordersChange > 0 ? "text-green-500" : "text-red-500"}`}>
                {dashboard.ordersChange > 0 ? "+" : ""}{dashboard.ordersChange}% מהתקופה הקודמת
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
          <CardTitle>הכנסות לאורך זמן — {selectedPeriod.cardLabel}</CardTitle>
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
                    tickFormatter={(val) => tickFormatter(period, val)}
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    interval={period === "3months" ? 1 : "preserveStartEnd"}
                  />
                  <YAxis
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickFormatter={(val) => `₪${val}`}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "8px", direction: "rtl" }}
                    labelFormatter={(val) => labelFormatter(period, val)}
                    formatter={(val: number) => [formatPrice(val), "הכנסות"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="hsl(var(--primary))"
                    strokeWidth={3}
                    dot={{ fill: "hsl(var(--primary))", strokeWidth: 2, r: 4 }}
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
