import { AdminLayout } from "@/components/admin-layout";
import { useListProducts, useDeleteProduct, getListProductsQueryKey, useListCategories, useListBrands } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Link, useLocation } from "wouter";
import { Plus, Edit, Trash2, CheckCircle, XCircle, Search, X, Copy, ChevronUp, ChevronDown, ChevronsUpDown, Pencil } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { toast } from "@/components/ui/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { useSuppliers } from "@/hooks/use-suppliers";
import { useState, useCallback, useMemo } from "react";
import { useDebouncedCallback } from "use-debounce";

type SortField = "nameHe" | "sku" | "price" | "stockQuantity" | "isActive";
type SortDir = "asc" | "desc";

function SortIcon({ field, sortField, sortDir }: { field: SortField; sortField: SortField; sortDir: SortDir }) {
  if (sortField !== field) return <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground/50 inline-block ms-1" />;
  return sortDir === "asc"
    ? <ChevronUp className="h-3.5 w-3.5 text-primary inline-block ms-1" />
    : <ChevronDown className="h-3.5 w-3.5 text-primary inline-block ms-1" />;
}

const ALL = "all";

const EMPTY_BULK = {
  price: "",
  salePrice: "",
  costPrice: "",
  deliveryCost: "",
  stockQuantity: "",
  brandId: "",
  supplierId: "",
  isActive: "",
  isFeatured: "",
};

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
  const [sortField, setSortField] = useState<SortField>("nameHe");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("asc"); }
  };

  const [debouncedName, setDebouncedName] = useState("");
  const [debouncedSku, setDebouncedSku] = useState("");
  const debounceNameSearch = useDebouncedCallback((v: string) => setDebouncedName(v), 350);
  const debounceSkuSearch = useDebouncedCallback((v: string) => setDebouncedSku(v), 350);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkForm, setBulkForm] = useState({ ...EMPTY_BULK });
  const [isBulkSaving, setIsBulkSaving] = useState(false);

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
  const { data: brands } = useListBrands();
  const supplierMap = Object.fromEntries((suppliers ?? []).map(s => [s.id, s]));

  const sortedProducts = useMemo(() => {
    const list = [...(data?.products ?? [])];
    list.sort((a, b) => {
      let av: any; let bv: any;
      if (sortField === "nameHe") {
        av = a.nameHe ?? ""; bv = b.nameHe ?? "";
        return sortDir === "asc" ? av.localeCompare(bv, "he") : bv.localeCompare(av, "he");
      }
      if (sortField === "sku") {
        av = a.sku ?? ""; bv = b.sku ?? "";
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      if (sortField === "price") { av = parseFloat(String(a.price)) || 0; bv = parseFloat(String(b.price)) || 0; }
      else if (sortField === "stockQuantity") { av = a.stockQuantity ?? 0; bv = b.stockQuantity ?? 0; }
      else if (sortField === "isActive") { av = a.isActive ? 1 : 0; bv = b.isActive ? 1 : 0; }
      return sortDir === "asc" ? av - bv : bv - av;
    });
    return list;
  }, [data?.products, sortField, sortDir]);

  const hasFilters = nameSearch || skuSearch || categoryId !== ALL || supplierId !== ALL || activeStatus !== ALL || stockStatus !== ALL;

  const clearFilters = useCallback(() => {
    setNameSearch(""); setSkuSearch(""); setCategoryId(ALL);
    setSupplierId(ALL); setActiveStatus(ALL); setStockStatus(ALL);
    setDebouncedName(""); setDebouncedSku("");
  }, []);

  // Selection helpers
  const allIds = sortedProducts.map(p => p.id);
  const allSelected = allIds.length > 0 && allIds.every(id => selectedIds.has(id));
  const someSelected = allIds.some(id => selectedIds.has(id)) && !allSelected;

  const toggleSelectAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(allIds));
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleDelete = async (id: number) => {
    if (window.confirm("האם אתה בטוח שברצונך למחוק מוצר זה?")) {
      try {
        await deleteProduct.mutateAsync({ id });
        toast({ title: "המוצר נמחק בהצלחה" });
        setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n; });
        queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
      } catch {
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
      if (!res.ok) throw new Error();
      const newProduct = await res.json();
      toast({ title: "המוצר שוכפל בהצלחה" });
      queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
      setLocation(`/admin/products/${newProduct.id}/edit`);
    } catch {
      toast({ title: "שגיאה בשכפול מוצר", variant: "destructive" });
    } finally {
      setDuplicatingId(null);
    }
  };

  const openBulkEdit = () => {
    setBulkForm({ ...EMPTY_BULK });
    setBulkDialogOpen(true);
  };

  const handleBulkSave = async () => {
    const patch: Record<string, any> = {};
    if (bulkForm.price !== "") patch.price = bulkForm.price;
    if (bulkForm.salePrice !== "") patch.salePrice = bulkForm.salePrice;
    if (bulkForm.costPrice !== "") patch.costPrice = bulkForm.costPrice;
    if (bulkForm.deliveryCost !== "") patch.deliveryCost = bulkForm.deliveryCost;
    if (bulkForm.stockQuantity !== "") patch.stockQuantity = bulkForm.stockQuantity;
    if (bulkForm.brandId !== "") patch.brandId = bulkForm.brandId;
    if (bulkForm.supplierId !== "") patch.supplierId = bulkForm.supplierId;
    if (bulkForm.isActive !== "") patch.isActive = bulkForm.isActive;
    if (bulkForm.isFeatured !== "") patch.isFeatured = bulkForm.isFeatured;

    if (Object.keys(patch).length === 0) {
      toast({ title: "אין שינויים", description: "לא הוזנו ערכים לעדכון", variant: "destructive" });
      return;
    }

    setIsBulkSaving(true);
    try {
      const token = localStorage.getItem("token") ?? "";
      const res = await fetch("/api/products/bulk-update", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ids: Array.from(selectedIds), patch }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "שגיאה");
      }
      const { updated } = await res.json();
      toast({ title: "עדכון בוצע בהצלחה", description: `${updated} מוצרים עודכנו` });
      setBulkDialogOpen(false);
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
    } catch (e: any) {
      toast({ title: "שגיאה", description: e.message, variant: "destructive" });
    } finally {
      setIsBulkSaving(false);
    }
  };

  const changedFieldCount = Object.values(bulkForm).filter(v => v !== "").length;

  return (
    <AdminLayout>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">ניהול מוצרים</h1>
        <Button asChild>
          <Link href="/admin/products/new"><Plus className="ml-2 h-4 w-4" /> מוצר חדש</Link>
        </Button>
      </div>

      {/* Filters */}
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

      {/* Info row + bulk action bar */}
      <div className="flex items-center justify-between mb-2 px-1 min-h-[32px]">
        <span className="text-sm text-muted-foreground">
          {!isLoading && <>{data?.total ?? 0} מוצרים{hasFilters ? " (מסונן)" : ""}</>}
        </span>
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-primary">{selectedIds.size} נבחרו</span>
            <Button size="sm" variant="outline" onClick={openBulkEdit} className="gap-1.5">
              <Pencil className="h-3.5 w-3.5" />
              עריכה מרוכזת
            </Button>
            <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => setSelectedIds(new Set())}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10 text-center">
                <Checkbox
                  checked={allSelected}
                  ref={(el: any) => { if (el) el.indeterminate = someSelected; }}
                  onCheckedChange={toggleSelectAll}
                  aria-label="בחר הכל"
                />
              </TableHead>
              <TableHead className="text-right">תמונה</TableHead>
              <TableHead className="text-right cursor-pointer select-none hover:text-primary" onClick={() => toggleSort("nameHe")}>
                שם מוצר<SortIcon field="nameHe" sortField={sortField} sortDir={sortDir} />
              </TableHead>
              <TableHead className="text-center cursor-pointer select-none hover:text-primary" onClick={() => toggleSort("sku")}>
                מק"ט<SortIcon field="sku" sortField={sortField} sortDir={sortDir} />
              </TableHead>
              <TableHead className="text-center cursor-pointer select-none hover:text-primary" onClick={() => toggleSort("price")}>
                מחיר<SortIcon field="price" sortField={sortField} sortDir={sortDir} />
              </TableHead>
              <TableHead className="text-center cursor-pointer select-none hover:text-primary" onClick={() => toggleSort("stockQuantity")}>
                מלאי<SortIcon field="stockQuantity" sortField={sortField} sortDir={sortDir} />
              </TableHead>
              <TableHead className="text-center">ספק</TableHead>
              <TableHead className="text-center cursor-pointer select-none hover:text-primary" onClick={() => toggleSort("isActive")}>
                פעיל<SortIcon field="isActive" sortField={sortField} sortDir={sortDir} />
              </TableHead>
              <TableHead className="text-left">פעולות</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-4 mx-auto rounded" /></TableCell>
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
            ) : sortedProducts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-10 text-muted-foreground">
                  {hasFilters ? "לא נמצאו מוצרים התואמים לחיפוש" : "אין מוצרים. הוסף את המוצר הראשון שלך!"}
                </TableCell>
              </TableRow>
            ) : (
              sortedProducts.map((product) => {
                const isSelected = selectedIds.has(product.id);
                return (
                  <TableRow
                    key={product.id}
                    className={`${!product.isActive ? "opacity-50" : ""} ${isSelected ? "bg-primary/5" : ""}`}
                  >
                    <TableCell className="text-center">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelect(product.id)}
                        aria-label={`בחר ${product.nameHe}`}
                      />
                    </TableCell>
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
                        product.stockQuantity === 0 ? "bg-red-100 text-red-800"
                        : product.stockQuantity <= 10 ? "bg-yellow-100 text-yellow-800"
                        : "bg-green-100 text-green-800"
                      }`}>
                        {product.stockQuantity}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      {(product as any).supplierId && supplierMap[(product as any).supplierId] ? (
                        <Link href={`/admin/suppliers/${(product as any).supplierId}`} className="text-primary hover:underline text-sm font-medium">
                          {supplierMap[(product as any).supplierId].companyName}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {product.isActive
                        ? <CheckCircle className="h-5 w-5 text-green-500 mx-auto" />
                        : <XCircle className="h-5 w-5 text-muted-foreground mx-auto" />}
                    </TableCell>
                    <TableCell className="text-left">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="outline" size="icon" asChild title="עריכה">
                          <Link href={`/admin/products/${product.id}/edit`}><Edit className="h-4 w-4" /></Link>
                        </Button>
                        <Button variant="outline" size="icon" title="שכפל מוצר" disabled={duplicatingId === product.id} onClick={() => handleDuplicate(product.id)}>
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="icon" className="text-destructive hover:bg-destructive hover:text-white" onClick={() => handleDelete(product.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Bulk Edit Dialog */}
      <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-4 w-4" />
              עריכה מרוכזת — {selectedIds.size} מוצרים
            </DialogTitle>
          </DialogHeader>

          <p className="text-sm text-muted-foreground -mt-1">
            שדות ריקים לא ישתנו. מלא רק את השדות שברצונך לעדכון.
          </p>

          <div className="grid grid-cols-2 gap-4 py-2">
            {/* Price */}
            <div className="space-y-1.5">
              <Label htmlFor="b-price">מחיר (₪)</Label>
              <Input
                id="b-price"
                type="number"
                min="0"
                step="0.01"
                placeholder="ללא שינוי"
                value={bulkForm.price}
                onChange={e => setBulkForm(p => ({ ...p, price: e.target.value }))}
              />
            </div>
            {/* Sale price */}
            <div className="space-y-1.5">
              <Label htmlFor="b-sale">מחיר מבצע (₪)</Label>
              <Input
                id="b-sale"
                type="number"
                min="0"
                step="0.01"
                placeholder="ללא שינוי"
                value={bulkForm.salePrice}
                onChange={e => setBulkForm(p => ({ ...p, salePrice: e.target.value }))}
              />
            </div>
            {/* Cost price */}
            <div className="space-y-1.5">
              <Label htmlFor="b-cost">מחיר עלות (₪)</Label>
              <Input
                id="b-cost"
                type="number"
                min="0"
                step="0.01"
                placeholder="ללא שינוי"
                value={bulkForm.costPrice}
                onChange={e => setBulkForm(p => ({ ...p, costPrice: e.target.value }))}
              />
            </div>
            {/* Delivery cost */}
            <div className="space-y-1.5">
              <Label htmlFor="b-delivery">עלות משלוח (₪)</Label>
              <Input
                id="b-delivery"
                type="number"
                min="0"
                step="0.01"
                placeholder="ללא שינוי"
                value={bulkForm.deliveryCost}
                onChange={e => setBulkForm(p => ({ ...p, deliveryCost: e.target.value }))}
              />
            </div>
            {/* Stock */}
            <div className="space-y-1.5">
              <Label htmlFor="b-stock">כמות במלאי</Label>
              <Input
                id="b-stock"
                type="number"
                min="0"
                step="1"
                placeholder="ללא שינוי"
                value={bulkForm.stockQuantity}
                onChange={e => setBulkForm(p => ({ ...p, stockQuantity: e.target.value }))}
              />
            </div>
            {/* Brand */}
            <div className="space-y-1.5">
              <Label>מותג</Label>
              <Select value={bulkForm.brandId || ALL} onValueChange={v => setBulkForm(p => ({ ...p, brandId: v === ALL ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="ללא שינוי" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>ללא שינוי</SelectItem>
                  {(brands ?? []).map((b: any) => (
                    <SelectItem key={b.id} value={String(b.id)}>{b.nameHe}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* Supplier */}
            <div className="space-y-1.5">
              <Label>ספק</Label>
              <Select value={bulkForm.supplierId || ALL} onValueChange={v => setBulkForm(p => ({ ...p, supplierId: v === ALL ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="ללא שינוי" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>ללא שינוי</SelectItem>
                  {(suppliers ?? []).map(s => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.companyName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* Active */}
            <div className="space-y-1.5">
              <Label>סטטוס פרסום</Label>
              <Select value={bulkForm.isActive || ALL} onValueChange={v => setBulkForm(p => ({ ...p, isActive: v === ALL ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="ללא שינוי" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>ללא שינוי</SelectItem>
                  <SelectItem value="true">פעיל</SelectItem>
                  <SelectItem value="false">לא פעיל</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* Featured */}
            <div className="space-y-1.5 col-span-2">
              <Label>מוצג בעמוד הבית</Label>
              <Select value={bulkForm.isFeatured || ALL} onValueChange={v => setBulkForm(p => ({ ...p, isFeatured: v === ALL ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="ללא שינוי" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>ללא שינוי</SelectItem>
                  <SelectItem value="true">כן</SelectItem>
                  <SelectItem value="false">לא</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="gap-2 flex-row-reverse sm:flex-row-reverse">
            <Button
              onClick={handleBulkSave}
              disabled={isBulkSaving || changedFieldCount === 0}
            >
              {isBulkSaving
                ? "שומר..."
                : changedFieldCount === 0
                ? "עדכן"
                : `עדכן ${changedFieldCount} ${changedFieldCount === 1 ? "שדה" : "שדות"} ב-${selectedIds.size} מוצרים`}
            </Button>
            <Button variant="outline" onClick={() => setBulkDialogOpen(false)}>ביטול</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
