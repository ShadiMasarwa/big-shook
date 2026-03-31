import { AdminLayout } from "@/components/admin-layout";
import { useListInventory, useAdjustStock, getListInventoryQueryKey } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

export default function AdminInventory() {
  const { data: inventory, isLoading } = useListInventory({});
  const adjustStock = useAdjustStock();
  const queryClient = useQueryClient();

  const [adjustments, setAdjustments] = useState<Record<number, string>>({});

  const handleAdjust = async (productId: number, warehouseId: number) => {
    const qty = parseInt(adjustments[productId] || "0");
    if (isNaN(qty) || qty === 0) return;

    try {
      await adjustStock.mutateAsync({
        data: {
          productId,
          warehouseId,
          quantity: qty,
          reason: "Manual adjustment from admin panel"
        }
      });
      toast({ title: "המלאי עודכן בהצלחה" });
      setAdjustments({ ...adjustments, [productId]: "" });
      queryClient.invalidateQueries({ queryKey: getListInventoryQueryKey() });
    } catch (e) {
      toast({ title: "שגיאה בעדכון מלאי", variant: "destructive" });
    }
  };

  return (
    <AdminLayout>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">ניהול מלאי</h1>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">מוצר</TableHead>
              <TableHead className="text-right">מחסן</TableHead>
              <TableHead className="text-center">כמות זמינה</TableHead>
              <TableHead className="text-center">שמור בהזמנות</TableHead>
              <TableHead className="text-center">סטטוס מלאי</TableHead>
              <TableHead className="text-left">עדכון מלאי (+/-)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
               [...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-12 mx-auto" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-12 mx-auto" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-20 mx-auto rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-40" /></TableCell>
                </TableRow>
              ))
            ) : !inventory || inventory.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">אין נתוני מלאי</TableCell>
              </TableRow>
            ) : (
              inventory.map((item: any) => (
                <TableRow key={`${item.productId}-${item.warehouseId}`}>
                  <TableCell className="font-medium">{item.product?.nameHe}</TableCell>
                  <TableCell>{item.warehouse?.nameHe}</TableCell>
                  <TableCell className="text-center font-bold">{item.availableQuantity}</TableCell>
                  <TableCell className="text-center text-muted-foreground">{item.reservedQuantity}</TableCell>
                  <TableCell className="text-center">
                    {item.isLowStock ? (
                      <Badge variant="destructive">מלאי נמוך</Badge>
                    ) : (
                      <Badge variant="outline" className="text-green-600 border-green-600">תקין</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-left">
                    <div className="flex items-center gap-2 justify-end">
                      <Input 
                        type="number" 
                        className="w-20 h-8 text-center" 
                        placeholder="0"
                        value={adjustments[item.productId] !== undefined ? adjustments[item.productId] : ""}
                        onChange={(e) => setAdjustments({...adjustments, [item.productId]: e.target.value})}
                      />
                      <Button 
                        size="sm" 
                        variant="secondary"
                        onClick={() => handleAdjust(item.productId, item.warehouseId)}
                        disabled={!adjustments[item.productId] || adjustments[item.productId] === "0"}
                      >
                        עדכן
                      </Button>
                    </div>
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
