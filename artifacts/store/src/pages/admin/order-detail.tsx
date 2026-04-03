import { useState, useEffect, useCallback } from "react";
import { useRoute, useLocation } from "wouter";
import { AdminLayout } from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/use-toast";
import { formatPrice } from "@/lib/utils";
import {
  ArrowRight, Package, MapPin, User, ChevronRight, CheckCircle2, Circle,
  XCircle, AlertTriangle, Truck, Clock, RefreshCw, Star,
} from "lucide-react";

// ─── constants ─────────────────────────────────────────────────────────────
const FLOW: { value: string; label: string; icon: React.ElementType }[] = [
  { value: "pending",    label: "ממתין",   icon: Clock },
  { value: "confirmed",  label: "אושר",    icon: CheckCircle2 },
  { value: "processing", label: "בטיפול",  icon: RefreshCw },
  { value: "shipped",    label: "נשלח",    icon: Truck },
  { value: "delivered",  label: "נמסר",    icon: CheckCircle2 },
];

const STATUS_LABEL: Record<string, string> = {
  pending: "ממתין", confirmed: "אושר", processing: "בטיפול",
  shipped: "נשלח", delivered: "נמסר", cancelled: "בוטל", refunded: "זוכה",
};

function nextStatus(current: string): string | null {
  const idx = FLOW.findIndex(s => s.value === current);
  if (idx === -1 || idx >= FLOW.length - 1) return null;
  return FLOW[idx + 1].value;
}

const STATUS_COLOR: Record<string, string> = {
  pending:    "bg-yellow-100 text-yellow-800 border-yellow-200",
  confirmed:  "bg-blue-100 text-blue-800 border-blue-200",
  processing: "bg-purple-100 text-purple-800 border-purple-200",
  shipped:    "bg-indigo-100 text-indigo-800 border-indigo-200",
  delivered:  "bg-green-100 text-green-800 border-green-200",
  cancelled:  "bg-red-100 text-red-800 border-red-200",
  refunded:   "bg-gray-100 text-gray-700 border-gray-200",
};

// ─── types ──────────────────────────────────────────────────────────────────
interface StatusEntry { status: string; changedAt: string }

interface OrderItem {
  id: number;
  productId: number;
  productName: string;
  productSku: string | null;
  quantity: number;
  price: number;
  subtotal: number;
  itemStatus: string;
  itemStatusHistory: StatusEntry[];
  productImages: string[];
}

interface Order {
  id: number;
  orderNumber: string;
  status: string;
  statusHistory: StatusEntry[];
  createdAt: string;
  updatedAt: string;
  customerName: string | null;
  userId: number | null;
  subtotal: number;
  discount: number;
  shipping: number;
  tax: number;
  total: number;
  couponCode: string | null;
  couponDiscount: number;
  loyaltyPointsUsed: number;
  loyaltyPointsUsedAmount: number;
  loyaltyPointsEarned: number;
  shippingAddress: Record<string, string>;
  notes: string | null;
  items: OrderItem[];
}

// ─── helpers ─────────────────────────────────────────────────────────────────
function authFetch(path: string, options?: RequestInit) {
  const token = localStorage.getItem("token");
  return fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers ?? {}),
    },
  }).then(async r => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
}

// ─── sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={`text-sm px-3 py-1 ${STATUS_COLOR[status] ?? ""}`}>
      {STATUS_LABEL[status] ?? status}
    </Badge>
  );
}

