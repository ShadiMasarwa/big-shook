import { AdminLayout } from "@/components/admin-layout";
import { useListProducts, useDeleteProduct, getListProductsQueryKey, useListCategories } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link, useLocation } from "wouter";
import { Plus, Edit, Trash2, CheckCircle, XCircle, Search, X, Copy } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { toast } from "@/components/ui/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { useSuppliers } from "@/hooks/use-suppliers";
import { useState, useCallback } from "react";
import { useDebouncedCallback } from "use-debounce";

const ALL = "all";

export default function AdminProducts() {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [duplicatingId, setDuplicatingId] = useState<number | null>(null);

  const [nameSearch, setNameSearch] = useState("");
  const [skuSearch, setSkuSearch] = useState("");
  const [categoryId, setCategoryId] = useState(ALL);
  const [supplierId, setSupplierId] = useState(ALL);
  const [activeStatus, setActiveStatus] = useState(ALL);
  const [stockStatus, setStockStatus] = useState(ALL);

  const [debouncedName, setDebouncedName] = useState("");
  const [debouncedSku, setDebouncedSku] = useState("");

  const debounceNameSearch = useDebouncedCallback((v: string) => setDebouncedName(v), 350);
  const debounceSkuSearch = useDebouncedCallback((v: string) => setDebouncedSku(v), 350);

  const params = {
    admin: true,
    limit: 200,
    ...(debouncedName ? { search: debouncedName } : {}),
    ...(debouncedSku ? { sku: debouncedSku } : {}),
    ...(categoryId !== ALL ? { categoryId: parseInt(categoryId) } : {}),
    ...(supplierId !== ALL ? { supplierId: parseInt(supplierId) } : {}),
    ...(activeStatus !== ALL ? { isActive: activeStatus === "true" } : {}),
    ...(stockStatus === "out" ? { outOfStock: true } : stockStatus === "in" ? { inStock: true } : {}),
  };

  const { data, isLoading } = useListProducts(params);
  const deleteProduct = useDeleteProduct();
  const { data: suppliers } = useSuppliers();
  const { data: categories } = useListCategories();
  const supplierMap = Object.fromEntries((suppliers ?? []).map(s => [s.id, s]));

  const hasFilters = nameSearch || skuSearch || categoryId !== ALL || supplierId !== ALL || activeStatus !== ALL || stockStatus !== ALL;

  const clearFilters = useCallback(() => {
    setNameSearch("");
    setSkuSearch("");
    setCategoryId(ALL);
    setSupplierId(ALL);
    setActiveStatus(ALL);
    setStockStatus(ALL);
    setDebouncedName("");
    setDebouncedSku("");
  }, []);

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

  const handleDuplicate = async (id: number) => {
    setDuplicatingId(id);
    try {
      const token = localStorage.getItem("token") ?? "";
      const res = await fetch(`/api/products/${id}/duplicate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("שגיאה");
      const newProduct = await res.json();
      toast({ title: "המוצר שוכפל בהצלחה" });
      queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
      setLocation(`/admin/products/${newProduct.id}/edit`);
    } catch (e) {
      toast({ title: "שגיאה בשכפול מוצר", variant: "destructive" });
    } finally {
      setDuplicatingId(null);
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

      <div className="bg-card border border-border rounded-xl p-4 mb-4 flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1 min-w-[180px] flex-1">
          <label className="text-xs text-muted-foreground font-medium">חיפוש לפי שם</label>
          <div className="relative">
            <Search className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              className="pr-8"
              placeholder="שם מוצר..."
              value={nameSearch}
              onChange={e => { setNameSearch(e.target.value); debounceNameSearch(e.target.value); }}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1 min-w-[150px]">
          <label className="text-xs text-muted-foreground font-medium">מק"ט</label>
          <div className="relative">
            <Search className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              className="pr-8"
              placeholder='מק"ט...'
              value={skuSearch}
              onChange={e => { setSkuSearch(e.target.value); debounceSkuSearch(e.target.value); }}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1 min-w-[150px]">
          <label className="text-xs text-muted-foreground font-medium">קטגוריה</label>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger><SelectValue placeholder="כל הקטגוריות" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>כל הקטגוריות</SelectItem>
              {(categories ?? []).map(c => (
                <SelectItem key={c.id} value={String(c.id)}>{c.nameHe}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1 min-w-[150px]">
          <label className="text-xs text-muted-foreground font-medium">ספק</label>
          <Select value={supplierId} onValueChange={setSupplierId}>
            <SelectTrigger><SelectValue placeholder="כל הספקים" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>כל הספקים</SelectItem>
              {(suppliers ?? []).map(s => (
                <SelectItem key={s.id} value={String(s.id)}>{s.companyName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1 min-w-[130px]">
          <label className="text-xs text-muted-foreground font-medium">סטטוס</label>
          <Select value={activeStatus} onValueChange={setActiveStatus}>
            <SelectTrigger><SelectValue placeholder="הכל" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>הכל</SelectItem>
              <SelectItem value="true">פעיל</SelectItem>
              <SelectItem value="false">לא פעיל</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1 min-w-[130px]">
          <label className="text-xs text-muted-foreground font-medium">מלאי</label>
          <Select value={stockStatus} onValueChange={setStockStatus}>
            <SelectTrigger><SelectValue placeholder="הכל" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>הכל</SelectItem>
              <SelectItem value="in">במלאי</SelectItem>
              <SelectItem value="out">אזל מהמלאי</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="self-end gap-1 text-muted-foreground">
            <X className="h-4 w-4" /> נקה סינון
          </Button>
        )}
      </div>

      <div className="text-sm text-muted-foreground mb-2 px-1">
        {!isLoading && (
          <span>{data?.total ?? 0} מוצרים{hasFilters ? " (מסונן)" : ""}</span>
        )}
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
                  <TableCell><Skeleton className="h-4 w-20 mx-auto" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-8 mx-auto" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-20" /></TableCell>
                </TableRow>
              ))
            ) : data?.products.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                  {hasFilters ? "לא נמצאו מוצרים התואמים לחיפוש" : "אין מוצרים. הוסף את המוצר הראשון שלך!"}
                </TableCell>
              </TableRow>
            ) : (
              data?.products.map((product) => (
                <TableRow key={product.id} className={!product.isActive ? "opacity-50" : ""}>
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
                  <TableCell className="text-center text-sm font-mono">{product.sku || '—'}</TableCell>
                  <TableCell className="text-center">{formatPrice(product.price)}</TableCell>
                  <TableCell className="text-center">
                    <span className={`inline-block px-2 py-0.5 rounded font-bold text-sm ${
                      product.stockQuantity === 0
                        ? "bg-red-100 text-red-800"
                        : product.stockQuantity <= 10
                        ? "bg-yellow-100 text-yellow-800"
                        : "bg-green-100 text-green-800"
                    }`}>
                      {product.stockQuantity}
                    </span>
                  </TableCell>
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
                      <Button variant="outline" size="icon" asChild title="עריכה">
                        <Link href={`/admin/products/${product.id}/edit`}><Edit className="h-4 w-4" /></Link>
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        title="שכפל מוצר"
                        disabled={duplicatingId === product.id}
                        onClick={() => handleDuplicate(product.id)}
                      >
                        <Copy className="h-4 w-4" />
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
