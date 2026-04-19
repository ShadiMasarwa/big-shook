import { Product } from "@workspace/api-zod/src/generated/types";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useCart } from "@/hooks/use-cart";
import { ShoppingCart, Heart } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { useAddToWishlist, getGetWishlistQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/use-toast";
import { ToastAction } from "@/components/ui/toast";

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const { addToCart } = useCart();
  const addToWishlist = useAddToWishlist();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const handleAddToCart = () => {
    addToCart({ productId: product.id, quantity: 1 })
      .then(() => toast({
        title: "נוסף לעגלה בהצלחה!",
        action: (
          <ToastAction altText="עבור לעגלה" onClick={() => setLocation("/cart")} className="bg-green-600 text-white border-green-600 hover:bg-green-700 hover:border-green-700">
            לעגלה
          </ToastAction>
        ),
      }))
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

  const productAny = product as any;
  const isVariable = productAny.productType === "variable";
  const priceRange = productAny.priceRange as { min: number; max: number } | null | undefined;
  const hasRange = isVariable && priceRange && priceRange.min !== priceRange.max;
  const hasDiscount = !isVariable && Boolean(product.salePrice);
  const displayPrice = product.salePrice ?? product.price;

  return (
    <Card
      className="flex flex-col h-full overflow-hidden hover-elevate transition-all duration-300 border-border"
      data-testid={`card-product-${product.id}`}
    >
      <div className="relative aspect-square overflow-hidden bg-muted">
        <Link href={`/product/${product.id}`} className="block w-full h-full" aria-label={`צפה במוצר: ${product.nameHe}`}>
          {product.images && product.images.length > 0 ? (
            <img
              src={product.images[0]}
              alt={product.nameHe}
              className="object-cover w-full h-full"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground" aria-hidden="true">אין תמונה</div>
          )}
        </Link>

        {/* Sale badge — decorative; price info is already announced via sr-only text below */}
        {hasDiscount && (
          <div className="sale-badge" aria-hidden="true">מבצע</div>
        )}

        <div className="absolute top-2 right-2 flex flex-col gap-2">
          <Button
            variant="secondary"
            size="icon"
            className="h-8 w-8 rounded-full shadow-sm"
            onClick={handleAddToWishlist}
            aria-label={`הוסף את ${product.nameHe} למועדפים`}
            data-testid={`btn-wishlist-${product.id}`}
          >
            <Heart className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>

      <CardContent className="flex-1 p-4 flex flex-col">
        <Link
          href={`/product/${product.id}`}
          className="hover:underline font-medium text-lg mb-1"
          data-testid={`link-product-${product.id}`}
        >
          {product.nameHe}
        </Link>
        <div className="text-sm text-muted-foreground mb-2 flex-1" aria-hidden="true">
          {product.descriptionHe?.substring(0, 60)}...
        </div>
        <div
          className="flex items-baseline gap-2 mt-auto"
          aria-label={
            hasRange
              ? `טווח מחירים: ${formatPrice(priceRange!.min)} עד ${formatPrice(priceRange!.max)}`
              : hasDiscount
              ? `מחיר מבצע: ${formatPrice(displayPrice)}, מחיר מקורי: ${formatPrice(product.price)}`
              : `מחיר: ${formatPrice(product.price)}`
          }
        >
          {hasRange ? (
            <span className="text-xl font-bold" aria-hidden="true" dir="ltr">
              {formatPrice(priceRange!.min)} - {formatPrice(priceRange!.max)}
            </span>
          ) : isVariable && priceRange ? (
            <span className="text-xl font-bold" aria-hidden="true">{formatPrice(priceRange.min)}</span>
          ) : hasDiscount ? (
            <>
              <span className="text-xl font-bold text-destructive" aria-hidden="true">{formatPrice(displayPrice)}</span>
              <span className="text-sm text-muted-foreground line-through" aria-hidden="true">{formatPrice(product.price)}</span>
            </>
          ) : (
            <span className="text-xl font-bold" aria-hidden="true">{formatPrice(product.price)}</span>
          )}
        </div>
      </CardContent>

      <CardFooter className="p-4 pt-0">
        <Button
          className="w-full font-bold"
          onClick={handleAddToCart}
          aria-label={`הוסף את ${product.nameHe} לעגלת הקניות`}
          data-testid={`btn-add-cart-${product.id}`}
        >
          <ShoppingCart className="ml-2 h-4 w-4" aria-hidden="true" />
          הוסף לעגלה
        </Button>
      </CardFooter>
    </Card>
  );
}