/** Visual progress bar showing the main flow steps */
function StatusTimeline({ currentStatus, history }: { currentStatus: string; history: StatusEntry[] }) {
  const isCancelled = currentStatus === "cancelled";
  const isRefunded  = currentStatus === "refunded";
  const isSpecial   = isCancelled || isRefunded;

  const historyMap = new Map(history.map(h => [h.status, h.changedAt]));

  return (
    <div className="bg-card border border-border rounded-xl p-5 mb-6">
      <h3 className="text-sm font-semibold text-muted-foreground mb-4 uppercase tracking-wide">מעקב סטטוס</h3>

      {/* Main flow */}
      <div className="flex items-start gap-0">
        {FLOW.map((step, idx) => {
          const reached = historyMap.has(step.value);
          const isCurrent = currentStatus === step.value && !isSpecial;
          const isLast = idx === FLOW.length - 1;
          const stepDate = historyMap.get(step.value);

          return (
            <div key={step.value} className="flex items-start flex-1 min-w-0">
              <div className="flex flex-col items-center flex-1 min-w-0">
                {/* Circle */}
                <div className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-colors shrink-0 ${
                  isCurrent
                    ? "bg-primary border-primary text-white"
                    : reached
                    ? "bg-green-500 border-green-500 text-white"
                    : "bg-muted border-border text-muted-foreground"
                }`}>
                  {reached ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <Circle className="h-4 w-4" />
                  )}
                </div>
                {/* Label */}
                <p className={`text-xs mt-1.5 text-center font-medium ${
                  isCurrent ? "text-primary" : reached ? "text-green-600" : "text-muted-foreground"
                }`}>
                  {step.label}
                </p>
                {/* Date */}
                {stepDate && (
                  <p className="text-[10px] text-muted-foreground text-center leading-tight mt-0.5">
                    {formatDate(stepDate)}<br />{formatTime(stepDate)}
                  </p>
                )}
              </div>
              {/* Connector line */}
              {!isLast && (
                <div className={`h-0.5 flex-1 mt-[18px] transition-colors ${
                  historyMap.has(FLOW[idx + 1].value) || (isCurrent && !isSpecial) ? "bg-green-400" : "bg-border"
                }`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Special status banner */}
      {isSpecial && (
        <div className={`mt-4 flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium ${
          isCancelled ? "bg-red-50 border border-red-200 text-red-700" : "bg-gray-50 border border-gray-200 text-gray-700"
        }`}>
          <XCircle className="h-4 w-4 shrink-0" />
          הזמנה {isCancelled ? "בוטלה" : "זוכתה"} ב-{formatDate(historyMap.get(currentStatus) ?? "")} {formatTime(historyMap.get(currentStatus) ?? "")}
        </div>
      )}
    </div>
  );
}

/** Item row with per-item status progression */
function ItemRow({ item, orderId, onUpdate }: {
  item: OrderItem;
  orderId: number;
  onUpdate: (itemId: number, newStatus: string, newHistory: StatusEntry[]) => void;
}) {
  const [pending, setPending] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const next = nextStatus(item.itemStatus);
  const isTerminal = ["cancelled", "refunded", "delivered"].includes(item.itemStatus);

  const advance = async (targetStatus: string) => {
    setPending(true);
    try {
      const result = await authFetch(`/api/orders/${orderId}/items/${item.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ itemStatus: targetStatus }),
      });
      onUpdate(item.id, result.itemStatus, result.itemStatusHistory ?? []);
      toast({ title: `פריט עודכן ל-"${STATUS_LABEL[targetStatus] ?? targetStatus}"` });
    } catch {
      toast({ title: "שגיאה בעדכון פריט", variant: "destructive" });
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="border border-border rounded-lg p-4 bg-card">
      <div className="flex gap-3">
        {/* Image */}
        <div className="h-14 w-14 rounded border border-border bg-muted flex items-center justify-center shrink-0">
          {item.productImages?.[0] ? (
            <img src={item.productImages[0]} alt="" className="h-full w-full object-contain rounded" />
          ) : (
            <Package className="h-5 w-5 text-muted-foreground" />
          )}
        </div>

        {/* Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div>
              <p className="font-semibold text-sm">{item.productName}</p>
              {item.productSku && <p className="text-xs text-muted-foreground font-mono" dir="ltr">{item.productSku}</p>}
            </div>
            <div className="text-left text-sm">
              <p className="text-muted-foreground text-xs">כמות: <strong className="text-foreground">{item.quantity}</strong></p>
              <p className="font-bold">{formatPrice(item.subtotal)}</p>
            </div>
          </div>

          {/* Status + actions */}
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <StatusBadge status={item.itemStatus} />

            {!isTerminal && next && (
              <Button
                size="sm"
                className="h-7 text-xs"
                disabled={pending}
                onClick={() => advance(next)}
              >
                <ChevronRight className="h-3 w-3 ml-1" />
                {STATUS_LABEL[next]}
              </Button>
            )}

            {!["cancelled", "refunded", "delivered"].includes(item.itemStatus) && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs border-red-200 text-red-600 hover:bg-red-50"
                disabled={pending}
                onClick={() => advance("cancelled")}
              >
                <XCircle className="h-3 w-3 ml-1" />
                ביטול פריט
              </Button>
            )}

            {/* History toggle */}
            {item.itemStatusHistory?.length > 0 && (
              <button
                className="text-[11px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline mr-auto"
                onClick={() => setShowHistory(v => !v)}
              >
                {showHistory ? "הסתר היסטוריה" : `היסטוריה (${item.itemStatusHistory.length})`}
              </button>
            )}
          </div>

          {/* History */}
          {showHistory && item.itemStatusHistory.length > 0 && (
            <div className="mt-2 border-t border-border pt-2 space-y-1">
              {item.itemStatusHistory.map((h, i) => (
                <div key={i} className="flex gap-2 text-xs text-muted-foreground">
                  <span className="text-foreground font-medium">{STATUS_LABEL[h.status] ?? h.status}</span>
                  <span>·</span>
                  <span>{formatDate(h.changedAt)} {formatTime(h.changedAt)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── main page ────────────────────────────────────────────────────────────────
export default function AdminOrderDetail() {
  const [, params] = useRoute("/admin/orders/:id");
  const [, navigate] = useLocation();
  const orderId = parseInt(params?.id ?? "0", 10);

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusPending, setStatusPending] = useState(false);

  const fetchOrder = useCallback(async () => {
    setLoading(true);
    try {
      const data = await authFetch(`/api/orders/${orderId}`);
      setOrder(data);
    } catch {
      toast({ title: "שגיאה בטעינת הזמנה", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => { fetchOrder(); }, [fetchOrder]);

  const changeOrderStatus = async (newStatus: string) => {
    if (!order) return;
    setStatusPending(true);
    try {
      const updated = await authFetch(`/api/orders/${order.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      setOrder(updated);
      toast({ title: `סטטוס הזמנה עודכן ל-"${STATUS_LABEL[newStatus] ?? newStatus}"` });
    } catch {
      toast({ title: "שגיאה בעדכון סטטוס", variant: "destructive" });
    } finally {
      setStatusPending(false);
    }
  };

  const handleItemUpdate = (itemId: number, newStatus: string, newHistory: StatusEntry[]) => {
    setOrder(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.map(it =>
          it.id === itemId ? { ...it, itemStatus: newStatus, itemStatusHistory: newHistory } : it
        ),
      };
    });
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="space-y-4 max-w-5xl mx-auto">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AdminLayout>
    );
  }

  if (!order) {
    return (
      <AdminLayout>
        <div className="text-center py-20 text-muted-foreground">הזמנה לא נמצאה</div>
      </AdminLayout>
    );
  }

  const next = nextStatus(order.status);
  const isTerminal = ["cancelled", "refunded", "delivered"].includes(order.status);
  const canCancel  = !["cancelled", "refunded"].includes(order.status);
  const canRefund  = order.status === "delivered";

  const addr = order.shippingAddress as Record<string, string>;

  return (
    <AdminLayout>
      <div className="max-w-5xl mx-auto" dir="rtl">

        {/* ── Header ── */}
        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="ghost"
            size="sm"
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
            onClick={() => navigate("/admin/orders")}
          >
            <ArrowRight className="h-4 w-4" />
            הזמנות
          </Button>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <h1 className="text-xl font-bold">#{order.orderNumber}</h1>
          <StatusBadge status={order.status} />
          <span className="text-sm text-muted-foreground mr-auto">
            {formatDate(order.createdAt)} · {formatTime(order.createdAt)}
          </span>
        </div>

        {/* ── Status Timeline ── */}
        <StatusTimeline currentStatus={order.status} history={(order.statusHistory ?? []) as StatusEntry[]} />

        {/* ── Action Buttons ── */}
        {!isTerminal && (
          <div className="flex items-center gap-3 mb-6 flex-wrap">
            {next && (
              <Button
                className="gap-2"
                disabled={statusPending}
                onClick={() => changeOrderStatus(next)}
              >
                <ChevronRight className="h-4 w-4" />
                העבר ל: {STATUS_LABEL[next]}
              </Button>
            )}

            {canCancel && (
              <Button
                variant="outline"
                className="gap-2 border-red-200 text-red-600 hover:bg-red-50"
                disabled={statusPending}
                onClick={() => changeOrderStatus("cancelled")}
              >
                <XCircle className="h-4 w-4" />
                ביטול הזמנה
              </Button>
            )}

            {canRefund && (
              <Button
                variant="outline"
                className="gap-2 border-gray-300 text-gray-600 hover:bg-gray-50"
                disabled={statusPending}
                onClick={() => changeOrderStatus("refunded")}
              >
                <AlertTriangle className="h-4 w-4" />
                זיכוי הזמנה
              </Button>
            )}
          </div>
        )}

        {isTerminal && (
          <div className="mb-6">
            {order.status === "delivered" && (
              <Button
                variant="outline"
                className="gap-2 border-gray-300 text-gray-600 hover:bg-gray-50"
                disabled={statusPending}
                onClick={() => changeOrderStatus("refunded")}
              >
                <AlertTriangle className="h-4 w-4" />
                זיכוי הזמנה
              </Button>
            )}
          </div>
        )}

        {/* ── Status change history ── */}
        {(order.statusHistory as StatusEntry[])?.length > 0 && (
          <div className="bg-muted/30 rounded-xl p-4 mb-6">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">יומן סטטוסים</p>
            <div className="space-y-1">
              {(order.statusHistory as StatusEntry[]).map((h, i) => (
                <div key={i} className="flex gap-3 text-sm">
                  <span className="font-medium w-20 shrink-0">{STATUS_LABEL[h.status] ?? h.status}</span>
                  <span className="text-muted-foreground">{formatDate(h.changedAt)} {formatTime(h.changedAt)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Main content: items + sidebar ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Items (2/3) */}
          <div className="lg:col-span-2 space-y-3">
            <h2 className="font-semibold text-base">פריטי הזמנה ({order.items.length})</h2>
            {order.items.map(item => (
              <ItemRow
                key={item.id}
                item={item}
                orderId={order.id}
                onUpdate={handleItemUpdate}
              />
            ))}
          </div>

          {/* Sidebar (1/3) */}
          <div className="space-y-4">

            {/* Customer */}
            <div className="bg-card border border-border rounded-xl p-4">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
                <User className="h-4 w-4 text-muted-foreground" />
                לקוח
              </h3>
              <p className="font-medium">
                {order.customerName ?? (order.userId ? `לקוח #${order.userId}` : "אורח")}
              </p>
              {order.userId && (
                <button
                  className="text-xs text-primary hover:underline mt-1"
                  onClick={() => navigate(`/admin/customers/${order.userId}`)}
                >
                  צפייה בפרופיל לקוח
                </button>
              )}
            </div>

            {/* Shipping address */}
            {addr && Object.keys(addr).length > 0 && (
              <div className="bg-card border border-border rounded-xl p-4">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  כתובת משלוח
                </h3>
                <div className="text-sm space-y-0.5">
                  {addr.fullName   && <p className="font-medium">{addr.fullName}</p>}
                  {addr.phone      && <p className="text-muted-foreground">{addr.phone}</p>}
                  {addr.street     && <p>{addr.street}{addr.apt ? ` דירה ${addr.apt}` : ""}</p>}
                  {addr.city       && <p>{addr.city}{addr.zip ? ` ${addr.zip}` : ""}</p>}
                </div>
              </div>
            )}

            {/* Order totals */}
            <div className="bg-card border border-border rounded-xl p-4">
              <h3 className="text-sm font-semibold mb-3">סיכום כספי</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">סכום ביניים</span>
                  <span>{formatPrice(order.subtotal)}</span>
                </div>
                {order.couponDiscount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>הנחת קופון {order.couponCode && `(${order.couponCode})`}</span>
                    <span>-{formatPrice(order.couponDiscount)}</span>
                  </div>
                )}
                {order.discount > 0 && (
                  <div className="flex justify-between text-amber-600">
                    <span>מימוש נקודות</span>
                    <span>-{formatPrice(order.discount)}</span>
                  </div>
                )}
                {order.shipping > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">משלוח</span>
                    <span>{formatPrice(order.shipping)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-base border-t border-border pt-2 mt-2">
                  <span>סה"כ לתשלום</span>
                  <span className="text-primary">{formatPrice(order.total)}</span>
                </div>
              </div>
            </div>

            {/* Loyalty */}
            {(order.loyaltyPointsEarned > 0 || order.loyaltyPointsUsed > 0) && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5 text-amber-800">
                  <Star className="h-4 w-4 fill-amber-500 text-amber-500" />
                  נקודות נאמנות
                </h3>
                {order.loyaltyPointsUsed > 0 && (
                  <p className="text-xs text-amber-700">נמשו: <strong>{order.loyaltyPointsUsed.toLocaleString("he-IL")} נק׳</strong> (₪{Number(order.loyaltyPointsUsedAmount).toFixed(2)})</p>
                )}
                {order.loyaltyPointsEarned > 0 && (
                  <p className="text-xs text-amber-700 mt-0.5">נצברו: <strong>{order.loyaltyPointsEarned.toLocaleString("he-IL")} נק׳</strong></p>
                )}
              </div>
            )}

            {/* Notes */}
            {order.notes && (
              <div className="bg-card border border-border rounded-xl p-4">
                <h3 className="text-sm font-semibold mb-1">הערות</h3>
                <p className="text-sm text-muted-foreground">{order.notes}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
