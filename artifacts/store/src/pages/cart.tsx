import { Layout } from "@/components/layout";
import { useCart } from "@/hooks/use-cart";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { formatPrice } from "@/lib/utils";
import { Trash2, ShoppingCart, ArrowLeft, Tag } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useApplyCouponToCart, useRemoveCouponFromCart } from "@workspace/api-client-react";
import { toast } from "@/components/ui/use-toast";

export default function Cart() {
  const { cart, isLoading, updateItem, removeItem, clearCart } = useCart();
  const [couponCode, setCouponCode] = useState("");
  const applyCoupon = useApplyCouponToCart();
  const removeCoupon = useRemoveCouponFromCart();

  const handleApplyCoupon = async () => {
    if (!couponCode) return;
    try {
      await applyCoupon.mutateAsync({ data: { code: couponCode } });
      toast({ title: "הקופון הופעל בהצלחה" });
      setCouponCode("");
    } catch (e) {
      toast({ title: "קופון לא חוקי", variant: "destructive" });
    }
  };

  const handleRemoveCoupon = async () => {
    try {
      await removeCoupon.mutateAsync();
      toast({ title: "הקופון הוסר" });
    } catch (e) {
      console.error(e);
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-16 text-center">
          טוען עגלה...
        </div>
      </Layout>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-24 text-center max-w-md flex flex-col items-center">
          <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-6">
            <ShoppingCart className="h-10 w-10 text-muted-foreground" />
          </div>
          <h1 className="text-3xl font-black mb-4">העגלה שלך ריקה</h1>
          <p className="text-muted-foreground mb-8">
            נראה שעדיין לא הוספת מוצרים לעגלת הקניות שלך. בואו נשנה את זה!
          </p>
          <Button size="lg" asChild className="w-full font-bold">
            <Link href="/catalog">המשך בקניות</Link>
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="bg-muted py-8 mb-8">
        <div className="container mx-auto px-4">
          <h1 className="text-3xl font-bold">עגלת קניות</h1>
        </div>
      </div>

      <div className="container mx-auto px-4 pb-16 flex flex-col lg:flex-row gap-12">
        {/* Cart Items */}
        <div className="flex-1 space-y-6">
          <div className="flex justify-between border-b border-border pb-4 font-medium text-muted-foreground">
            <span className="w-2/3">מוצר</span>
            <span className="w-1/6 text-center">כמות</span>
            <span className="w-1/6 text-left">סה"כ</span>
          </div>

          {cart.items.map((item: any) => (
            <div key={item.productId} className="flex items-center justify-between py-4 border-b border-border gap-4">
              <div className="w-2/3 flex items-center gap-4">
                <Link href={`/product/${item.productId}`}>
                  <div className="w-20 h-20 bg-white rounded-lg border border-border overflow-hidden shrink-0 flex items-center justify-center p-1">
                    {item.product.images && item.product.images[0] ? (
                      <img src={item.product.images[0]} alt={item.product.nameHe} className="max-w-full max-h-full object-contain" />
                    ) : (
                      <span className="text-xs text-muted-foreground">תמונה</span>
                    )}
                  </div>
                </Link>
                <div>
                  <Link href={`/product/${item.productId}`} className="font-bold hover:text-primary transition-colors line-clamp-2">
                    {item.product.nameHe}
                  </Link>
                  <p className="text-sm text-muted-foreground mt-1">{formatPrice(item.price)}</p>
                </div>
              </div>
              
              <div className="w-1/6 flex justify-center">
                <div className="flex items-center border border-border rounded-md bg-background w-fit">
                  <button 
                    className="px-2 py-1 hover:text-primary transition-colors" 
                    onClick={() => updateItem({ productId: item.productId, quantity: item.quantity - 1 })}
                  >-</button>
                  <span className="w-8 text-center font-medium text-sm">{item.quantity}</span>
                  <button 
                    className="px-2 py-1 hover:text-primary transition-colors" 
                    onClick={() => updateItem({ productId: item.productId, quantity: item.quantity + 1 })}
                  >+</button>
                </div>
              </div>

              <div className="w-1/6 flex items-center justify-between pl-0 text-left gap-4">
                <span className="font-bold">{formatPrice(item.subtotal)}</span>
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive shrink-0" onClick={() => removeItem({ productId: item.productId })}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          
          <div className="flex justify-start pt-4">
            <Button variant="outline" className="text-destructive border-destructive hover:bg-destructive hover:text-white" onClick={() => clearCart()}>
              נקה עגלה
            </Button>
          </div>
        </div>

        {/* Order Summary */}
        <div className="w-full lg:w-96 shrink-0">
          <div className="bg-muted rounded-xl p-6 border border-border sticky top-24">
            <h2 className="text-xl font-bold mb-6 border-b border-border pb-4">סיכום הזמנה</h2>
            
            <div className="space-y-4 text-sm mb-6">
              <div className="flex justify-between">
                <span className="text-muted-foreground">סכום ביניים ({cart.itemCount} פריטים)</span>
                <span className="font-medium">{formatPrice(cart.subtotal)}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-muted-foreground">משלוח</span>
                <span className="font-medium">{cart.shipping > 0 ? formatPrice(cart.shipping) : 'חינם'}</span>
              </div>
              
              {cart.couponDiscount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span className="flex items-center gap-1">
                    <Tag className="h-3 w-3" />
                    הנחת קופון
                    <button onClick={handleRemoveCoupon} className="text-xs text-muted-foreground underline ml-2 mr-2 hover:text-destructive">הסר</button>
                  </span>
                  <span className="font-bold">-{formatPrice(cart.couponDiscount)}</span>
                </div>
              )}
            </div>

            <div className="border-t border-border pt-4 mb-6">
              <div className="flex justify-between items-end">
                <span className="text-lg font-bold">סה"כ לתשלום</span>
                <span className="text-2xl font-black text-primary">{formatPrice(cart.total)}</span>
              </div>
            </div>

            <div className="mb-6">
              <label className="text-sm font-medium mb-2 block">קוד קופון</label>
              <div className="flex gap-2">
                <Input 
                  placeholder="הזן קוד..." 
                  value={couponCode} 
                  onChange={(e) => setCouponCode(e.target.value)} 
                  disabled={cart.couponCode ? true : false}
                />
                <Button variant="secondary" onClick={handleApplyCoupon} disabled={!couponCode || !!cart.couponCode}>הפעל</Button>
              </div>
            </div>

            <Button size="lg" className="w-full font-bold text-lg h-14" asChild>
              <Link href="/checkout">המשך לתשלום <ArrowLeft className="ml-2 h-5 w-5" /></Link>
            </Button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
