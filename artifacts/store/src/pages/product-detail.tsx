import { useParams } from "wouter";
import { Layout } from "@/components/layout";
import { 
  useGetProduct, 
  useGetProductBySlug,
  getGetProductQueryKey, 
  getGetProductBySlugQueryKey,
  useGetRelatedProducts,
  useAddToWishlist,
  useTrackProductView,
  getGetWishlistQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useCart } from "@/hooks/use-cart";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShoppingCart, Heart, Check, Star, ChevronRight, ChevronLeft, Play } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { toast } from "@/components/ui/use-toast";
import { ProductCard } from "@/components/product-card";

export default function ProductDetail() {
  const params = useParams();
  const id = params.id ? Number(params.id) : null;
  const slug = params.slug;
  
  // Use either ID or Slug based on route
  const { data: productById, isLoading: isLoadingId } = useGetProduct(id!, {
    query: {
      enabled: !!id,
      queryKey: getGetProductQueryKey(id!)
    }
  });

  const { data: productBySlug, isLoading: isLoadingSlug } = useGetProductBySlug(slug!, {
    query: {
      enabled: !!slug,
      queryKey: getGetProductBySlugQueryKey(slug!)
    }
  });

  const product = id ? productById : productBySlug;
  const isLoading = id ? isLoadingId : isLoadingSlug;

  const productId = product?.id;
  const { data: relatedProducts } = useGetRelatedProducts(productId!, { limit: 4 }, {
    query: { enabled: !!productId }
  });
  
  const queryClient = useQueryClient();
  const { addToCart } = useCart();
  const addToWishlistMutation = useAddToWishlist();
  const trackView = useTrackProductView();
  
  const [quantity, setQuantity] = useState(1);
  const [activeIndex, setActiveIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const thumbsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (product) {
      trackView.mutateAsync({ data: { productId: product.id } }).catch(() => {});
      setActiveIndex(0);
    }
  }, [product?.id]);

  const images = product?.images ?? [];
  const videos = (product as any)?.videos ?? [] as string[];
  const mediaItems: { type: "image" | "video"; url: string }[] = [
    ...images.map((url: string) => ({ type: "image" as const, url })),
    ...videos.map((url: string) => ({ type: "video" as const, url })),
  ];
  const totalItems = mediaItems.length;

  const goTo = (idx: number, dir?: number) => {
    const next = (idx + totalItems) % totalItems;
    setDirection(dir ?? (next > activeIndex ? -1 : 1));
    setActiveIndex(next);
    thumbsRef.current?.children[next]?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  };

  const goPrev = () => goTo(activeIndex - 1, 1);
  const goNext = () => goTo(activeIndex + 1, -1);

  const handleAddToCart = async () => {
    if (!product) return;
    try {
      await addToCart({ productId: product.id, quantity });
      toast({ title: "המוצר נוסף לעגלה בהצלחה" });
    } catch (e) {
      toast({ title: "שגיאה בהוספה לעגלה", variant: "destructive" });
    }
  };

  const handleAddToWishlist = async () => {
    if (!product) return;
    try {
      await addToWishlistMutation.mutateAsync({ data: { productId: product.id } });
      queryClient.invalidateQueries({ queryKey: getGetWishlistQueryKey() });
      toast({ title: "המוצר נוסף למועדפים" });
    } catch (e) {
      toast({ title: "שגיאה בהוספה למועדפים", variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <Skeleton className="aspect-square rounded-xl" />
            <div className="space-y-4">
              <Skeleton className="h-10 w-2/3" />
              <Skeleton className="h-6 w-1/3" />
              <Skeleton className="h-24 w-full" />
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (!product) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-16 text-center">
          <h1 className="text-2xl font-bold">מוצר לא נמצא</h1>
        </div>
      </Layout>
    );
  }

  const slideVariants = {
    enter: (dir: number) => ({ x: dir * 60, opacity: 0, scale: 0.97 }),
    center: { x: 0, opacity: 1, scale: 1 },
    exit: (dir: number) => ({ x: dir * -60, opacity: 0, scale: 0.97 }),
  };

  return (
    <Layout>
      <div className="bg-muted/30 py-4 border-b border-border">
        <div className="container mx-auto px-4 text-sm text-muted-foreground flex gap-2">
          <span>דף הבית</span>
          <span>/</span>
          <span>קטלוג</span>
          <span>/</span>
          <span className="text-foreground font-medium">{product.nameHe}</span>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-16">
          {/* Images */}
          <div className="flex flex-col gap-4">
            {/* Main viewer */}
            <div className="relative aspect-square bg-white rounded-2xl border border-border overflow-hidden group">
              <AnimatePresence initial={false} custom={direction} mode="popLayout">
                <motion.div
                  key={activeIndex}
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  className="absolute inset-0 flex items-center justify-center p-6"
                >
                  {mediaItems[activeIndex]?.type === "video" ? (
                    <video
                      key={mediaItems[activeIndex].url}
                      src={mediaItems[activeIndex].url}
                      controls
                      className="max-w-full max-h-full rounded-lg"
                      style={{ maxHeight: "100%", maxWidth: "100%" }}
                    />
                  ) : mediaItems[activeIndex]?.url ? (
                    <img
                      src={mediaItems[activeIndex].url}
                      alt={`${product.nameHe} ${activeIndex + 1}`}
                      className="max-w-full max-h-full object-contain"
                    />
                  ) : (
                    <span className="text-muted-foreground">אין תמונה</span>
                  )}
                </motion.div>
              </AnimatePresence>

              {/* Arrow navigation — only when >1 item */}
              {totalItems > 1 && (
                <>
                  <button
                    onClick={goNext}
                    className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white/80 border border-border shadow-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white"
                    aria-label="הבא"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    onClick={goPrev}
                    className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white/80 border border-border shadow-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white"
                    aria-label="הקודם"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                  <div dir="ltr" className="absolute bottom-3 left-3 z-10 bg-black/50 text-white text-xs font-medium px-2 py-0.5 rounded-full">
                    {activeIndex + 1} / {totalItems}
                  </div>
                </>
              )}
            </div>

            {/* Thumbnail strip */}
            {totalItems > 1 && (
              <div ref={thumbsRef} className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {mediaItems.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => goTo(idx)}
                    className={`relative aspect-square w-20 shrink-0 rounded-lg border-2 bg-white flex items-center justify-center p-1.5 transition-all duration-200 overflow-hidden ${
                      activeIndex === idx
                        ? "border-primary shadow-md scale-105"
                        : "border-border hover:border-primary/50 opacity-70 hover:opacity-100"
                    }`}
                    aria-label={item.type === "video" ? `סרטון ${idx + 1}` : `תמונה ${idx + 1}`}
                  >
                    {activeIndex === idx && (
                      <motion.span
                        layoutId="thumb-indicator"
                        className="absolute inset-0 rounded-lg ring-2 ring-primary/30"
                        transition={{ type: "spring", stiffness: 500, damping: 35 }}
                      />
                    )}
                    {item.type === "video" ? (
                      <>
                        <video
                          src={item.url}
                          className="w-full h-full object-cover pointer-events-none"
                          muted
                          preload="metadata"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                          <div className="bg-black/50 rounded-full p-1">
                            <Play className="h-3 w-3 text-white fill-white" />
                          </div>
                        </div>
                      </>
                    ) : (
                      <img
                        src={item.url}
                        alt={`${product.nameHe} ${idx + 1}`}
                        className="max-w-full max-h-full object-contain"
                      />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex flex-col">
            {product.isFeatured && (
              <span className="bg-primary/10 text-primary text-xs font-bold px-3 py-1 rounded-full w-fit mb-4">מומלץ הצוות</span>
            )}
            <h1 className="text-3xl md:text-4xl font-black mb-2">{product.nameHe}</h1>
            {product.nameEn && <p className="text-muted-foreground mb-4 font-mono text-sm">{product.nameEn}</p>}
            
            <div className="flex items-center gap-4 mb-6">
              <div className="flex items-center text-amber-500">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className={`h-5 w-5 ${i < Math.round(product.ratingAverage) ? "fill-current" : "text-muted"}`} />
                ))}
                <span className="ml-2 text-foreground font-medium text-sm">({product.ratingCount} דירוגים)</span>
              </div>
              <span className="text-muted-foreground text-sm">מק"ט: {product.sku || product.id}</span>
            </div>

            <div className="text-4xl font-black text-primary mb-6 flex items-baseline gap-3">
              {product.salePrice ? (
                <>
                  <span>{formatPrice(product.salePrice)}</span>
                  <span className="text-2xl text-muted-foreground line-through font-medium">{formatPrice(product.price)}</span>
                </>
              ) : (
                <span>{formatPrice(product.price)}</span>
              )}
            </div>

            <p className="text-lg mb-8 leading-relaxed text-muted-foreground">
              {product.descriptionHe}
            </p>

            <div className="bg-muted p-6 rounded-xl mb-8 space-y-4 border border-border">
              <div className="flex items-center justify-between">
                <span className="font-bold">זמינות:</span>
                {product.stockQuantity > 0 ? (
                  <span className="text-green-600 flex items-center gap-1 font-medium">
                    <Check className="h-4 w-4" /> במלאי (זמין למשלוח מיידי)
                  </span>
                ) : (
                  <span className="text-destructive font-medium">אזל מהמלאי</span>
                )}
              </div>
              
              <div className="flex items-end gap-4 pt-4 border-t border-border/50">
                <div className="w-24">
                  <label className="text-xs font-bold text-muted-foreground mb-1 block">כמות</label>
                  <div className="flex items-center border border-border rounded-lg bg-background">
                    <button className="px-3 py-2 text-xl hover:text-primary transition-colors" onClick={() => setQuantity(Math.max(1, quantity - 1))}>-</button>
                    <span className="flex-1 text-center font-bold">{quantity}</span>
                    <button className="px-3 py-2 text-xl hover:text-primary transition-colors" onClick={() => setQuantity(Math.min(product.stockQuantity, quantity + 1))}>+</button>
                  </div>
                </div>
                <Button 
                  size="lg" 
                  className="flex-1 text-lg font-bold h-[42px]" 
                  disabled={product.stockQuantity <= 0}
                  onClick={handleAddToCart}
                >
                  <ShoppingCart className="ml-2 h-5 w-5" />
                  הוסף לעגלה
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <Button variant="outline" className="flex-1" onClick={handleAddToWishlist}>
                <Heart className="ml-2 h-4 w-4" /> שמור למועדפים
              </Button>
            </div>
            
            <div className="mt-8 bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-start gap-4">
              <Star className="h-6 w-6 text-amber-500 shrink-0 mt-1" />
              <div>
                <h4 className="font-bold">מועדון לקוחות טק-סטור</h4>
                <p className="text-sm text-muted-foreground">רכוש מוצר זה וקבל {Math.floor((product.salePrice || product.price) * 0.1)} נקודות מועדון לשימוש בקנייה הבאה!</p>
              </div>
            </div>
          </div>
        </div>

        {/* Specs */}
        {product.specs && Object.keys(product.specs as Record<string, any>).length > 0 && (
          <div className="mb-16">
            <h2 className="text-2xl font-bold mb-6 pb-2 border-b border-border">מפרט טכני</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
              {Object.entries(product.specs as Record<string, string>).map(([key, value]) => (
                <div key={key} className="flex justify-between py-3 border-b border-border/50">
                  <span className="text-muted-foreground font-medium">{key}</span>
                  <span className="font-bold text-left">{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Related Products */}
        {relatedProducts && relatedProducts.products?.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold mb-6">מוצרים שאולי יעניינו אותך</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
              {relatedProducts.products.map(rp => (
                <ProductCard key={rp.id} product={rp} />
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
