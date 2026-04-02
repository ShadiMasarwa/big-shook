import { Layout } from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import { useGetWishlist, useRemoveFromWishlist, getGetWishlistQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { ProductCard } from "@/components/product-card";
import { Heart, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function Wishlist() {
  const { user } = useAuth();
  const [_, setLocation] = useLocation();
  const queryClient = useQueryClient();

  if (!user) {
    setLocation("/auth");
    return null;
  }

  const { data: wishlist, isLoading } = useGetWishlist({
    query: { queryKey: getGetWishlistQueryKey() }
  });

  const removeMutation = useRemoveFromWishlist();

  const handleRemove = async (productId: number) => {
    await removeMutation.mutateAsync({ productId });
    queryClient.invalidateQueries({ queryKey: getGetWishlistQueryKey() });
  };

  return (
    <Layout>
      <div className="bg-muted py-8 mb-8">
        <div className="container mx-auto px-4">
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Heart className="h-8 w-8 text-destructive" />
            המועדפים שלי
          </h1>
        </div>
      </div>

      <div className="container mx-auto px-4 pb-16">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-[400px] rounded-xl" />)}
          </div>
        ) : !wishlist || wishlist.length === 0 ? (
          <div className="text-center py-24 bg-card border border-border rounded-xl">
            <Heart className="h-16 w-16 mx-auto text-muted-foreground mb-4 opacity-50" />
            <h2 className="text-2xl font-bold mb-2">אין פריטים במועדפים</h2>
            <p className="text-muted-foreground mb-6">מצאת מוצר שאהבת? לחץ על הלב כדי לשמור אותו כאן.</p>
            <Button asChild size="lg"><Link href="/catalog">חזרה לקטלוג</Link></Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {wishlist.map(item => (
              <div key={item.id} className="relative group">
                <ProductCard product={item.product as any} />
                <Button 
                  variant="destructive" 
                  size="icon" 
                  className="absolute top-2 left-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => handleRemove(item.productId)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
