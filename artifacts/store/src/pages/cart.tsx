import { Layout } from "@/components/layout";
import { useCart } from "@/hooks/use-cart";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { formatPrice } from "@/lib/utils";
import { Trash2, ShoppingCart, ArrowLeft, Tag, Info, Star } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useApplyCouponToCart, useRemoveCouponFromCart, getGetCartQueryKey } from "@workspace/api-client-react";
import { toast } from "@/components/ui/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export default function Cart() {
  const { cart, isLoading, updateItem, removeItem, clearCart } = useCart();
  const [couponCode, setCouponCode] = useState("");
  const [loyaltyInput, setLoyaltyInput] = useState("");
  const [loyaltyPending, setLoyaltyPending] = useState(false);
  const applyCoupon = useApplyCouponToCart();
  const removeCoupon = useRemoveCouponFromCart();
  const queryClient = useQueryClient();

  const handleApplyLoyalty = async () => {
    const points = parseInt(loyaltyInput, 10);
    if (!points || points < 1) return;
    setLoyaltyPending(true);
    try {
      const token = localStorage.getItem("token");
      const sid = localStorage.getItem("sessionId") ?? "default-session";
      const res = await fetch("/api/cart/loyalty", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-session-id": sid,
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ points }),
      });
      const data = await res.json();
      if (!res.ok) { toast({ title: data.error ?? "שגיאה", variant: "destructive" }); return; }
      queryClient.setQueryData(getGetCartQueryKey(), data);
      setLoyaltyInput("");
      toast({ title: `${points.toLocaleString("he-IL")} נקודות מומשו` });
    } catch {
      toast({ title: "שגיאה בהפעלת הנקודות", variant: "destructive" });
    } finally {
      setLoyaltyPending(false);
    }
  };

  const handleRemoveLoyalty = async () => {
    setLoyaltyPending(true);
    try {
      const sid = localStorage.getItem("sessionId") ?? "default-session";
      const res = await fetch("/api/cart/loyalty", {
        method: "DELETE",
        headers: { "x-session-id": sid },
      });
      const data = await res.json();
      if (!res.ok) { queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() }); return; }
      queryClient.setQueryData(getGetCartQueryKey(), data);
      toast({ title: "הנקודות הוסרו" });
    } finally {
      setLoyaltyPending(false);
    }
  };

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    try {
      const updated = await applyCoupon.mutateAsync({ data: { code: couponCode.trim() } });
      // Update cart cache immediately with the returned cart
      queryClient.setQueryData(getGetCartQueryKey(), updated);
      toast({ title: "הקופון הופעל בהצלחה" });
      setCouponCode("");
    } catch (e: any) {
      const msg = e?.data?.error ?? "קופון לא חוקי";
      toast({ title: msg, variant: "destructive" });
    }
  };

  const handleRemoveCoupon = async () => {
    try {
      const updated = await removeCoupon.mutateAsync();
      queryClient.setQueryData(getGetCartQueryKey(), updated);
      toast({ title: "הקופון הוסר" });
    } catch {
      queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleApplyCoupon();
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-16 text-center">טוען עגלה...</div>
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

  const isPartialCoupon = (cart as any).couponScope === "partial";
  const couponType: string | null = (cart as any).couponType ?? null;
  const userAvailablePoints: number = (cart as any).userAvailablePoints ?? 0;
  const loyaltyDiscount: number = (cart as any).loyaltyDiscount ?? 0;
  const shekelPerPoint: number = (cart as any).shekelPerPoint ?? 0.01;
  const minRedemptionPoints: number = (cart as any).minRedemptionPoints ?? 100;

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
                <div className="space-y-1">
                  <div className="flex justify-between text-green-600">
                    <span className="flex items-center gap-1">
                      <Tag className="h-3 w-3" />
                      הנחת קופון
                      {cart.couponCode && (
                        <code className="text-xs bg-green-100 text-green-700 px-1 rounded font-mono">{cart.couponCode}</code>
                      )}
                      <button
                        onClick={handleRemoveCoupon}
                        className="text-xs text-muted-foreground underline ml-1 hover:text-destructive"
                      >
                        הסר
                      </button>
                    </span>
                    <span className="font-bold">-{formatPrice(cart.couponDiscount)}</span>
                  </div>
                  {isPartialCoupon && (
                    <div className="flex items-start gap-1 text-xs text-amber-600 bg-amber-50 rounded-md px-2 py-1.5">
                      <Info className="h-3 w-3 mt-0.5 shrink-0" />
                      <span>הקופון חל רק על חלק מהמוצרים בעגלה</span>
                    </div>
                  )}
                </div>
              )}

              {/* Applied coupon badge when discount = 0 */}
              {cart.couponCode && cart.couponDiscount === 0 && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Tag className="h-3 w-3" />
                      קופון פעיל
                      <code className="text-xs bg-muted px-1 rounded font-mono">{cart.couponCode}</code>
                      <button
                        onClick={handleRemoveCoupon}
                        className="text-xs underline ml-1 hover:text-destructive"
                      >
                        הסר
                      </button>
                    </span>
                    <span className="text-xs">
                      {couponType === "free_shipping" ? "ללא עלות משלוח" : "-₪0"}
                    </span>
                  </div>
                  {couponType !== "free_shipping" && (
                    <div className="flex items-start gap-1 text-xs text-amber-600 bg-amber-50 rounded-md px-2 py-1.5">
                      <Info className="h-3 w-3 mt-0.5 shrink-0" />
                      <span>הקופון אינו חל על המוצרים בעגלה</span>
                    </div>
                  )}
                </div>
              )}
              {/* Applied loyalty discount line in the summary */}
              {loyaltyDiscount > 0 && (
                <div className="flex justify-between text-amber-600">
                  <span className="flex items-center gap-1">
                    <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                    נקודות נאמנות
                    <span className="text-xs text-muted-foreground">({(cart as any).loyaltyPointsUsed?.toLocaleString("he-IL")} נק׳)</span>
                    <button
                      onClick={handleRemoveLoyalty}
                      disabled={loyaltyPending}
                      className="text-xs text-muted-foreground underline ml-1 hover:text-destructive"
                    >
                      הסר
                    </button>
                  </span>
                  <span className="font-bold">-{formatPrice(loyaltyDiscount)}</span>
                </div>
              )}
            </div>

            <div className="border-t border-border pt-4 mb-6">
              <div className="flex justify-between items-end">
                <span className="text-lg font-bold">סה"כ לתשלום</span>
                <span className="text-2xl font-black text-primary">{formatPrice(cart.total)}</span>
              </div>
            </div>

            {/* Coupon input — only shown when no coupon is applied */}
            {!cart.couponCode && (
              <div className="mb-6">
                <label className="text-sm font-medium mb-2 block">קוד קופון</label>
                <div className="flex gap-2">
                  <Input
                    placeholder="הזן קוד..."
                    value={couponCode}
                    onChange={e => setCouponCode(e.target.value.toUpperCase())}
                    onKeyDown={handleKeyDown}
                    className="uppercase font-mono tracking-wider"
                  />
                  <Button
                    variant="secondary"
                    onClick={handleApplyCoupon}
                    disabled={!couponCode.trim() || applyCoupon.isPending}
                  >
                    {applyCoupon.isPending ? "..." : "הפעל"}
                  </Button>
                </div>
              </div>
            )}

            {/* Loyalty points redemption */}
            {userAvailablePoints >= minRedemptionPoints && loyaltyDiscount === 0 && (
              <div className="mb-6 bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Star className="h-4 w-4 fill-amber-500 text-amber-500" />
                  <span className="font-semibold text-sm">נקודות נאמנות</span>
                  <span className="text-xs text-muted-foreground mr-auto">
                    יתרה: <strong>{userAvailablePoints.toLocaleString("he-IL")}</strong> נק׳
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  {Math.round(1 / shekelPerPoint).toLocaleString("he-IL")} נקודות = ₪1 · מינימום {minRedemptionPoints} נקודות
                </p>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder={`עד ${userAvailablePoints.toLocaleString("he-IL")} נק׳`}
                    value={loyaltyInput}
                    min={minRedemptionPoints}
                    max={userAvailablePoints}
                    step={minRedemptionPoints}
                    onChange={e => setLoyaltyInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleApplyLoyalty()}
                    className="text-sm"
                  />
                  <Button
                    variant="secondary"
                    onClick={handleApplyLoyalty}
                    disabled={!loyaltyInput || loyaltyPending}
                    className="shrink-0"
                  >
                    {loyaltyPending ? "..." : "הפעל"}
                  </Button>
                </div>
                {loyaltyInput && parseInt(loyaltyInput) >= minRedemptionPoints && (
                  <p className="text-xs text-amber-700 mt-2">
                    חיסכון: ₪{(parseInt(loyaltyInput) * shekelPerPoint).toFixed(2)}
                  </p>
                )}
              </div>
            )}

            <Button size="lg" className="w-full font-bold text-lg h-14" asChild>
              <Link href="/checkout">המשך לתשלום <ArrowLeft className="ml-2 h-5 w-5" /></Link>
            </Button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
