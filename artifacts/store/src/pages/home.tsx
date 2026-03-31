import { Layout } from "@/components/layout";
import { ProductCard } from "@/components/product-card";
import { useGetFeaturedProducts, useGetTopSellingProducts, useListCategories } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";

export default function Home() {
  const { data: featuredProducts, isLoading: isLoadingFeatured } = useGetFeaturedProducts({ limit: 4 });
  const { data: topSellingProducts, isLoading: isLoadingTop } = useGetTopSellingProducts({ limit: 4 });
  const { data: categories, isLoading: isLoadingCategories } = useListCategories();

  return (
    <Layout>
      {/* Hero Banner */}
      <section className="bg-primary/10 py-16 md:py-24">
        <div className="container mx-auto px-4 flex flex-col md:flex-row items-center gap-8">
          <div className="flex-1 text-center md:text-right space-y-6">
            <h1 className="text-4xl md:text-6xl font-black text-foreground leading-tight">
              הטכנולוגיה של מחר, <br/>
              <span className="text-primary">כבר היום אצלך.</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-lg mx-auto md:mx-0">
              קנה עכשיו את המוצרים המובילים בעולם במחירים הטובים בישראל. משלוח מהיר עד הבית.
            </p>
            <div className="flex items-center justify-center md:justify-start gap-4 pt-4">
              <Button size="lg" asChild className="font-bold text-lg px-8">
                <Link href="/catalog">לקטלוג המלא</Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="font-bold text-lg px-8">
                <Link href="/catalog?sort=popular">הנמכרים ביותר</Link>
              </Button>
            </div>
          </div>
          <div className="flex-1 flex justify-center">
            {/* Placeholder for hero image */}
            <div className="w-full max-w-md aspect-square rounded-full bg-gradient-to-tr from-primary/20 to-primary/5 p-8 flex items-center justify-center">
              <div className="w-full h-full rounded-full bg-background shadow-xl flex items-center justify-center border-4 border-white">
                <span className="text-2xl font-bold text-muted-foreground opacity-50">Tech Store Hero</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Categories Grid */}
      <section className="py-16 container mx-auto px-4">
        <h2 className="text-2xl font-bold mb-8">קטגוריות מובילות</h2>
        {isLoadingCategories ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {categories?.slice(0, 6).map(category => (
              <Link 
                key={category.id} 
                href={`/catalog?categoryId=${category.id}`}
                className="flex flex-col items-center justify-center p-6 bg-card rounded-xl border border-border hover:border-primary hover:shadow-md transition-all text-center gap-4 group"
              >
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <span className="font-bold text-xl">{category.nameHe[0]}</span>
                </div>
                <span className="font-medium text-sm">{category.nameHe}</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Featured Products */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="flex items-end justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold mb-2">מוצרים מומלצים</h2>
              <p className="text-muted-foreground">הבחירות של הצוות שלנו עבורך</p>
            </div>
            <Link href="/catalog" className="text-primary font-medium flex items-center gap-1 hover:underline">
              הצג הכל <ArrowLeft className="h-4 w-4" />
            </Link>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {isLoadingFeatured ? (
              [...Array(4)].map((_, i) => <Skeleton key={i} className="h-[400px] rounded-xl" />)
            ) : (
              featuredProducts?.map(product => (
                <ProductCard key={product.id} product={product} />
              ))
            )}
          </div>
        </div>
      </section>

      {/* Top Selling Products */}
      <section className="py-16 container mx-auto px-4">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold mb-2">הנמכרים ביותר</h2>
            <p className="text-muted-foreground">המוצרים הפופולריים ביותר השבוע</p>
          </div>
          <Link href="/catalog?sort=popular" className="text-primary font-medium flex items-center gap-1 hover:underline">
            הצג הכל <ArrowLeft className="h-4 w-4" />
          </Link>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {isLoadingTop ? (
            [...Array(4)].map((_, i) => <Skeleton key={i} className="h-[400px] rounded-xl" />)
          ) : (
            topSellingProducts?.map(product => (
              <ProductCard key={product.id} product={product} />
            ))
          )}
        </div>
      </section>
    </Layout>
  );
}
