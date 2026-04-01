import { AdminLayout } from "@/components/admin-layout";
import { useListProducts, useDeleteProduct, getListProductsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Plus, Edit, Trash2, CheckCircle, XCircle } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { toast } from "@/components/ui/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { useSuppliers } from "@/hooks/use-suppliers";

export default function AdminProducts() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useListProducts({ limit: 50 });
  const deleteProduct = useDeleteProduct();
  const { data: suppliers } = useSuppliers();
  const supplierMap = Object.fromEntries((suppliers ?? []).map(s => [s.id, s]));

  const handleDelete = async (id: number) => {
    if (window.confirm("האם אתה בטוח שברצונך למחוק מוצר זה?")) {
      try {
        await deleteProduct.mutateAsync({ id });
        toast({ title: "המוצר נמחק בהצלחה" });
        queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
      } catch (e) {
        toast({ title: "שגיאה במחיקת מוצר", variant: "destructive" });
      }
    }
  };

  return (
    <AdminLayout>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">ניהול מוצרים</h1>
        <Button asChild>
          <Link href="/admin/products/new"><Plus className="ml-2 h-4 w-4"/> מוצר חדש</Link>
        </Button>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">תמונה</TableHead>
              <TableHead className="text-right">שם מוצר</TableHead>
              <TableHead className="text-center">מק"ט</TableHead>
              <TableHead className="text-center">מחיר</TableHead>
              <TableHead className="text-center">מלאי</TableHead>
              <TableHead className="text-center">ספק</TableHead>
              <TableHead className="text-center">פעיל</TableHead>
              <TableHead className="text-left">פעולות</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-12 w-12 rounded" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16 mx-auto" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16 mx-auto" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-12 mx-auto" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-8 mx-auto" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-20" /></TableCell>
                </TableRow>
              ))
            ) : data?.products.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">אין מוצרים. הוסף את המוצר הראשון שלך!</TableCell>
              </TableRow>
            ) : (
              data?.products.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>
                    <div className="w-12 h-12 bg-white rounded border border-border flex items-center justify-center overflow-hidden">
                      {product.images && product.images[0] ? (
                        <img src={product.images[0]} alt="" className="w-full h-full object-contain" />
                      ) : (
                        <span className="text-[10px] text-muted-foreground">אין</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{product.nameHe}</TableCell>
                  <TableCell className="text-center">{product.sku || '-'}</TableCell>
                  <TableCell className="text-center">{formatPrice(product.price)}</TableCell>
                  <TableCell className="text-center font-bold">{product.stockQuantity}</TableCell>
                  <TableCell className="text-center">
                    {(product as any).supplierId && supplierMap[(product as any).supplierId] ? (
                      <Link
                        href={`/admin/suppliers/${(product as any).supplierId}`}
                        className="text-primary hover:underline text-sm font-medium"
                      >
                        {supplierMap[(product as any).supplierId].companyName}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {product.isActive ? (
                      <CheckCircle className="h-5 w-5 text-green-500 mx-auto" />
                    ) : (
                      <XCircle className="h-5 w-5 text-muted-foreground mx-auto" />
                    )}
                  </TableCell>
                  <TableCell className="text-left">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="outline" size="icon" asChild>
                        <Link href={`/admin/products/${product.id}/edit`}><Edit className="h-4 w-4" /></Link>
                      </Button>
                      <Button variant="outline" size="icon" className="text-destructive hover:bg-destructive hover:text-white" onClick={() => handleDelete(product.id)}>
                        <Trash2 className="h-4 w-4" />
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
