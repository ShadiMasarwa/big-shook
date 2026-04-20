import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  LogOut,
  Tags,
  Percent,
  Star,
  LineChart,
  Download,
  Truck,
  Layers,
  Award,
  Megaphone,
  Images,
  Settings2,
  UserCog,
  Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const ALL_NAV_ITEMS = [
  { href: "/admin", label: "לוח בקרה", icon: LayoutDashboard, section: null },
  { href: "/admin/analytics", label: "דוחות וסטטיסטיקה", icon: LineChart, section: "analytics" },
  { href: "/admin/orders", label: "הזמנות", icon: ShoppingCart, section: "orders" },
  { href: "/admin/products", label: "מוצרים", icon: Package, section: "products" },
  { href: "/admin/categories", label: "קטגוריות", icon: Layers, section: "categories" },
  { href: "/admin/brands", label: "מותגים", icon: Award, section: "brands" },
  { href: "/admin/suppliers", label: "ספקים", icon: Truck, section: "suppliers" },
  { href: "/admin/inventory", label: "מלאי", icon: Tags, section: "inventory" },
  { href: "/admin/customers", label: "לקוחות", icon: Users, section: "customers" },
  { href: "/admin/coupons", label: "קופונים", icon: Percent, section: "coupons" },
  { href: "/admin/loyalty", label: "מועדון לקוחות", icon: Star, section: "loyalty" },
  { href: "/admin/import", label: "ייבוא וייצוא", icon: Download, section: "import" },
  { href: "/admin/ads", label: "מודעות", icon: Megaphone, section: "ads" },
  { href: "/admin/media", label: "ספריית מדיה", icon: Images, section: "media" },
  { href: "/admin/site-info", label: "מידע האתר", icon: Settings2, section: "settings" },
  { href: "/admin/messages", label: "מרכז הודעות", icon: Mail, section: null },
  { href: "/admin/managers", label: "ניהול מנהלים", icon: UserCog, section: "managers_only" },
];

function AdminHeaderBell() {
  const { data } = useQuery({
    queryKey: ["admin-messages-unread"],
    queryFn: async () => {
      const t = localStorage.getItem("token");
      const headers: Record<string, string> = t ? { Authorization: `Bearer ${t}` } : {};
      const res = await fetch("/api/admin/messages/unread-count", { headers });
      if (!res.ok) return { total: 0 };
      return res.json() as Promise<{ total: number }>;
    },
    refetchInterval: 30000,
  });
  const count = data?.total ?? 0;
  return (
    <Link
      href="/admin/messages"
      className="relative inline-flex items-center justify-center h-10 w-10 rounded-full hover:bg-muted transition-colors"
      aria-label={count ? `${count} הודעות חדשות` : "מרכז הודעות"}
      data-testid="header-messages-bell"
    >
      <Mail className="h-5 w-5" />
      {count > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center border-2 border-card">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}

export function AdminLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const [location] = useLocation();

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <div className="text-center bg-card border border-border rounded-2xl p-10 shadow-sm max-w-sm w-full mx-4">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Package className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold mb-2">כניסה לאדמין</h1>
          <p className="text-muted-foreground mb-6">יש להתחבר עם חשבון מנהל מערכת כדי לגשת לאזור זה.</p>
          <Button asChild className="w-full mb-3">
            <Link href="/auth">התחבר כמנהל</Link>
          </Button>
          <Button variant="ghost" asChild className="w-full">
            <Link href="/">חזרה לדף הבית</Link>
          </Button>
        </div>
      </div>
    );
  }

  const isAdmin = user.role === "admin";
  const isManager = user.role === "manager";

  if (!isAdmin && !isManager) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <div className="text-center bg-card border border-border rounded-2xl p-10 shadow-sm max-w-sm w-full mx-4">
          <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <Package className="h-8 w-8 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold text-destructive mb-2">אין הרשאה</h1>
          <p className="text-muted-foreground mb-6">המשתמש שלך אינו מורשה לגשת לאזור הניהול.</p>
          <Button asChild>
            <Link href="/">חזרה לדף הבית</Link>
          </Button>
        </div>
      </div>
    );
  }

  const privileges = (user as any).privileges as Record<string, string> | null | undefined;

  const navItems = ALL_NAV_ITEMS.filter((item) => {
    if (item.section === "managers_only") return isAdmin;
    if (item.section === null) return true;
    if (isAdmin) return true;
    const level = privileges?.[item.section];
    return level === "read_only" || level === "read_write" || level === "all";
  });

  return (
    <div className="min-h-[100dvh] flex bg-muted/30">
      {/* Sidebar */}
      <aside className="w-64 bg-card border-l border-border flex flex-col hidden md:flex sticky top-0 h-screen">
        <div className="p-6 border-b border-border">
          <Link href="/admin" className="text-2xl font-black text-primary flex items-center gap-2">
            <Package className="h-6 w-6" />
            טק-סטור אדמין
          </Link>
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.href || (item.href !== "/admin" && location.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3 mb-4 px-3">
            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
              {user.firstName[0]}
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium">{user.firstName} {user.lastName}</span>
              <span className="text-xs text-muted-foreground">
                {isAdmin ? "מנהל מערכת" : "מנהל"}
              </span>
            </div>
          </div>
          <Button variant="outline" className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => logout()}>
            <LogOut className="ml-2 h-4 w-4" />
            התנתק
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 bg-card border-b border-border flex items-center justify-between px-6 sticky top-0 z-10">
          <h1 className="text-xl font-bold md:hidden">לוח בקרה מנהלים</h1>
          <div className="hidden md:block" />
          <AdminHeaderBell />
        </header>
        <div className="flex-1 p-6 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
