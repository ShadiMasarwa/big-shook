import { Product } from "@workspace/api-zod/src/generated/types";
import { Link } from "wouter";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useCart } from "@/hooks/use-cart";
import { ShoppingCart, Heart } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { useAddToWishlist, getGetWishlistQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/use-toast";

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const { addToCart } = useCart();
  const addToWishlist = useAddToWishlist();
  const queryClient = useQueryClient();

  const handleAddToCart = () => {
    addToCart({ productId: product.id, quantity: 1 })
      .then(() => toast({ title: "נוסף לעגלה בהצלחה!" }))
      .catch(() => toast({ title: "שגיאה בהוספה לעגלה", variant: "destructive" }));
  };

  const handleAddToWishlist = () => {
    addToWishlist.mutateAsync({ data: { productId: product.id } })
      .then(() => {
        queryClient.invalidateQueries({ queryKey: getGetWishlistQueryKey() });
        toast({ title: "נוסף למועדפים בהצלחה!" });
      })
      .catch(() => toast({ title: "שגיאה בהוספה למועדפים", variant: "destructive" }));
  };

  return (
    <Card className="flex flex-col h-full overflow-hidden hover-elevate transition-all duration-300 border-border" data-testid={`card-product-${product.id}`}>
      <div className="relative aspect-square overflow-hidden bg-muted">
        <Link href={`/product/${product.id}`} className="block w-full h-full">
          {product.images && product.images.length > 0 ? (
            <img src={product.images[0]} alt={product.nameHe} className="object-cover w-full h-full" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">אין תמונה</div>
          )}
        </Link>
        {product.salePrice && (
          <div className="sale-badge">מבצע</div>
        )}
        <div className="absolute top-2 right-2 flex flex-col gap-2">
          <Button variant="secondary" size="icon" className="h-8 w-8 rounded-full shadow-sm" onClick={handleAddToWishlist} data-testid={`btn-wishlist-${product.id}`}>
            <Heart className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <CardContent className="flex-1 p-4 flex flex-col">
        <Link href={`/product/${product.id}`} className="hover:underline font-medium text-lg mb-1" data-testid={`link-product-${product.id}`}>
          {product.nameHe}
        </Link>
        <div className="text-sm text-muted-foreground mb-2 flex-1">
          {product.descriptionHe?.substring(0, 60)}...
        </div>
        <div className="flex items-baseline gap-2 mt-auto">
          {product.salePrice ? (
            <>
              <span className="text-xl font-bold text-destructive">{formatPrice(product.salePrice)}</span>
              <span className="text-sm text-muted-foreground line-through">{formatPrice(product.price)}</span>
            </>
          ) : (
            <span className="text-xl font-bold">{formatPrice(product.price)}</span>
          )}
        </div>
      </CardContent>
      <CardFooter className="p-4 pt-0">
        <Button className="w-full font-bold" onClick={handleAddToCart} data-testid={`btn-add-cart-${product.id}`}>
          <ShoppingCart className="ml-2 h-4 w-4" />
          הוסף לעגלה
        </Button>
      </CardFooter>
    </Card>
  );
}
