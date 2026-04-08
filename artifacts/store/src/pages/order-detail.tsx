import { useParams, Link } from "wouter";
import { Layout } from "@/components/layout";
import { useGetOrder, getGetOrderQueryKey } from "@workspace/api-client-react";
import { formatPrice } from "@/lib/utils";
import { Package, ChevronRight, Clock, Truck, CheckCircle2, XCircle, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";
import { useState, useEffect, useCallback } from "react";

interface Review {
  id: number;
  orderItemId: number;
  rating: number;
  comment: string | null;
}

function StarRating({
  value,
  onChange,
  readOnly = false,
  size = "md",
}: {
  value: number;
  onChange?: (v: number) => void;
  readOnly?: boolean;
  size?: "sm" | "md";
}) {
  const [hovered, setHovered] = useState(0);
  const sz = size === "sm" ? "h-4 w-4" : "h-7 w-7";

  return (
    <div className="flex gap-1 items-center" dir="ltr">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readOnly}
          className={`transition-colors ${readOnly ? "cursor-default" : "cursor-pointer"}`}
          onMouseEnter={() => !readOnly && setHovered(star)}
          onMouseLeave={() => !readOnly && setHovered(0)}
          onClick={() => !readOnly && onChange?.(star)}
        >
          <Star
            className={`${sz} transition-colors ${
              star <= (hovered || value)
                ? "fill-amber-400 text-amber-400"
                : "fill-none text-muted-foreground"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

function RateButton({
  item,
  orderId,
  existing,
  onSaved,
}: {
  item: { id: number; productName: string };
  orderId: number;
  existing?: Review;
  onSaved: (review: Review) => void;
}) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [comment, setComment] = useState(existing?.comment ?? "");
  const [submitting, setSubmitting] = useState(false);

  const handleOpen = () => {
    setRating(existing?.rating ?? 0);
    setComment(existing?.comment ?? "");
    setOpen(true);
  };

  const handleSubmit = async () => {
    if (rating < 1) {
      toast({ title: "אנא בחר דירוג", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ orderItemId: item.id, rating, comment: comment.trim() || null }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "שגיאה");
      }
      const saved: Review = await res.json();
      onSaved(saved);
      setOpen(false);
      toast({ title: "תודה על הדירוג!" });
    } catch (e: any) {
      toast({ title: e.message ?? "שגיאה בשמירת הדירוג", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (existing) {
    return (
      <div className="flex items-center gap-2">
        <StarRating value={existing.rating} readOnly size="sm" />
        <button
          onClick={handleOpen}
          className="text-xs text-muted-foreground underline hover:text-primary"
        >
          ערוך
        </button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="sm:max-w-md" dir="rtl">
            <DialogHeader>
              <DialogTitle>עדכון דירוג — {item.productName}</DialogTitle>
            </DialogHeader>
            <RatingForm
              rating={rating}
              setRating={setRating}
              comment={comment}
              setComment={setComment}
            />
            <DialogFooter className="flex-row-reverse gap-2">
              <Button onClick={handleSubmit} disabled={submitting || rating < 1}>
                {submitting ? "שומר..." : "עדכן דירוג"}
              </Button>
              <Button variant="outline" onClick={() => setOpen(false)}>ביטול</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={handleOpen} className="text-xs h-7 px-3 gap-1">
        <Star className="h-3.5 w-3.5" />
        דרג מוצר
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>דירוג — {item.productName}</DialogTitle>
          </DialogHeader>
          <RatingForm
            rating={rating}
            setRating={setRating}
            comment={comment}
            setComment={setComment}
          />
          <DialogFooter className="flex-row-reverse gap-2">
            <Button onClick={handleSubmit} disabled={submitting || rating < 1}>
              {submitting ? "שומר..." : "שלח דירוג"}
            </Button>
            <Button variant="outline" onClick={() => setOpen(false)}>ביטול</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function RatingForm({
  rating,
  setRating,
  comment,
  setComment,
}: {
  rating: number;
  setRating: (v: number) => void;
  comment: string;
  setComment: (v: string) => void;
}) {
  return (
    <div className="space-y-4 py-2">
      <div>
        <p className="text-sm font-medium mb-2">דירוג</p>
        <StarRating value={rating} onChange={setRating} />
        {rating > 0 && (
          <p className="text-xs text-muted-foreground mt-1">
            {["", "גרוע", "לא טוב", "בסדר", "טוב", "מצוין"][rating]}
          </p>
        )}
      </div>
      <div>
        <p className="text-sm font-medium mb-2">תגובה (אופציונלי)</p>
        <Textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="שתף את חוות דעתך על המוצר..."
          className="resize-none"
          rows={3}
          maxLength={500}
        />
        <p className="text-xs text-muted-foreground mt-1 text-left">{comment.length}/500</p>
      </div>
    </div>
  );
}

export default function OrderDetail() {
  const { id } = useParams();
  const orderId = Number(id);

  const { data: order, isLoading } = useGetOrder(orderId, {
    query: {
      enabled: !!orderId,
      queryKey: getGetOrderQueryKey(orderId)
    }
  });

  const [reviews, setReviews] = useState<Review[]>([]);

  const fetchReviews = useCallback(async () => {
    if (!orderId || order?.status !== "delivered") return;
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/reviews/order/${orderId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) setReviews(await res.json());
    } catch {}
  }, [orderId, order?.status]);

  useEffect(() => { fetchReviews(); }, [fetchReviews]);

  const handleReviewSaved = (review: Review) => {
    setReviews((prev) => {
      const idx = prev.findIndex((r) => r.orderItemId === review.orderItemId);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = review;
        return next;
      }
      return [...prev, review];
    });
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <Skeleton className="h-10 w-48 mb-8" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-2"><Skeleton className="h-64 rounded-xl" /></div>
            <div><Skeleton className="h-64 rounded-xl" /></div>
          </div>
        </div>
      </Layout>
    );
  }

  if (!order) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-16 text-center">הזמנה לא נמצאה</div>
      </Layout>
    );
  }

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case "pending":   return { label: "ממתין לאישור", icon: Clock,         color: "text-yellow-600", bg: "bg-yellow-100" };
      case "confirmed": return { label: "אושר",         icon: CheckCircle2,  color: "text-blue-600",   bg: "bg-blue-100"   };
      case "processing":return { label: "בטיפול",       icon: Package,       color: "text-purple-600", bg: "bg-purple-100" };
      case "shipped":   return { label: "נשלח",         icon: Truck,         color: "text-indigo-600", bg: "bg-indigo-100" };
      case "delivered": return { label: "נמסר",         icon: CheckCircle2,  color: "text-green-600",  bg: "bg-green-100"  };
      case "cancelled": return { label: "בוטל",         icon: XCircle,       color: "text-red-600",    bg: "bg-red-100"    };
      case "refunded":  return { label: "זוכה",         icon: XCircle,       color: "text-gray-600",   bg: "bg-gray-100"   };
      default:          return { label: status,          icon: Package,       color: "text-gray-600",   bg: "bg-gray-100"   };
    }
  };

  const getItemStatusBadge = (itemStatus: string) => {
    switch (itemStatus) {
      case "cancelled": return <Badge variant="outline" className="text-xs bg-red-50 text-red-600 border-red-200">בוטל</Badge>;
      case "refunded":  return <Badge variant="outline" className="text-xs bg-gray-50 text-gray-500 border-gray-200">זוכה</Badge>;
      default:          return null;
    }
  };

  const isItemCancelled = (itemStatus: string) =>
    itemStatus === "cancelled" || itemStatus === "refunded";

  const isDelivered = order.status === "delivered";

  const activeItems   = order.items.filter(it => !isItemCancelled((it as any).itemStatus));
  const cancelledItems = order.items.filter(it => isItemCancelled((it as any).itemStatus));
  const hasCancelled  = cancelledItems.length > 0;
  const orderSubtotal = parseFloat(order.subtotal as unknown as string);
  const orderTotal    = parseFloat(order.total    as unknown as string);
  const orderShipping = parseFloat(order.shipping as unknown as string) || 0;

  const activeSubtotal = activeItems.reduce(
    (sum, it) => sum + parseFloat(it.subtotal as unknown as string), 0
  );

  const discountedPortion = orderTotal - orderShipping;
  const proportion = orderSubtotal > 0 ? activeSubtotal / orderSubtotal : 0;
  const effectiveTotal = activeItems.length > 0
    ? proportion * discountedPortion + orderShipping
    : 0;

  const couponDiscount     = parseFloat(order.couponDiscount as unknown as string) || 0;
  const loyaltyDiscount    = parseFloat((order as any).loyaltyPointsUsedAmount ?? order.discount as unknown as string) || 0;
  const activeCoupon       = hasCancelled ? couponDiscount  * proportion : couponDiscount;
  const activeLoyalty      = hasCancelled ? loyaltyDiscount * proportion : loyaltyDiscount;
  const earnedPoints       = hasCancelled
    ? Math.floor((order.loyaltyPointsEarned ?? 0) * proportion)
    : (order.loyaltyPointsEarned ?? 0);

  const statusDisplay = getStatusDisplay(order.status);
  const StatusIcon    = statusDisplay.icon;

  return (
    <Layout>
      <div className="bg-muted py-6 mb-8">
        <div className="container mx-auto px-4">
          <Link href="/orders" className="text-sm font-medium text-muted-foreground flex items-center hover:text-primary mb-4 w-fit">
            <ChevronRight className="h-4 w-4" /> חזרה להזמנות
          </Link>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <h1 className="text-3xl font-bold">הזמנה #{order.orderNumber}</h1>
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full font-bold ${statusDisplay.bg} ${statusDisplay.color}`}>
              <StatusIcon className="h-5 w-5" />
              {statusDisplay.label}
            </div>
          </div>
          <p className="text-muted-foreground mt-2">
            תאריך הזמנה: {new Date(order.createdAt).toLocaleDateString("he-IL", { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 pb-16 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* ── Items table ─────────────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="p-4 border-b border-border bg-muted/30 font-bold flex items-center justify-between">
              <span>פריטים בהזמנה</span>
              {hasCancelled && (
                <span className="text-xs font-normal text-muted-foreground">
                  {activeItems.length} פעילים · {cancelledItems.length} בוטלו
                </span>
              )}
            </div>

            {/* Active items */}
            {activeItems.map(item => {
              const existingReview = reviews.find(r => r.orderItemId === item.id);
              return (
                <div key={item.id} className="flex items-start p-4 border-b border-border last:border-0 gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{item.productName}</div>
                    {(item as any).productSku && (
                      <div className="text-xs text-muted-foreground">מק"ט: {(item as any).productSku}</div>
                    )}
                    {isDelivered && (
                      <div className="mt-2">
                        <RateButton
                          item={{ id: item.id, productName: item.productName }}
                          orderId={orderId}
                          existing={existingReview}
                          onSaved={handleReviewSaved}
                        />
                        {existingReview?.comment && (
                          <p className="text-xs text-muted-foreground mt-1 italic">"{existingReview.comment}"</p>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground w-20 text-center shrink-0">{formatPrice(item.price)}</div>
                  <div className="text-sm text-center w-12 shrink-0">× {item.quantity}</div>
                  <div className="font-bold w-24 text-left shrink-0">{formatPrice(item.subtotal)}</div>
                </div>
              );
            })}

            {/* Cancelled items — visually dimmed */}
            {hasCancelled && cancelledItems.map(item => (
              <div key={item.id} className="flex items-center p-4 border-b border-border last:border-0 gap-3 bg-muted/30 opacity-60">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium line-through text-muted-foreground">{item.productName}</span>
                    {getItemStatusBadge((item as any).itemStatus)}
                  </div>
                  {(item as any).productSku && (
                    <div className="text-xs text-muted-foreground">מק"ט: {(item as any).productSku}</div>
                  )}
                </div>
                <div className="text-sm text-muted-foreground w-20 text-center line-through">{formatPrice(item.price)}</div>
                <div className="text-sm text-center w-12 text-muted-foreground">× {item.quantity}</div>
                <div className="font-bold w-24 text-left text-muted-foreground line-through">{formatPrice(item.subtotal)}</div>
              </div>
            ))}
          </div>

          {isDelivered && (
            <p className="text-xs text-muted-foreground text-center">
              ניתן לדרג כל מוצר ולעדכן את הדירוג בכל עת
            </p>
          )}
        </div>

        {/* ── Summary sidebar ──────────────────────────────────────────────── */}
        <div className="space-y-6">
          <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="font-bold border-b border-border pb-4 mb-4">סיכום הזמנה</h3>
            <div className="space-y-3 text-sm">

              <div className="flex justify-between">
                <span className="text-muted-foreground">סכום ביניים</span>
                <span>{formatPrice(activeSubtotal)}</span>
              </div>

              {hasCancelled && (
                <div className="flex justify-between text-red-500">
                  <span>פריטים שבוטלו ({cancelledItems.length})</span>
                  <span>
                    -{formatPrice(cancelledItems.reduce(
                      (s, it) => s + parseFloat(it.subtotal as unknown as string), 0
                    ))}
                  </span>
                </div>
              )}

              <div className="flex justify-between">
                <span className="text-muted-foreground">משלוח</span>
                <span>{orderShipping > 0 ? formatPrice(orderShipping) : "חינם"}</span>
              </div>

              {activeCoupon > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>הנחה{order.couponCode ? ` (קופון ${order.couponCode})` : ""}</span>
                  <span>-{formatPrice(activeCoupon)}</span>
                </div>
              )}

              {activeLoyalty > 0 && order.loyaltyPointsUsed > 0 && (
                <div className="flex justify-between text-primary">
                  <span>שימוש בנקודות מועדון ({order.loyaltyPointsUsed})</span>
                  <span>-{formatPrice(activeLoyalty)}</span>
                </div>
              )}

              <div className="flex justify-between font-black text-lg pt-4 border-t border-border mt-4">
                <span>סה"כ לתשלום</span>
                <span className="text-primary">{formatPrice(effectiveTotal)}</span>
              </div>

              {hasCancelled && order.status !== "cancelled" && order.status !== "refunded" && (
                <p className="text-xs text-muted-foreground text-center pt-1">
                  * הסכום המקורי היה {formatPrice(orderTotal)} — זיכוי על פריטים שבוטלו יחושב בנפרד
                </p>
              )}
            </div>

            {activeItems.length > 0 && earnedPoints > 0 && (
              <div className="mt-6 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800 flex items-center justify-center gap-2">
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                צברת {earnedPoints} נקודות בהזמנה זו!
              </div>
            )}
          </div>

          {order.shippingAddress && (
            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="font-bold border-b border-border pb-4 mb-4">כתובת למשלוח</h3>
              <div className="text-sm space-y-1">
                <div>{(order.shippingAddress as any).firstName} {(order.shippingAddress as any).lastName}</div>
                <div>{(order.shippingAddress as any).fullName}</div>
                <div>{(order.shippingAddress as any).street} {(order.shippingAddress as any).houseNumber}</div>
                <div>{(order.shippingAddress as any).city}{(order.shippingAddress as any).zipCode ? `, ${(order.shippingAddress as any).zipCode}` : ""}</div>
                {(order.shippingAddress as any).phone && (
                  <div className="pt-2 text-muted-foreground">טלפון: {(order.shippingAddress as any).phone}</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
