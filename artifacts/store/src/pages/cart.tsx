import { Layout } from "@/components/layout";
import { useCart } from "@/hooks/use-cart";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { formatPrice } from "@/lib/utils";
import { Trash2, ShoppingCart, ArrowLeft, Tag, Info, Star, Gift, Percent, Zap, BadgeCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useApplyCouponToCart, useRemoveCouponFromCart, getGetCartQueryKey } from "@workspace/api-client-react";
import { toast } from "@/components/ui/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export default function Cart() {
  const { cart, isLoading, updateItem, removeItem, clearCart } = useCart();
  const { user, isLoading: authLoading } = useAuth();
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
      const token = localStorage.getItem("token");
      const res = await fetch("/api/cart/loyalty", {
        method: "DELETE",
        headers: {
          "x-session-id": sid,
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
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

  const handleRemoveCoupon = async (code?: string) => {
    try {
      const sid = localStorage.getItem("sessionId") ?? "default-session";
      const token = localStorage.getItem("token");
      const url = code ? `/api/cart/coupon?code=${encodeURIComponent(code)}` : "/api/cart/coupon";
      const res = await fetch(url, {
        method: "DELETE",
        headers: {
          "x-session-id": sid,
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const data = await res.json();
      if (res.ok) {
        queryClient.setQueryData(getGetCartQueryKey(), data);
        toast({ title: code ? `קופון ${code} הוסר` : "הקופונים הוסרו" });
      } else {
        queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() });
      }
    } catch {
      queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleApplyCoupon();
  };

  if (isLoading || authLoading) {
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

  const appliedCoupons: Array<{ code: string; discount: number; type: string; scope: string }> = (cart as any).appliedCoupons ?? [];
  const userAvailablePoints: number = (cart as any).userAvailablePoints ?? 0;
  const maxRedeemablePoints: number = (cart as any).maxRedeemablePoints ?? 0;
  const maxRedemptionPercent: number = (cart as any).maxRedemptionPercent ?? 20;
  const loyaltyPointsUsed: number = (cart as any).loyaltyPointsUsed ?? 0;
  const loyaltyDiscount: number = (cart as any).loyaltyDiscount ?? 0;
  const shekelPerPoint: number = (cart as any).shekelPerPoint ?? 0.01;
  const minRedemptionPoints: number = (cart as any).minRedemptionPoints ?? 100;
  const remainingPoints: number = userAvailablePoints - loyaltyPointsUsed;

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

              {/* Applied coupons list — one line per coupon */}
              {appliedCoupons.map((c) => (
                <div key={c.code} className="space-y-1">
                  <div className={`flex justify-between ${c.discount > 0 ? "text-green-600" : "text-muted-foreground"}`}>
                    <span className="flex items-center gap-1 flex-wrap">
                      <Tag className="h-3 w-3 shrink-0" />
                      {c.discount > 0 ? "הנחת קופון" : "קופון פעיל"}
                      <code className="text-xs bg-green-100 text-green-700 px-1 rounded font-mono">{c.code}</code>
                      <button
                        onClick={() => handleRemoveCoupon(c.code)}
                        className="text-xs text-muted-foreground underline hover:text-destructive"
                      >
                        הסר
                      </button>
                    </span>
                    <span className="font-bold shrink-0">
                      {c.discount > 0 ? `-${formatPrice(c.discount)}` : c.type === "free_shipping" ? "משלוח חינם" : "-₪0"}
                    </span>
                  </div>
                  {c.scope === "partial" && c.discount > 0 && (
                    <div className="flex items-start gap-1 text-xs text-amber-600 bg-amber-50 rounded-md px-2 py-1.5">
                      <Info className="h-3 w-3 mt-0.5 shrink-0" />
                      <span>הקופון חל רק על חלק מהמוצרים בעגלה</span>
                    </div>
                  )}
                </div>
              ))}
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

            {/* Coupon input — logged-in users only */}
            {user && (
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
                  <Button variant="secondary" onClick={handleApplyCoupon} disabled={!couponCode.trim() || applyCoupon.isPending}>
                    {applyCoupon.isPending ? "..." : "הפעל"}
                  </Button>
                </div>
              </div>
            )}

            {/* Loyalty points — logged-in users with enough points */}
            {user && userAvailablePoints >= minRedemptionPoints && (
              <div className="mb-6 bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Star className="h-4 w-4 fill-amber-500 text-amber-500" />
                  <span className="font-semibold text-sm">נקודות נאמנות</span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>יתרה כוללת: <strong className="text-foreground">{userAvailablePoints.toLocaleString("he-IL")}</strong> נק׳</span>
                  {loyaltyPointsUsed > 0 && (
                    <span>לאחר מימוש: <strong className="text-amber-700">{remainingPoints.toLocaleString("he-IL")}</strong> נק׳</span>
                  )}
                </div>
                <div className="text-xs text-amber-700 bg-amber-100 rounded px-2 py-1.5 mb-3">
                  ניתן לממש עד <strong>{maxRedeemablePoints.toLocaleString("he-IL")}</strong> נק׳ בהזמנה זו
                  <span className="text-muted-foreground"> (עד {maxRedemptionPercent}% מסכום ההזמנה) = </span>
                  <strong>₪{(maxRedeemablePoints * shekelPerPoint).toFixed(2)}</strong>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  {Math.round(1 / shekelPerPoint).toLocaleString("he-IL")} נקודות = ₪1 · מינימום {minRedemptionPoints} נקודות
                </p>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder={`עד ${maxRedeemablePoints.toLocaleString("he-IL")} נק׳`}
                    value={loyaltyInput}
                    min={minRedemptionPoints}
                    max={maxRedeemablePoints}
                    step={minRedemptionPoints}
                    onChange={e => {
                      const val = parseInt(e.target.value, 10);
                      if (!e.target.value) { setLoyaltyInput(""); return; }
                      setLoyaltyInput(String(Math.min(val, maxRedeemablePoints)));
                    }}
                    onKeyDown={e => e.key === "Enter" && handleApplyLoyalty()}
                    className="text-sm"
                  />
                  <Button
                    variant="secondary"
                    onClick={handleApplyLoyalty}
                    disabled={!loyaltyInput || loyaltyPending || parseInt(loyaltyInput) > maxRedeemablePoints}
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

            {/* Checkout button or guest login prompt */}
            {user ? (
              <Button size="lg" className="w-full font-bold text-lg h-14" asChild>
                <Link href="/checkout">המשך לתשלום <ArrowLeft className="ml-2 h-5 w-5" /></Link>
              </Button>
            ) : (
              <div className="space-y-4">
                <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-sm space-y-3">
                  <p className="font-bold text-base text-center">להמשיך לתשלום? התחברו תחילה</p>
                  <p className="text-muted-foreground text-xs text-center">הצטרפות חינמית — תיהנו מהיתרונות הבאים:</p>
                  <div className="space-y-2 pt-1">
                    {([
                      { icon: <Gift className="h-3.5 w-3.5 text-rose-500" />, text: "1,000 נקודות מתנה בהרשמה — מיד בחשבון שלך" },
                      { icon: <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />, text: "מועדון נקודות — צבור הנחות על כל קנייה" },
                      { icon: <Percent className="h-3.5 w-3.5 text-green-600" />, text: "קופונים והנחות בלעדיות לחברים" },
                      { icon: <Zap className="h-3.5 w-3.5 text-blue-600" />, text: "קנייה מהירה עם שמירת פרטים" },
                      { icon: <BadgeCheck className="h-3.5 w-3.5 text-purple-600" />, text: "מעקב הזמנות בזמן אמת" },
                    ] as { icon: React.ReactNode; text: string }[]).map(({ icon, text }, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        {icon}
                        <span>{text}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <Button size="lg" className="w-full font-bold text-lg h-14" asChild>
                  <Link href="/auth?redirect=/cart">התחברות / הרשמה</Link>
                </Button>
                <p className="text-xs text-muted-foreground text-center">הצטרפות חינמית לחלוטין · ללא דמי מנוי</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
