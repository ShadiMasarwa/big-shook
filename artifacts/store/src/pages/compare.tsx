import { Layout } from "@/components/layout";
import { useCompare } from "@/hooks/use-compare";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ArrowRightLeft, Trash2, ShoppingCart, Check } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { useCart } from "@/hooks/use-cart";
import { toast } from "@/components/ui/use-toast";

export default function Compare() {
  const { products, removeFromCompare, clearCompare } = useCompare();
  const { addToCart } = useCart();

  const handleAddToCart = (productId: number) => {
    addToCart({ productId, quantity: 1 })
      .then(() => toast({ title: "נוסף לעגלה" }));
  };

  if (products.length === 0) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-24 text-center max-w-md flex flex-col items-center">
          <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-6">
            <ArrowRightLeft className="h-10 w-10 text-muted-foreground" />
          </div>
          <h1 className="text-3xl font-black mb-4">השוואת מוצרים ריקה</h1>
          <p className="text-muted-foreground mb-8">
            ניתן להוסיף עד 4 מוצרים להשוואה מהקטלוג כדי לראות את ההבדלים ביניהם בצורה נוחה.
          </p>
          <Button size="lg" asChild className="w-full font-bold">
            <Link href="/catalog">חזרה לקטלוג</Link>
          </Button>
        </div>
      </Layout>
    );
  }

  // Get all unique spec keys across all products
  const allSpecKeys = Array.from(new Set(
    products.flatMap(p => Object.keys((p.specs as Record<string, any>) || {}))
  ));

  return (
    <Layout>
      <div className="bg-muted py-8 mb-8">
        <div className="container mx-auto px-4 flex justify-between items-center">
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <ArrowRightLeft className="h-8 w-8 text-primary" />
            השוואת מוצרים
          </h1>
          <Button variant="outline" onClick={clearCompare} className="text-destructive border-destructive hover:bg-destructive/10">
            נקה הכל
          </Button>
        </div>
      </div>

      <div className="container mx-auto px-4 pb-16 overflow-x-auto">
        <div className="min-w-[800px]">
          {/* Header Row */}
          <div className="flex mb-8 gap-4">
            <div className="w-48 shrink-0"></div> {/* Empty space for labels */}
            {products.map(product => (
              <div key={product.id} className="flex-1 relative bg-card border border-border rounded-xl p-4 flex flex-col items-center text-center">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="absolute top-2 right-2 text-muted-foreground hover:text-destructive"
                  onClick={() => removeFromCompare(product.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
                <div className="w-32 h-32 mb-4 bg-white rounded-lg p-2 flex items-center justify-center">
                  {product.images?.[0] ? (
                    <img src={product.images[0]} alt={product.nameHe} className="max-w-full max-h-full object-contain" />
                  ) : (
                    <span className="text-muted-foreground text-sm">אין תמונה</span>
                  )}
                </div>
                <Link href={`/product/${product.id}`} className="font-bold hover:text-primary transition-colors line-clamp-2 h-12 mb-2">
                  {product.nameHe}
                </Link>
                <div className="text-xl font-black text-primary mb-4">
                  {formatPrice(product.salePrice || product.price)}
                </div>
                <Button className="w-full mt-auto" onClick={() => handleAddToCart(product.id)}>
                  <ShoppingCart className="ml-2 h-4 w-4" /> הוסף לעגלה
                </Button>
              </div>
            ))}
            {/* Empty slots placeholders */}
            {[...Array(4 - products.length)].map((_, i) => (
              <div key={`empty-${i}`} className="flex-1 border-2 border-dashed border-border rounded-xl flex items-center justify-center text-muted-foreground bg-muted/20">
                <div className="text-center p-6">
                  <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-3">
                    <span className="text-2xl font-bold">+</span>
                  </div>
                  <span>הוסף מוצר</span>
                </div>
              </div>
            ))}
          </div>

          {/* Specs Rows */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex border-b border-border bg-muted/50 p-4">
              <div className="w-48 shrink-0 font-bold">זמינות במלאי</div>
              {products.map(p => (
                <div key={p.id} className="flex-1 text-center font-medium">
                  {p.stockQuantity > 0 ? (
                    <span className="text-green-600 flex items-center justify-center gap-1"><Check className="h-4 w-4"/> במלאי</span>
                  ) : (
                    <span className="text-destructive">אזל</span>
                  )}
                </div>
              ))}
              {[...Array(4 - products.length)].map((_, i) => <div key={i} className="flex-1"></div>)}
            </div>
            
            {allSpecKeys.map((key, idx) => (
              <div key={key} className={`flex p-4 ${idx % 2 === 0 ? 'bg-background' : 'bg-muted/30'} border-b border-border last:border-0`}>
                <div className="w-48 shrink-0 font-medium text-muted-foreground">{key}</div>
                {products.map(p => {
                  const specs = p.specs as Record<string, string>;
                  const val = specs?.[key] || '-';
                  return (
                    <div key={p.id} className="flex-1 text-center font-medium">{val}</div>
                  );
                })}
                {[...Array(4 - products.length)].map((_, i) => <div key={i} className="flex-1"></div>)}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
