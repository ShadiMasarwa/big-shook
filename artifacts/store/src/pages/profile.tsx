import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import {
  User, Star, Package, ChevronLeft, CheckCircle, Loader2,
  MapPin, Phone, Medal, ShoppingBag, Coins,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Order {
  id: number; status: string; total: number;
  createdAt: string; items: { productName: string }[];
}

// ── Tier helpers ──────────────────────────────────────────────────────────────
const TIERS = [
  { name: "bronze", label: "ברונזה", min: 0,    next: 500,  color: "text-orange-700",  bg: "bg-orange-100" },
  { name: "silver", label: "כסף",    min: 500,  next: 2000, color: "text-slate-600",   bg: "bg-slate-100" },
  { name: "gold",   label: "זהב",    min: 2000, next: 5000, color: "text-amber-600",   bg: "bg-amber-100" },
  { name: "vip",    label: "VIP",    min: 5000, next: null, color: "text-purple-700",  bg: "bg-purple-100" },
];

function getTierInfo(points: number) {
  return TIERS.slice().reverse().find(t => points >= t.min) ?? TIERS[0];
}

function formatPrice(n: number) {
  return new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(n);
}

function formatDate(s: string) {
  return new Date(s).toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending:    { label: "ממתין",    variant: "outline" },
  confirmed:  { label: "אושר",     variant: "secondary" },
  processing: { label: "בטיפול",   variant: "secondary" },
  shipped:    { label: "נשלח",     variant: "default" },
  delivered:  { label: "נמסר",     variant: "default" },
  cancelled:  { label: "בוטל",     variant: "destructive" },
};

interface LoyaltyTierDef {
  name: string; nameHe: string; minSpent: number;
  shekelPerPoint: number; color: string; icon: string; sortOrder: number;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function Profile() {
  const { user, refreshUser } = useAuth() as any;
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: tierDefs } = useQuery<LoyaltyTierDef[]>({
    queryKey: ["loyalty-tiers"],
    queryFn: async () => {
      const res = await fetch("/api/loyalty/tiers");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  // Form state — mirrors editable fields
  const [firstName, setFirstName]     = useState("");
  const [lastName, setLastName]       = useState("");
  const [phone, setPhone]             = useState("");
  const [city, setCity]               = useState("");
  const [street, setStreet]           = useState("");
  const [houseNumber, setHouseNumber] = useState("");
  const [zipCode, setZipCode]         = useState("");
  const [saving, setSaving]           = useState(false);

  // Orders
  const [orders, setOrders]   = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  // Seed form from user
  useEffect(() => {
    if (!user) return;
    setFirstName(user.firstName ?? "");
    setLastName(user.lastName ?? "");
    setPhone(user.phone ?? "");
    setCity(user.city ?? "");
    setStreet(user.street ?? "");
    setHouseNumber(user.houseNumber ?? "");
    setZipCode(user.zipCode ?? "");
  }, [user]);

  // Load orders
  useEffect(() => {
    if (!user) return;
    setOrdersLoading(true);
    const token = localStorage.getItem("token");
    fetch(`/api/orders?userId=${user.id}&limit=50`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.json())
      .then(d => setOrders(d.orders ?? []))
      .catch(() => {})
      .finally(() => setOrdersLoading(false));
  }, [user]);

  if (!user) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <User className="h-16 w-16 text-muted-foreground" />
          <p className="text-lg text-muted-foreground">יש להתחבר כדי לצפות בפרופיל</p>
          <Button onClick={() => setLocation("/auth")}>התחבר / הרשם</Button>
        </div>
      </Layout>
    );
  }

  const tierInfo = getTierInfo(user.loyaltyPoints ?? 0);
  const nextTier = TIERS.find(t => t.min > (user.loyaltyPoints ?? 0));
  const progressPct = nextTier
    ? Math.min(100, (((user.loyaltyPoints ?? 0) - tierInfo.min) / (nextTier.min - tierInfo.min)) * 100)
    : 100;

  // Look up this user's per-tier exchange rate from the DB
  const currentTierName = user.loyaltyTier ?? "bronze";
  const currentTierDef = tierDefs?.find(t => t.name === currentTierName);
  const shekelPerPoint = currentTierDef?.shekelPerPoint ?? 0.01;
  const valueOf1000Points = (1000 * shekelPerPoint).toFixed(2);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ firstName, lastName, phone, city, street, houseNumber, zipCode }),
      });
      if (!res.ok) throw new Error("שגיאה בשמירה");
      if (refreshUser) await refreshUser();
      toast({ title: "הפרטים עודכנו בהצלחה ✓" });
    } catch {
      toast({ title: "שגיאה בשמירת הפרטים", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-10 max-w-5xl" dir="rtl">

        {/* ── Header ── */}
        <div className="flex items-center gap-4 mb-8">
          <div className={`w-16 h-16 rounded-full ${tierInfo.bg} flex items-center justify-center shrink-0`}>
            <span className={`text-2xl font-black ${tierInfo.color}`}>
              {user.firstName?.[0]}{user.lastName?.[0]}
            </span>
          </div>
          <div>
            <h1 className="text-2xl font-black">{user.firstName} {user.lastName}</h1>
            <p className="text-muted-foreground text-sm">{user.email}</p>
            <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full mt-1 ${tierInfo.bg} ${tierInfo.color}`}>
              <Medal className="h-3 w-3" /> {tierInfo.label}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── LEFT COLUMN: form + loyalty ── */}
          <div className="lg:col-span-2 space-y-6">

            {/* Personal info */}
            <div className="bg-card border border-border rounded-2xl p-6">
              <h2 className="text-lg font-bold mb-5 flex items-center gap-2">
                <User className="h-5 w-5 text-primary" /> פרטים אישיים
              </h2>
              <form onSubmit={handleSave} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>שם פרטי</Label>
                    <Input value={firstName} onChange={e => setFirstName(e.target.value)} required />
                  </div>
                  <div className="space-y-1.5">
                    <Label>שם משפחה</Label>
                    <Input value={lastName} onChange={e => setLastName(e.target.value)} required />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> טלפון</Label>
                  <Input value={phone} onChange={e => setPhone(e.target.value)} type="tel" dir="ltr" placeholder="050-0000000" />
                </div>

                <div className="border-t pt-4">
                  <p className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" /> כתובת למשלוח
                  </p>
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-3">
                      <div className="col-span-2 space-y-1.5">
                        <Label>רחוב</Label>
                        <Input value={street} onChange={e => setStreet(e.target.value)} placeholder="הרצל" />
                      </div>
                      <div className="space-y-1.5">
                        <Label>מספר</Label>
                        <Input value={houseNumber} onChange={e => setHouseNumber(e.target.value)} placeholder="1" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>עיר</Label>
                        <Input value={city} onChange={e => setCity(e.target.value)} placeholder="תל אביב" />
                      </div>
                      <div className="space-y-1.5">
                        <Label>מיקוד</Label>
                        <Input value={zipCode} onChange={e => setZipCode(e.target.value)} placeholder="6100000" dir="ltr" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-start pt-2">
                  <Button type="submit" disabled={saving} className="gap-2">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                    שמור שינויים
                  </Button>
                </div>
              </form>
            </div>

            {/* Order history */}
            <div className="bg-card border border-border rounded-2xl p-6">
              <h2 className="text-lg font-bold mb-5 flex items-center gap-2">
                <ShoppingBag className="h-5 w-5 text-primary" /> היסטוריית הזמנות
                {orders.length > 0 && (
                  <span className="mr-auto text-sm font-normal text-muted-foreground">{orders.length} הזמנות</span>
                )}
              </h2>

              {ordersLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : orders.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>עדיין לא ביצעת הזמנות</p>
                  <Button variant="outline" className="mt-4" onClick={() => setLocation("/catalog")}>
                    גלה מוצרים
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {orders.map(order => {
                    const st = STATUS_MAP[order.status] ?? { label: order.status, variant: "outline" as const };
                    return (
                      <button
                        key={order.id}
                        onClick={() => setLocation(`/orders/${order.id}`)}
                        className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-muted transition-colors text-right border border-border"
                      >
                        <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
                          <Package className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm">הזמנה #{order.id}</span>
                            <Badge variant={st.variant} className="text-xs">{st.label}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {formatDate(order.createdAt)}
                            {order.items?.length > 0 && ` · ${order.items.length} פריטים`}
                          </p>
                        </div>
                        <div className="text-left shrink-0">
                          <p className="font-bold text-sm">{formatPrice(order.total)}</p>
                          <ChevronLeft className="h-4 w-4 text-muted-foreground mx-auto mt-0.5" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ── RIGHT COLUMN: loyalty ── */}
          <div className="space-y-6">
            <div className="bg-card border border-border rounded-2xl p-6">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Star className="h-5 w-5 text-amber-500" /> מועדון לקוחות
              </h2>

              {/* Points display */}
              <div className={`rounded-xl p-4 ${tierInfo.bg} mb-4 text-center`}>
                <p className={`text-4xl font-black ${tierInfo.color}`}>{(user.loyaltyPoints ?? 0).toLocaleString("he-IL")}</p>
                <p className="text-sm text-muted-foreground mt-1">נקודות</p>
              </div>

              {/* Tier badge */}
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium">דרגה נוכחית</span>
                <span className={`text-sm font-bold ${tierInfo.color} flex items-center gap-1`}>
                  <Medal className="h-4 w-4" /> {tierInfo.label}
                </span>
              </div>

              {/* Progress bar */}
              {nextTier && (
                <>
                  <div className="h-2 bg-muted rounded-full overflow-hidden mb-2">
                    <div
                      className="h-full bg-amber-400 rounded-full transition-all duration-700"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{tierInfo.label}</span>
                    <span>{(nextTier.min - (user.loyaltyPoints ?? 0)).toLocaleString("he-IL")} נקודות לדרגת {TIERS.find(t => t.name === nextTier.name)?.label}</span>
                  </div>
                </>
              )}

              {!nextTier && (
                <p className="text-center text-sm text-purple-600 font-bold mt-2">✨ הגעת לדרגה הגבוהה ביותר!</p>
              )}

              {/* Exchange rate for this tier */}
              <div className="mt-4 rounded-xl bg-muted/60 px-4 py-3 flex items-center gap-3">
                <Coins className={`h-5 w-5 shrink-0 ${tierInfo.color}`} />
                <div className="flex-1 text-sm leading-tight">
                  <span className="text-muted-foreground">שווי 1,000 נקודות בדרגת </span>
                  <span className={`font-bold ${tierInfo.color}`}>{tierInfo.label}</span>
                  <span className="text-muted-foreground">:</span>
                  <span className="font-black text-foreground text-base mr-1">
                    ₪{valueOf1000Points}
                  </span>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3 mt-5 pt-4 border-t">
                <div className="text-center">
                  <p className="text-xl font-black">{user.ordersCount ?? 0}</p>
                  <p className="text-xs text-muted-foreground">הזמנות</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-black">{formatPrice(user.totalSpent ?? 0)}</p>
                  <p className="text-xs text-muted-foreground">סה״כ קניות</p>
                </div>
              </div>

              <Button
                variant="outline"
                className="w-full mt-4"
                onClick={() => setLocation("/loyalty")}
              >
                <Star className="h-4 w-4 ml-1" /> לפרטי מועדון הלקוחות
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
