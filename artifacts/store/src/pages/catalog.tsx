import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { ProductCard } from "@/components/product-card";
import { useListProducts, useListCategories } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, X } from "lucide-react";

export default function Catalog() {
  const [, navigate] = useLocation();
  const rawSearch = useSearch(); // reactive to ?param changes

  const urlParams = new URLSearchParams(rawSearch);
  const urlCategoryId = urlParams.get("categoryId") ? Number(urlParams.get("categoryId")) : null;
  const urlSearch = urlParams.get("q") ?? "";

  // Filters that come from the URL — derived directly (no useState needed)
  const categoryId = urlCategoryId;
  const search = urlSearch;

  // Filters that are local-only (not URL-driven)
  const [brandId, setBrandId] = useState<number | null>(null);
  const [minPrice, setMinPrice] = useState<number | null>(null);
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [inStock, setInStock] = useState<boolean>(false);
  const [sort, setSort] = useState<any>("popular");
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState(urlSearch);

  // Sync searchInput when URL search changes (e.g. from header)
  useEffect(() => {
    setSearchInput(urlSearch);
    setPage(1);
  }, [rawSearch]);

  const { data: productsData, isLoading } = useListProducts({
    categoryId: categoryId ?? undefined,
    brandId: brandId ?? undefined,
    minPrice: minPrice ?? undefined,
    maxPrice: maxPrice ?? undefined,
    inStock: inStock ? true : undefined,
    sort,
    page,
    limit: 12,
    search: search || undefined,
  });

  const { data: categories } = useListCategories();

  const brandsParams = new URLSearchParams();
  if (categoryId) brandsParams.set("categoryId", String(categoryId));
  if (search) brandsParams.set("search", search);
  if (minPrice) brandsParams.set("minPrice", String(minPrice));
  if (maxPrice) brandsParams.set("maxPrice", String(maxPrice));
  if (inStock) brandsParams.set("inStock", "true");
  const brandsQs = brandsParams.toString();

  const { data: brands } = useQuery({
    queryKey: ["/api/brands", brandsQs],
    queryFn: async () => {
      const res = await fetch(`/api/brands${brandsQs ? `?${brandsQs}` : ""}`);
      return res.json() as Promise<{ id: number; nameHe: string; nameEn: string | null }[]>;
    },
  });

  // Clear selected brand if it no longer appears in the filtered brands list
  useEffect(() => {
    if (brandId !== null && brands && !brands.some(b => b.id === brandId)) {
      setBrandId(null);
    }
  }, [brands, brandId]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchInput.trim();
    setPage(1);
    if (q) {
      navigate(`/catalog?q=${encodeURIComponent(q)}`);
    } else {
      navigate("/catalog");
    }
  };

  const clearSearch = () => {
    setSearchInput("");
    setPage(1);
    navigate("/catalog");
  };

  const handleCategoryClick = (id: number | null) => {
    setPage(1);
    if (id) {
      navigate(`/catalog?categoryId=${id}`);
    } else {
      navigate("/catalog");
    }
  };

  return (
    <Layout>
      <div className="bg-muted py-8 mb-8">
        <div className="container mx-auto px-4">
          {search ? (
            <>
              <h1 className="text-3xl font-bold">תוצאות חיפוש</h1>
              <p className="text-muted-foreground mt-2 flex items-center gap-2">
                מחפש: <span className="font-semibold text-foreground">"{search}"</span>
                <button onClick={clearSearch} className="text-xs text-destructive hover:underline flex items-center gap-1">
                  <X className="h-3 w-3" /> נקה חיפוש
                </button>
              </p>
            </>
          ) : (
            <>
              <h1 className="text-3xl font-bold">קטלוג מוצרים</h1>
              <p className="text-muted-foreground mt-2">כל מוצרי החשמל והטכנולוגיה במקום אחד</p>
            </>
          )}
        </div>
      </div>

      <div className="container mx-auto px-4 pb-16 flex flex-col md:flex-row gap-8">
        {/* Sidebar Filters */}
        <aside className="w-full md:w-64 shrink-0 space-y-6 order-2 md:order-1">
          {/* In-page search */}
          <form onSubmit={handleSearchSubmit} className="relative">
            <Input
              placeholder="חפש במוצרים..."
              className="w-full pr-10"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              data-testid="input-catalog-search"
            />
            <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2" aria-label="חפש">
              <Search className="h-4 w-4 text-muted-foreground hover:text-primary" />
            </button>
          </form>

          <div>
            <h3 className="font-bold mb-3 border-b border-border pb-2">קטגוריות</h3>
            <ul className="space-y-2">
              <li>
                <button
                  className={`text-sm ${categoryId === null ? "font-bold text-primary" : "text-muted-foreground hover:text-foreground"}`}
                  onClick={() => handleCategoryClick(null)}
                >
                  כל הקטגוריות
                </button>
              </li>
              {categories?.filter(c => c.parentId !== null && c.parentId !== undefined).map(cat => (
                <li key={cat.id}>
                  <button
                    className={`text-sm ${categoryId === cat.id ? "font-bold text-primary" : "text-muted-foreground hover:text-foreground"}`}
                    onClick={() => handleCategoryClick(cat.id)}
                  >
                    {cat.nameHe}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-bold mb-3 border-b border-border pb-2">מותגים</h3>
            <ul className="space-y-2">
              <li>
                <button
                  className={`text-sm ${brandId === null ? "font-bold text-primary" : "text-muted-foreground hover:text-foreground"}`}
                  onClick={() => setBrandId(null)}
                >
                  כל המותגים
                </button>
              </li>
              {brands?.map(brand => (
                <li key={brand.id}>
                  <button
                    className={`text-sm ${brandId === brand.id ? "font-bold text-primary" : "text-muted-foreground hover:text-foreground"}`}
                    onClick={() => setBrandId(brand.id)}
                  >
                    {brand.nameHe}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-bold mb-3 border-b border-border pb-2">מחיר</h3>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                placeholder="מ-"
                className="w-full"
                value={minPrice || ""}
                onChange={e => setMinPrice(e.target.value ? Number(e.target.value) : null)}
              />
              <span>-</span>
              <Input
                type="number"
                placeholder="עד"
                className="w-full"
                value={maxPrice || ""}
                onChange={e => setMaxPrice(e.target.value ? Number(e.target.value) : null)}
              />
            </div>
          </div>

          <div className="flex items-center space-x-2 space-x-reverse">
            <Checkbox
              id="inStock"
              checked={inStock}
              onCheckedChange={c => setInStock(c === true)}
            />
            <Label htmlFor="inStock" className="cursor-pointer">במלאי בלבד</Label>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 order-1 md:order-2">
          <div className="flex justify-between items-center mb-6">
            <p className="text-sm text-muted-foreground">
              מציג {productsData?.products.length || 0} מתוך {productsData?.total || 0} מוצרים
            </p>
            <div className="flex items-center gap-2">
              <Label className="whitespace-nowrap">מיון לפי:</Label>
              <Select value={sort} onValueChange={v => { setSort(v); setPage(1); }}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="בחר מיון" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="popular">הכי פופולרי</SelectItem>
                  <SelectItem value="newest">חדש ביותר</SelectItem>
                  <SelectItem value="price_asc">מחיר: מהנמוך לגבוה</SelectItem>
                  <SelectItem value="price_desc">מחיר: מהגבוה לנמוך</SelectItem>
                  <SelectItem value="rating">דירוג הגבוה ביותר</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {isLoading ? (
              [...Array(12)].map((_, i) => <Skeleton key={i} className="h-[380px] rounded-xl" />)
            ) : productsData?.products.length === 0 ? (
              <div className="col-span-full text-center py-20">
                <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground text-lg">לא נמצאו מוצרים התואמים את החיפוש.</p>
                {search && (
                  <Button variant="outline" className="mt-4" onClick={clearSearch}>
                    נקה חיפוש וצפה בכל המוצרים
                  </Button>
                )}
              </div>
            ) : (
              productsData?.products.map(product => (
                <ProductCard key={product.id} product={product} />
              ))
            )}
          </div>

          {productsData && productsData.totalPages > 1 && (
            <div className="flex justify-center mt-12 gap-2">
              <Button
                variant="outline"
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
              >
                הקודם
              </Button>
              {[...Array(productsData.totalPages)].map((_, i) => (
                <Button
                  key={i}
                  variant={page === i + 1 ? "default" : "outline"}
                  onClick={() => setPage(i + 1)}
                >
                  {i + 1}
                </Button>
              ))}
              <Button
                variant="outline"
                disabled={page === productsData.totalPages}
                onClick={() => setPage(p => p + 1)}
              >
                הבא
              </Button>
            </div>
          )}
        </main>
      </div>
    </Layout>
  );
}
