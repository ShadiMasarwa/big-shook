import { useState, useCallback, useEffect } from "react";
import { useParams, Link } from "wouter";
import { AdminLayout } from "@/components/admin-layout";
import { useListOrders } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/components/ui/use-toast";
import { formatPrice } from "@/lib/utils";
import {
  ArrowRight, Mail, Phone, CalendarDays, ShoppingBag, Star,
  CreditCard, User, Send, ShieldCheck, ShieldX, MailCheck, MailX,
  ChevronUp, ChevronDown, Plus, Minus,
} from "lucide-react";

// ─── types ───────────────────────────────────────────────────────────────────

type LoyaltyTier = "bronze" | "silver" | "gold" | "vip";

interface UserData {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  role: string;
  loyaltyPoints: number;
  loyaltyTier: LoyaltyTier;
  totalSpent: number;
  ordersCount: number;
  isActive: boolean;
  marketingEmails: boolean;
  createdAt: string;
}

// ─── constants ────────────────────────────────────────────────────────────────

const ORDER_STATUSES: Record<string, { label: string; className: string }> = {
  pending:    { label: "ממתין",   className: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  confirmed:  { label: "אושר",    className: "bg-blue-100 text-blue-800 border-blue-200" },
  processing: { label: "בטיפול",  className: "bg-purple-100 text-purple-800 border-purple-200" },
  shipped:    { label: "נשלח",    className: "bg-indigo-100 text-indigo-800 border-indigo-200" },
  delivered:  { label: "נמסר",    className: "bg-green-100 text-green-800 border-green-200" },
  cancelled:  { label: "בוטל",    className: "bg-red-100 text-red-800 border-red-200" },
  refunded:   { label: "זוכה",    className: "bg-gray-100 text-gray-800 border-gray-200" },
};

const TIERS: { value: LoyaltyTier; label: string; className: string }[] = [
  { value: "bronze", label: "ברונזה", className: "bg-orange-100 text-orange-800 border-orange-200" },
  { value: "silver", label: "כסף",   className: "bg-slate-100 text-slate-700 border-slate-300" },
  { value: "gold",   label: "זהב",   className: "bg-yellow-100 text-yellow-800 border-yellow-300" },
  { value: "vip",    label: "VIP",   className: "bg-purple-100 text-purple-800 border-purple-200" },
];

const TIER_MAP = Object.fromEntries(TIERS.map(t => [t.value, t]));

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

// ─── component ────────────────────────────────────────────────────────────────

export default function AdminUserDetail() {
  const { id } = useParams<{ id: string }>();
  const userId = parseInt(id!, 10);

  const [user, setUser] = useState<UserData | null>(null);
  const [userLoading, setUserLoading] = useState(true);

  const { data: ordersData, isLoading: ordersLoading } = useListOrders({ userId, limit: 100 });

  // ── actions state ──
  const [pointsAmount, setPointsAmount] = useState("");
  const [pointsReason, setPointsReason] = useState("");
  const [pointsPending, setPointsPending] = useState(false);
  const [togglePending, setTogglePending] = useState<string | null>(null);

  const fetchUser = useCallback(async () => {
    setUserLoading(true);
    try {
      const data = await authFetch(`/api/users/${userId}`);
      setUser(data);
    } catch {
      toast({ title: "שגיאה בטעינת פרטי משתמש", variant: "destructive" });
    } finally {
      setUserLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchUser(); }, [fetchUser]);

  // ── patch helper ──
  const patch = async (body: Record<string, unknown>, successMsg: string) => {
    const updated = await authFetch(`/api/users/${userId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    setUser(updated);
    toast({ title: successMsg });
    return updated;
  };

  // ── 1. Loyalty points ──
  const adjustPoints = async (sign: 1 | -1) => {
    const amt = parseInt(pointsAmount, 10);
    if (!amt || amt <= 0) { toast({ title: "הכנס כמות נקודות תקינה", variant: "destructive" }); return; }
    if (!pointsReason.trim()) { toast({ title: "הכנס סיבה לשינוי הנקודות", variant: "destructive" }); return; }
    setPointsPending(true);
    try {
      const updated = await authFetch(`/api/users/${userId}/loyalty`, {
        method: "PATCH",
        body: JSON.stringify({ points: sign * amt, reason: pointsReason.trim() }),
      });
      setUser(updated);
      toast({ title: `נקודות ${sign === 1 ? "נוספו" : "הופחתו"} בהצלחה` });
      setPointsAmount("");
      setPointsReason("");
    } catch {
      toast({ title: "שגיאה בעדכון נקודות", variant: "destructive" });
    } finally {
      setPointsPending(false);
    }
  };

  // ── 2. Active toggle ──
  const toggleActive = async () => {
    if (!user) return;
    setTogglePending("active");
    try {
      await patch({ isActive: !user.isActive }, user.isActive ? "משתמש הושבת" : "משתמש הופעל");
    } catch {
      toast({ title: "שגיאה בעדכון סטטוס", variant: "destructive" });
    } finally {
      setTogglePending(null);
    }
  };

  // ── 3. Marketing emails toggle ──
  const toggleMarketing = async () => {
    if (!user) return;
    setTogglePending("marketing");
    try {
      await patch(
        { marketingEmails: !user.marketingEmails },
        user.marketingEmails ? "הסרה מרשימת תפוצה" : "הוספה לרשימת תפוצה",
      );
    } catch {
      toast({ title: "שגיאה בעדכון הגדרות פרסום", variant: "destructive" });
    } finally {
      setTogglePending(null);
    }
  };

  // ── 4. Tier change ──
  const changeTier = async (dir: "up" | "down") => {
    if (!user) return;
    const idx = TIERS.findIndex(t => t.value === user.loyaltyTier);
    const newIdx = dir === "up" ? idx + 1 : idx - 1;
    if (newIdx < 0 || newIdx >= TIERS.length) return;
    setTogglePending("tier");
    try {
      await patch({ loyaltyTier: TIERS[newIdx].value }, `דרגה שונתה ל-${TIERS[newIdx].label}`);
    } catch {
      toast({ title: "שגיאה בשינוי דרגה", variant: "destructive" });
    } finally {
      setTogglePending(null);
    }
  };

  const tier = user ? (TIER_MAP[user.loyaltyTier] ?? { label: user.loyaltyTier, className: "" }) : null;
  const tierIdx = user ? TIERS.findIndex(t => t.value === user.loyaltyTier) : -1;

  return (
    <AdminLayout>
      <div className="max-w-6xl mx-auto" dir="rtl">

        {/* ── back + header ── */}
        <div className="mb-6">
          <Link href="/admin/customers" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
            <ArrowRight className="h-4 w-4" />
            חזרה לרשימת לקוחות
          </Link>

          {userLoading ? (
            <div className="space-y-2 mt-2">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-64" />
            </div>
          ) : user ? (
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div>
                <h1 className="text-3xl font-bold">{user.firstName} {user.lastName}</h1>
                <p className="text-muted-foreground mt-1">{user.email}</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={`text-sm px-3 py-1 border ${tier?.className}`}>{tier?.label}</Badge>
                {user.isActive
                  ? <Badge className="bg-green-100 text-green-800 border-green-200 border">פעיל</Badge>
                  : <Badge className="bg-red-100 text-red-800 border-red-200 border">לא פעיל</Badge>
                }
              </div>
            </div>
          ) : (
            <h1 className="text-3xl font-bold text-destructive">משתמש לא נמצא</h1>
          )}
        </div>

        {!userLoading && user && (
          <>
            {/* ── stat cards ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-1">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Star className="h-4 w-4 text-amber-500" /> נקודות מועדון
                </div>
                <div className="text-2xl font-bold text-amber-600">{user.loyaltyPoints.toLocaleString()}</div>
              </div>
              <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-1">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <ShoppingBag className="h-4 w-4 text-primary" /> הזמנות
                </div>
                <div className="text-2xl font-bold">{user.ordersCount}</div>
              </div>
              <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-1">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <CreditCard className="h-4 w-4 text-green-600" /> סה"כ קניות
                </div>
                <div className="text-2xl font-bold text-primary">{formatPrice(user.totalSpent)}</div>
              </div>
              <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-1">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Mail className="h-4 w-4" /> פרסומים
                </div>
                <div className="text-lg font-semibold">
                  {user.marketingEmails
                    ? <span className="text-green-600">מנוי פעיל</span>
                    : <span className="text-muted-foreground">לא מנוי</span>
                  }
                </div>
              </div>
            </div>

            {/* ── main grid: info + actions ── */}
            <div className="grid lg:grid-cols-3 gap-6 mb-8">

              {/* Left col: contact + loyalty */}
              <div className="lg:col-span-2 space-y-5">

                <div className="bg-card border border-border rounded-xl p-5">
                  <h2 className="text-lg font-bold mb-4">פרטי קשר</h2>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 text-sm">
                      <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span>{user.email}</span>
                    </div>
                    {user.phone && (
                      <div className="flex items-center gap-3 text-sm">
                        <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span dir="ltr">{user.phone}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-3 text-sm">
                      <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span>נרשם: {new Date(user.createdAt).toLocaleDateString("he-IL", { year: "numeric", month: "long", day: "numeric" })}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-card border border-border rounded-xl p-5">
                  <h2 className="text-lg font-bold mb-4">תוכנית נאמנות</h2>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">דרגה</span>
                      <Badge className={`border ${tier?.className}`}>{tier?.label}</Badge>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">נקודות צבורות</span>
                      <span className="font-bold text-amber-600">{user.loyaltyPoints.toLocaleString()} נק'</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">סה"כ רכישות</span>
                      <span className="font-bold">{formatPrice(user.totalSpent)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right col: admin actions */}
              <div className="space-y-4">

                {/* 1. Points */}
                <div className="bg-card border border-border rounded-xl p-4">
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
                    <Star className="h-4 w-4 text-amber-500" />
                    התאמת נקודות נאמנות
                  </h3>
                  <div className="space-y-2">
                    <Input
                      type="number"
                      min={1}
                      placeholder="כמות נקודות"
                      value={pointsAmount}
                      onChange={e => setPointsAmount(e.target.value)}
                      className="text-sm h-8"
                      dir="ltr"
                    />
                    <Input
                      placeholder="סיבה (חובה)"
                      value={pointsReason}
                      onChange={e => setPointsReason(e.target.value)}
                      className="text-sm h-8"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1 h-8 text-xs gap-1 bg-green-600 hover:bg-green-700 text-white"
                        disabled={pointsPending}
                        onClick={() => adjustPoints(1)}
                      >
                        <Plus className="h-3 w-3" /> הוסף
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 h-8 text-xs gap-1 border-red-200 text-red-600 hover:bg-red-50"
                        disabled={pointsPending}
                        onClick={() => adjustPoints(-1)}
                      >
                        <Minus className="h-3 w-3" /> הפחת
                      </Button>
                    </div>
                  </div>
                </div>

                {/* 2. Active toggle */}
                <div className="bg-card border border-border rounded-xl p-4">
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
                    <User className="h-4 w-4" />
                    סטטוס חשבון
                  </h3>
                  <Button
                    size="sm"
                    variant="outline"
                    className={`w-full h-8 text-xs gap-1.5 ${user.isActive
                      ? "border-red-200 text-red-600 hover:bg-red-50"
                      : "border-green-200 text-green-700 hover:bg-green-50"
                    }`}
                    disabled={togglePending === "active"}
                    onClick={toggleActive}
                  >
                    {user.isActive
                      ? <><ShieldX className="h-3.5 w-3.5" /> השבת משתמש</>
                      : <><ShieldCheck className="h-3.5 w-3.5" /> הפעל משתמש</>
                    }
                  </Button>
                </div>

                {/* 3. Marketing emails toggle */}
                <div className="bg-card border border-border rounded-xl p-4">
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
                    <Mail className="h-4 w-4" />
                    פרסומים במייל
                  </h3>
                  <Button
                    size="sm"
                    variant="outline"
                    className={`w-full h-8 text-xs gap-1.5 ${user.marketingEmails
                      ? "border-orange-200 text-orange-600 hover:bg-orange-50"
                      : "border-green-200 text-green-700 hover:bg-green-50"
                    }`}
                    disabled={togglePending === "marketing"}
                    onClick={toggleMarketing}
                  >
                    {user.marketingEmails
                      ? <><MailX className="h-3.5 w-3.5" /> הסר מתפוצה</>
                      : <><MailCheck className="h-3.5 w-3.5" /> הוסף לתפוצה</>
                    }
                  </Button>
                </div>

                {/* 4. Tier management */}
                <div className="bg-card border border-border rounded-xl p-4">
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    דרגת מועדון
                  </h3>
                  <div className="flex items-center gap-2">
                    <Badge className={`flex-1 justify-center py-1 border text-sm ${tier?.className}`}>
                      {tier?.label}
                    </Badge>
                    <div className="flex flex-col gap-1">
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-6 w-6"
                        disabled={tierIdx >= TIERS.length - 1 || togglePending === "tier"}
                        onClick={() => changeTier("up")}
                        title="שדרג דרגה"
                      >
                        <ChevronUp className="h-3 w-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-6 w-6"
                        disabled={tierIdx <= 0 || togglePending === "tier"}
                        onClick={() => changeTier("down")}
                        title="הורד דרגה"
                      >
                        <ChevronDown className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-2">
                    {tierIdx < TIERS.length - 1 && `▲ ${TIERS[tierIdx + 1]?.label}`}
                    {tierIdx > 0 && tierIdx < TIERS.length - 1 && " · "}
                    {tierIdx > 0 && `▼ ${TIERS[tierIdx - 1]?.label}`}
                  </p>
                </div>

                {/* 5. Send email (placeholder) */}
                <div className="bg-card border border-border rounded-xl p-4">
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
                    <Send className="h-4 w-4" />
                    שליחת מייל
                  </h3>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full h-8 text-xs gap-1.5"
                    disabled
                    title="תכונה בפיתוח"
                  >
                    <Send className="h-3.5 w-3.5" />
                    שלח מייל ללקוח
                  </Button>
                  <p className="text-[10px] text-muted-foreground mt-1.5 text-center">בקרוב</p>
                </div>

              </div>
            </div>

            {/* ── orders table ── */}
            <div>
              <h2 className="text-xl font-bold mb-4">היסטוריית הזמנות</h2>
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">מספר הזמנה</TableHead>
                      <TableHead className="text-right">תאריך</TableHead>
                      <TableHead className="text-center">פריטים</TableHead>
                      <TableHead className="text-center">סטטוס</TableHead>
                      <TableHead className="text-center">נקודות</TableHead>
                      <TableHead className="text-left">סכום</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ordersLoading ? (
                      [...Array(3)].map((_, i) => (
                        <TableRow key={i}>
                          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-8 mx-auto" /></TableCell>
                          <TableCell><Skeleton className="h-6 w-16 mx-auto rounded-full" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-12 mx-auto" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                        </TableRow>
                      ))
                    ) : !ordersData?.orders || ordersData.orders.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                          אין הזמנות ללקוח זה
                        </TableCell>
                      </TableRow>
                    ) : (
                      ordersData.orders.map(order => {
                        const statusInfo = ORDER_STATUSES[order.status] ?? { label: order.status, className: "" };
                        return (
                          <TableRow key={order.id}>
                            <TableCell className="font-mono font-medium text-primary">
                              <Link href={`/admin/orders/${order.id}`} className="hover:underline font-mono">
                                #{order.orderNumber}
                              </Link>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {new Date(order.createdAt).toLocaleDateString("he-IL", { year: "numeric", month: "short", day: "numeric" })}
                            </TableCell>
                            <TableCell className="text-center">{order.items?.length ?? "—"}</TableCell>
                            <TableCell className="text-center">
                              <Badge className={`border text-xs ${statusInfo.className}`}>
                                {statusInfo.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center text-amber-600 font-medium">
                              {order.loyaltyPointsEarned > 0 ? `+${order.loyaltyPointsEarned}` : "—"}
                            </TableCell>
                            <TableCell className="text-left font-bold">{formatPrice(order.total)}</TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
