import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { ProductCard } from "@/components/product-card";
import { useListProducts } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Search, X } from "lucide-react";

export default function Catalog() {
  const [, navigate] = useLocation();
  const rawSearch = useSearch();

  const urlParams = new URLSearchParams(rawSearch);
  const urlCategoryId = urlParams.get("categoryId") ? Number(urlParams.get("categoryId")) : null;
  const urlParentId = urlParams.get("parentId") ? Number(urlParams.get("parentId")) : null;
  const urlSearch = urlParams.get("q") ?? "";
  const urlBrandId = urlParams.get("brandId") ? Number(urlParams.get("brandId")) : null;
  const urlMinPrice = urlParams.get("minPrice") ? Number(urlParams.get("minPrice")) : null;
  const urlMaxPrice = urlParams.get("maxPrice") ? Number(urlParams.get("maxPrice")) : null;
  const urlInStock = urlParams.get("inStock") === "true";
  const urlSort = urlParams.get("sort") ?? "popular";

  // All filter values come from URL — no local state needed
  const categoryId = urlCategoryId;
  const parentCategoryId = urlParentId;
  const search = urlSearch;
  const brandId = urlBrandId;
  const minPrice = urlMinPrice;
  const maxPrice = urlMaxPrice;
  const inStock = urlInStock;
  const sort = urlSort;

  const [searchInput, setSearchInput] = useState(urlSearch);
  // Controlled local state for price text inputs (navigate on Enter/blur)
  const [minPriceInput, setMinPriceInput] = useState(urlMinPrice != null ? String(urlMinPrice) : "");
  const [maxPriceInput, setMaxPriceInput] = useState(urlMaxPrice != null ? String(urlMaxPrice) : "");

  // Infinite scroll state
  const [page, setPage] = useState(1);
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Sync controlled inputs when URL changes (e.g. mobile drawer navigation)
  useEffect(() => {
    setSearchInput(urlSearch);
    setMinPriceInput(urlMinPrice != null ? String(urlMinPrice) : "");
    setMaxPriceInput(urlMaxPrice != null ? String(urlMaxPrice) : "");
  }, [rawSearch]);

  // Reset page whenever any filter changes (rawSearch covers everything)
  useEffect(() => {
    setPage(1);
    setAllProducts([]);
  }, [rawSearch]);

  // Helper: update one or more URL params, preserve the rest
  const updateFilter = (updates: Record<string, string | null>) => {
    const p = new URLSearchParams(rawSearch);
    p.delete("page");
    for (const [k, v] of Object.entries(updates)) {
      if (v === null || v === "") p.delete(k);
      else p.set(k, v);
    }
    navigate(`/catalog?${p.toString()}`);
  };

  const { data: productsData, isLoading, isFetching } = (useListProducts as any)({
    categoryId: categoryId ?? undefined,
    parentCategoryId: parentCategoryId ?? undefined,
    brandId: brandId ?? undefined,
    minPrice: minPrice ?? undefined,
    maxPrice: maxPrice ?? undefined,
    inStock: inStock ? true : undefined,
    sort,
    page,
    limit: 12,
    search: search || undefined,
  });

  // Append new page results to accumulated list
  useEffect(() => {
    if (!productsData?.products) return;
    if (page === 1) {
      setAllProducts(productsData.products);
    } else {
      setAllProducts(prev => [...prev, ...productsData.products]);
    }
  }, [productsData]);

  const hasMore = productsData ? page < productsData.totalPages : false;

  // IntersectionObserver — load next page when sentinel scrolls into view
  const handleIntersect = useCallback((entries: IntersectionObserverEntry[]) => {
    if (entries[0].isIntersecting && hasMore && !isFetching) {
      setPage(p => p + 1);
    }
  }, [hasMore, isFetching]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(handleIntersect, { threshold: 0.1 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [handleIntersect]);

  const { data: categories } = useQuery({
    queryKey: ["/api/categories"],
    queryFn: () => fetch("/api/categories").then(r => r.json()),
  });

  // Parse categories into parent / children structure
  const parentCategories = (categories ?? []).filter((c: any) => c.parentId === null || c.parentId === undefined);
  const childrenByParentId: Record<number, any[]> = {};
  (categories ?? []).forEach((c: any) => {
    if (c.parentId !== null && c.parentId !== undefined) {
      if (!childrenByParentId[c.parentId]) childrenByParentId[c.parentId] = [];
      childrenByParentId[c.parentId].push(c);
    }
  });

  // Hover state for sidebar parent category expansion
  const [hoveredParentId, setHoveredParentId] = useState<number | null>(null);

  // Brands query — filter by category context but NOT by current brandId
  const brandsQp = new URLSearchParams();
  if (categoryId) brandsQp.set("categoryId", String(categoryId));
  if (parentCategoryId) brandsQp.set("parentCategoryId", String(parentCategoryId));
  if (search) brandsQp.set("search", search);
  const brandsQs = brandsQp.toString();

  const { data: brands } = useQuery({
    queryKey: ["/api/brands", brandsQs],
    queryFn: async () => {
      const res = await fetch(`/api/brands${brandsQs ? `?${brandsQs}` : ""}`);
      return res.json() as Promise<{ id: number; nameHe: string; nameEn: string | null }[]>;
    },
  });

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchInput.trim();
    if (q) navigate(`/catalog?q=${encodeURIComponent(q)}`);
    else navigate("/catalog");
  };

  const clearSearch = () => {
    setSearchInput("");
    navigate("/catalog");
  };

  const handleCategoryClick = (id: number | null) => {
    if (id) navigate(`/catalog?categoryId=${id}`);
    else navigate("/catalog");
  };

  const handleParentCategoryClick = (parentId: number) => {
    navigate(`/catalog?parentId=${parentId}`);
  };

  const handlePriceApply = () => {
    updateFilter({ minPrice: minPriceInput || null, maxPrice: maxPriceInput || null });
  };

  const isInitialLoading = isLoading && page === 1;
  const isLoadingMore = isFetching && page > 1;

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
              
            </>
          )}
        </div>
      </div>

      <div className="container mx-auto px-4 pb-16 flex flex-col md:flex-row gap-8">
        {/* Sidebar Filters */}
        <aside className="w-full md:w-64 shrink-0 space-y-6 order-2 md:order-1">
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
            <h3 className="font-bold mb-3 border-b border-border pb-2">מותגים</h3>
            <ul className="space-y-2">
              <li>
                <button
                  className={`text-sm ${brandId === null ? "font-bold text-primary" : "text-muted-foreground hover:text-foreground"}`}
                  onClick={() => updateFilter({ brandId: null })}
                >
                  כל המותגים
                </button>
              </li>
              {brands?.map(brand => (
                <li key={brand.id}>
                  <button
                    className={`text-sm ${brandId === brand.id ? "font-bold text-primary" : "text-muted-foreground hover:text-foreground"}`}
                    onClick={() => updateFilter({ brandId: brand.id === brandId ? null : String(brand.id) })}
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
                value={minPriceInput}
                onChange={e => setMinPriceInput(e.target.value)}
                onBlur={handlePriceApply}
                onKeyDown={e => e.key === "Enter" && handlePriceApply()}
              />
              <span>-</span>
              <Input
                type="number"
                placeholder="עד"
                className="w-full"
                value={maxPriceInput}
                onChange={e => setMaxPriceInput(e.target.value)}
                onBlur={handlePriceApply}
                onKeyDown={e => e.key === "Enter" && handlePriceApply()}
              />
            </div>
          </div>

          <div className="flex items-center space-x-2 space-x-reverse">
            <Checkbox
              id="inStock"
              checked={inStock}
              onCheckedChange={c => updateFilter({ inStock: c === true ? "true" : null })}
            />
            <Label htmlFor="inStock" className="cursor-pointer">במלאי בלבד</Label>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 order-1 md:order-2">
          <div className="flex justify-between items-center mb-6">
            <p className="text-sm text-muted-foreground">
              {isInitialLoading
                ? "טוען מוצרים..."
                : `מציג ${allProducts.length} מתוך ${productsData?.total || 0} מוצרים`
              }
            </p>
            <div className="flex items-center gap-2">
              <Label className="whitespace-nowrap">מיון לפי:</Label>
              <Select value={sort} onValueChange={v => updateFilter({ sort: v === "popular" ? null : v })}>
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
            {isInitialLoading ? (
              [...Array(12)].map((_, i) => <Skeleton key={i} className="h-[380px] rounded-xl" />)
            ) : allProducts.length === 0 ? (
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
              allProducts.map(product => (
                <ProductCard key={product.id} product={product} />
              ))
            )}

            {/* Skeleton cards while loading the next page */}
            {isLoadingMore && (
              [...Array(4)].map((_, i) => <Skeleton key={`more-${i}`} className="h-[380px] rounded-xl" />)
            )}
          </div>

          {/* Sentinel — triggers next page load when scrolled into view */}
          <div ref={sentinelRef} className="h-12 flex items-center justify-center mt-6">
            {isLoadingMore && (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            )}
            {!hasMore && allProducts.length > 0 && !isInitialLoading && (
              <p className="text-sm text-muted-foreground">הגעת לסוף הקטלוג</p>
            )}
          </div>
        </main>
      </div>
    </Layout>
  );
}
