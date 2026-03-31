import { useState } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { ProductCard } from "@/components/product-card";
import { useListProducts, useListCategories, useListBrands } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

export default function Catalog() {
  const [location] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  
  const [categoryId, setCategoryId] = useState<number | null>(searchParams.get('categoryId') ? Number(searchParams.get('categoryId')) : null);
  const [brandId, setBrandId] = useState<number | null>(null);
  const [minPrice, setMinPrice] = useState<number | null>(null);
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [inStock, setInStock] = useState<boolean>(false);
  const [sort, setSort] = useState<any>("popular");
  const [page, setPage] = useState(1);

  const { data: productsData, isLoading } = useListProducts({
    categoryId, brandId, minPrice, maxPrice, inStock: inStock ? true : null, sort, page, limit: 12
  });
  
  const { data: categories } = useListCategories();
  const { data: brands } = useListBrands();

  return (
    <Layout>
      <div className="bg-muted py-8 mb-8">
        <div className="container mx-auto px-4">
          <h1 className="text-3xl font-bold">קטלוג מוצרים</h1>
          <p className="text-muted-foreground mt-2">כל מוצרי החשמל והטכנולוגיה במקום אחד</p>
        </div>
      </div>

      <div className="container mx-auto px-4 pb-16 flex flex-col md:flex-row gap-8">
        {/* Sidebar Filters */}
        <aside className="w-full md:w-64 shrink-0 space-y-6">
          <div>
            <h3 className="font-bold mb-3 border-b border-border pb-2">קטגוריות</h3>
            <ul className="space-y-2">
              <li>
                <button 
                  className={`text-sm ${categoryId === null ? 'font-bold text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                  onClick={() => setCategoryId(null)}
                >
                  כל הקטגוריות
                </button>
              </li>
              {categories?.map(cat => (
                <li key={cat.id}>
                  <button 
                    className={`text-sm ${categoryId === cat.id ? 'font-bold text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                    onClick={() => setCategoryId(cat.id)}
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
                  className={`text-sm ${brandId === null ? 'font-bold text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                  onClick={() => setBrandId(null)}
                >
                  כל המותגים
                </button>
              </li>
              {brands?.map(brand => (
                <li key={brand.id}>
                  <button 
                    className={`text-sm ${brandId === brand.id ? 'font-bold text-primary' : 'text-muted-foreground hover:text-foreground'}`}
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
                value={minPrice || ''}
                onChange={(e) => setMinPrice(e.target.value ? Number(e.target.value) : null)}
              />
              <span>-</span>
              <Input 
                type="number" 
                placeholder="עד" 
                className="w-full"
                value={maxPrice || ''}
                onChange={(e) => setMaxPrice(e.target.value ? Number(e.target.value) : null)}
              />
            </div>
          </div>

          <div className="flex items-center space-x-2 space-x-reverse">
            <Checkbox 
              id="inStock" 
              checked={inStock} 
              onCheckedChange={(c) => setInStock(c === true)}
            />
            <Label htmlFor="inStock" className="cursor-pointer">במלאי בלבד</Label>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1">
          <div className="flex justify-between items-center mb-6">
            <p className="text-sm text-muted-foreground">
              מציג {productsData?.products.length || 0} מתוך {productsData?.total || 0} מוצרים
            </p>
            <div className="flex items-center gap-2">
              <Label className="whitespace-nowrap">מיון לפי:</Label>
              <Select value={sort} onValueChange={setSort}>
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
              <div className="col-span-full text-center py-20 text-muted-foreground">
                לא נמצאו מוצרים התואמים את החיפוש.
              </div>
            ) : (
              productsData?.products.map(product => (
                <ProductCard key={product.id} product={product} />
              ))
            )}
          </div>

          {/* Pagination */}
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
