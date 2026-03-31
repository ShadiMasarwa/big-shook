import { AdminLayout } from "@/components/admin-layout";
import { useListOrders, useUpdateOrderStatus, getListOrdersQueryKey } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatPrice } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminOrders() {
  const { data, isLoading } = useListOrders({ limit: 50 });
  const updateStatus = useUpdateOrderStatus();
  const queryClient = useQueryClient();

  const handleStatusChange = async (orderId: number, newStatus: any) => {
    try {
      await updateStatus.mutateAsync({ id: orderId, data: { status: newStatus } });
      toast({ title: "סטטוס הזמנה עודכן" });
      queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
    } catch (e) {
      toast({ title: "שגיאה בעדכון סטטוס", variant: "destructive" });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending": return <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-200">ממתין</Badge>;
      case "confirmed": return <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-200">אושר</Badge>;
      case "processing": return <Badge variant="outline" className="bg-purple-100 text-purple-800 border-purple-200">בטיפול</Badge>;
      case "shipped": return <Badge variant="outline" className="bg-indigo-100 text-indigo-800 border-indigo-200">נשלח</Badge>;
      case "delivered": return <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200">נמסר</Badge>;
      case "cancelled": return <Badge variant="outline" className="bg-red-100 text-red-800 border-red-200">בוטל</Badge>;
      default: return <Badge>{status}</Badge>;
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
              <TableHead className="text-right">מספר הזמנה</TableHead>
              <TableHead className="text-right">תאריך</TableHead>
              <TableHead className="text-right">לקוח (ID)</TableHead>
              <TableHead className="text-center">סה"כ</TableHead>
              <TableHead className="text-center">סטטוס</TableHead>
              <TableHead className="text-left">שנה סטטוס</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
               [...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16 mx-auto" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-20 mx-auto rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-32" /></TableCell>
                </TableRow>
              ))
            ) : data?.orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">אין הזמנות</TableCell>
              </TableRow>
            ) : (
              data?.orders.map(order => (
                <TableRow key={order.id}>
                  <TableCell className="font-medium">#{order.orderNumber}</TableCell>
                  <TableCell>{new Date(order.createdAt).toLocaleString("he-IL")}</TableCell>
                  <TableCell>{order.userId || 'אורח'}</TableCell>
                  <TableCell className="text-center font-bold">{formatPrice(order.total)}</TableCell>
                  <TableCell className="text-center">{getStatusBadge(order.status)}</TableCell>
                  <TableCell className="text-left">
                    <Select value={order.status} onValueChange={(v) => handleStatusChange(order.id, v)}>
                      <SelectTrigger className="w-[140px] h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">ממתין</SelectItem>
                        <SelectItem value="confirmed">אושר</SelectItem>
                        <SelectItem value="processing">בטיפול</SelectItem>
                        <SelectItem value="shipped">נשלח</SelectItem>
                        <SelectItem value="delivered">נמסר</SelectItem>
                        <SelectItem value="cancelled">בוטל</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </AdminLayout>
  );
}
