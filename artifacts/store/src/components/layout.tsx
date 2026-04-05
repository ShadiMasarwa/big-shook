import { ReactNode, useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation, useSearch } from "wouter";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { useCart } from "@/hooks/use-cart";
import {
  ShoppingCart,
  User,
  Heart,
  Search,
  Menu,
  Star,
  X,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useListCategories, useGetWishlist } from "@workspace/api-client-react";

type AdItem = { id: number; position: number; imageUrl: string; linkUrl?: string | null; title?: string | null };

function AdsCarousel({ ads }: { ads: AdItem[] }) {
  const [current, setCurrent] = useState(0);
  const paused = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (ads.length <= 1) return;
    const tick = () => {
      if (!paused.current) setCurrent(i => (i + 1) % ads.length);
    };
    intervalRef.current = setInterval(tick, 4000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [ads.length]);

  const sorted = [...ads].sort((a, b) => a.position - b.position);

  return (
    <div
      className="relative overflow-hidden rounded-lg"
      style={{ aspectRatio: "2/1" }}
      onMouseEnter={() => { paused.current = true; }}
      onMouseLeave={() => { paused.current = false; }}
    >
      {/* Slides strip — LTR so translateX maths is straightforward */}
      <div
        dir="ltr"
        className="flex h-full transition-transform duration-700 ease-in-out"
        style={{ transform: `translateX(-${current * 100}%)` }}
      >
        {sorted.map(ad => {
          const img = (
            <img
              src={ad.imageUrl}
              alt={ad.title ?? `מודעה ${ad.position}`}
              className="w-full h-full object-cover"
            />
          );
          return (
            <div key={ad.id} className="w-full shrink-0 h-full">
              {ad.linkUrl ? (
                <a href={ad.linkUrl} target="_blank" rel="noopener noreferrer" className="block w-full h-full">
                  {img}
                </a>
              ) : img}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const { cart } = useCart();
  const { data: wishlist } = useGetWishlist();
  const [location, navigate] = useLocation();
  const [searchValue, setSearchValue] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const search = useSearch();
  const searchParams = new URLSearchParams(search);
  const activeCategoryId = searchParams.get("categoryId")
    ? Number(searchParams.get("categoryId"))
    : null;
  const isOnCatalog =
    location === "/catalog" || location.startsWith("/catalog");

  const { data: categories } = useListCategories();

  const { data: ads } = useQuery<AdItem[]>({
    queryKey: ["ads"],
    queryFn: async () => {
      const res = await fetch("/api/ads");
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchValue.trim();
    if (q) {
      navigate(`/catalog?q=${encodeURIComponent(q)}`);
      setMobileOpen(false);
    }
  };

  const handleCategoryClick = () => setMobileOpen(false);

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background font-sans text-foreground">
      {/* Top bar */}
      <div className="bg-primary text-primary-foreground py-2 px-4 text-sm flex justify-between items-center">
        <div>שירות לקוחות: 077-1234577</div>
        <div className="hidden md:block">משלוח חינם בקנייה מעל ₪299</div>
      </div>

      {/* Main Header */}
      <header className="sticky top-0 z-50 bg-background border-b border-border shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-4 md:gap-8">
          {/* Mobile hamburger */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden shrink-0"
            onClick={() => setMobileOpen(true)}
            aria-label="פתח תפריט"
            data-testid="btn-mobile-menu"
          >
            <Menu className="h-6 w-6" />
          </Button>

          <Link
            href="/"
            className="shrink-0 flex items-center gap-2"
            data-testid="link-logo"
          >
            <img src="/logo.gif" alt="ביג-שווק" className="h-12 w-auto" />
            <div className="flex flex-col leading-tight">
              <span className="text-xl font-black text-primary">ביג שווק</span>
              <span className="text-xs text-muted-foreground font-medium">חנות מבצעים</span>
            </div>
          </Link>

          {/* Desktop search */}
          <form
            onSubmit={handleSearch}
            className="flex-1 max-w-2xl hidden md:flex relative"
          >
            <Input
              placeholder="חפש מוצרים, מותגים וקטגוריות..."
              className="w-full pr-10 rounded-full bg-muted border-none"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              data-testid="input-search"
            />
            <button
              type="submit"
              className="absolute right-3 top-1/2 -translate-y-1/2"
              aria-label="חפש"
            >
              <Search className="h-5 w-5 text-muted-foreground hover:text-primary transition-colors" />
            </button>
          </form>

          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden md:flex items-center gap-1 text-sm mr-4">
              {user ? (
                <div className="flex items-center gap-2">
                  <Link
                    href="/profile"
                    className="flex flex-col text-left hover:text-primary transition-colors"
                  >
                    <span className="font-medium">שלום, {user.firstName}</span>
                    {user.loyaltyTier && (
                      <span className="text-xs text-amber-500 font-bold flex items-center justify-end gap-1">
                        <Star className="h-3 w-3" /> {user.loyaltyTier}
                      </span>
                    )}
                  </Link>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={async () => {
                      await logout();
                      navigate("/");
                    }}
                    data-testid="btn-logout"
                    title="התנתק"
                  >
                    <LogOut className="h-5 w-5" />
                  </Button>
                </div>
              ) : (
                <Link
                  href="/auth"
                  className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
                >
                  <User className="h-5 w-5" />
                  <span>התחבר / הרשם</span>
                </Link>
              )}
            </div>

            <Link href="/wishlist">
              <Button
                variant="ghost"
                size="icon"
                className="relative"
                data-testid="link-wishlist"
              >
                <Heart className="h-5 w-5" />
                {wishlist && wishlist.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                    {wishlist.length}
                  </span>
                )}
              </Button>
            </Link>

            <Link href="/cart">
              <Button
                variant="ghost"
                size="icon"
                className="relative"
                data-testid="link-cart"
              >
                <ShoppingCart className="h-5 w-5" />
                {cart && cart.itemCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                    {cart.itemCount}
                  </span>
                )}
              </Button>
            </Link>
          </div>
        </div>

        {/* Desktop Categories Menu */}
        <div className="border-t border-border hidden md:block">
          <div className="container mx-auto px-4">
            <ul className="flex items-center gap-6 py-3 text-sm font-medium overflow-x-auto">
              <li className="relative pb-0.5">
                <Link
                  href="/catalog"
                  className={`flex items-center gap-1 transition-colors duration-200 whitespace-nowrap ${isOnCatalog && !activeCategoryId ? "text-primary font-bold" : "hover:text-primary"}`}
                >
                  <Menu className="h-4 w-4" />
                  כל הקטגוריות
                </Link>
                {isOnCatalog && !activeCategoryId && (
                  <motion.span
                    layoutId="desktop-cat-indicator"
                    className="absolute bottom-0 right-0 left-0 h-0.5 bg-primary rounded-full"
                    transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  />
                )}
              </li>
              {categories
                ?.filter((c) => c.parentId !== null && c.parentId !== undefined)
                .slice(0, 8)
                .map((category) => (
                  <li key={category.id} className="relative pb-0.5">
                    <Link
                      href={`/catalog?categoryId=${category.id}`}
                      className={`transition-colors duration-200 whitespace-nowrap ${activeCategoryId === category.id ? "text-primary font-bold" : "hover:text-primary"}`}
                    >
                      {category.nameHe}
                    </Link>
                    {activeCategoryId === category.id && (
                      <motion.span
                        layoutId="desktop-cat-indicator"
                        className="absolute bottom-0 right-0 left-0 h-0.5 bg-primary rounded-full"
                        transition={{
                          type: "spring",
                          stiffness: 500,
                          damping: 35,
                        }}
                      />
                    )}
                  </li>
                ))}
            </ul>
          </div>
        </div>
      </header>

      {/* Ad Banner Strip */}
      {ads && ads.length > 0 && (
        <div className="border-b border-border bg-background">
          <div className="container mx-auto px-4 py-3">
            {/* Desktop: 4-column grid */}
            <div className="hidden lg:grid grid-cols-4 gap-3">
              {[...ads]
                .sort((a, b) => a.position - b.position)
                .map(ad => {
                  const inner = (
                    <div className="relative w-full overflow-hidden rounded-lg" style={{ aspectRatio: "2/1" }}>
                      <img
                        src={ad.imageUrl}
                        alt={ad.title ?? `מודעה ${ad.position}`}
                        className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                      />
                    </div>
                  );
                  return ad.linkUrl ? (
                    <a key={ad.id} href={ad.linkUrl} target="_blank" rel="noopener noreferrer" className="block">
                      {inner}
                    </a>
                  ) : (
                    <div key={ad.id}>{inner}</div>
                  );
                })}
            </div>

            {/* Mobile / Tablet: auto-playing carousel */}
            <div className="lg:hidden">
              <AdsCarousel ads={ads} />
            </div>
          </div>
        </div>
      )}

      {/* Mobile Drawer */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="right" className="w-72 p-0 flex flex-col" dir="rtl">
          <SheetHeader className="px-4 py-4 border-b">
            <SheetTitle>
              <img src="/logo.gif" alt="ביג-שווק" className="h-9 w-auto" />
            </SheetTitle>
          </SheetHeader>

          {/* Mobile search */}
          <form
            onSubmit={handleSearch}
            className="px-4 py-3 border-b flex gap-2"
          >
            <Input
              placeholder="חפש מוצרים..."
              className="flex-1"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
            />
            <Button type="submit" size="icon" variant="ghost">
              <Search className="h-4 w-4" />
            </Button>
          </form>

          {/* Mobile nav links */}
          <nav className="flex-1 overflow-y-auto">
            <div className="px-4 py-2">
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide mb-2">
                קטגוריות
              </p>
              <ul className="space-y-1">
                <li className="relative">
                  {isOnCatalog && !activeCategoryId && (
                    <motion.span
                      layoutId="mobile-cat-indicator"
                      className="absolute inset-0 bg-primary/10 rounded-md"
                      transition={{
                        type: "spring",
                        stiffness: 500,
                        damping: 35,
                      }}
                    />
                  )}
                  <Link
                    href="/catalog"
                    onClick={handleCategoryClick}
                    className={`relative flex items-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-colors duration-200 ${isOnCatalog && !activeCategoryId ? "text-primary font-bold" : "hover:bg-muted"}`}
                  >
                    <Menu className="h-4 w-4" />
                    כל הקטגוריות
                  </Link>
                </li>
                {categories
                  ?.filter(
                    (c) => c.parentId !== null && c.parentId !== undefined,
                  )
                  .map((category) => (
                    <li key={category.id} className="relative">
                      {activeCategoryId === category.id && (
                        <motion.span
                          layoutId="mobile-cat-indicator"
                          className="absolute inset-0 bg-primary/10 rounded-md"
                          transition={{
                            type: "spring",
                            stiffness: 500,
                            damping: 35,
                          }}
                        />
                      )}
                      <Link
                        href={`/catalog?categoryId=${category.id}`}
                        onClick={handleCategoryClick}
                        className={`relative flex items-center py-2 px-3 rounded-md text-sm transition-colors duration-200 ${activeCategoryId === category.id ? "text-primary font-bold" : "hover:bg-muted"}`}
                      >
                        {category.nameHe}
                      </Link>
                    </li>
                  ))}
              </ul>
            </div>

            <div className="px-4 py-2 border-t mt-2">
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide mb-2">
                חשבון
              </p>
              <ul className="space-y-1">
                {user ? (
                  <>
                    <li>
                      <Link
                        href="/profile"
                        onClick={handleCategoryClick}
                        className="flex items-center py-2 px-3 rounded-md hover:bg-muted text-sm font-medium"
                      >
                        שלום, {user.firstName} — הפרופיל שלי
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="/orders"
                        onClick={handleCategoryClick}
                        className="flex items-center py-2 px-3 rounded-md hover:bg-muted text-sm"
                      >
                        ההזמנות שלי
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="/loyalty"
                        onClick={handleCategoryClick}
                        className="flex items-center py-2 px-3 rounded-md hover:bg-muted text-sm"
                      >
                        מועדון לקוחות
                      </Link>
                    </li>
                    <li>
                      <button
                        onClick={async () => {
                          await logout();
                          setMobileOpen(false);
                          navigate("/");
                        }}
                        className="flex items-center gap-2 py-2 px-3 rounded-md hover:bg-muted text-sm w-full text-right text-destructive"
                      >
                        <LogOut className="h-4 w-4" />
                        התנתק
                      </button>
                    </li>
                  </>
                ) : (
                  <li>
                    <Link
                      href="/auth"
                      onClick={handleCategoryClick}
                      className="flex items-center gap-2 py-2 px-3 rounded-md hover:bg-muted text-sm"
                    >
                      <User className="h-4 w-4" />
                      התחבר / הרשם
                    </Link>
                  </li>
                )}
              </ul>
            </div>
          </nav>
        </SheetContent>
      </Sheet>

      <main className="flex-1">{children}</main>

      <footer className="bg-muted py-12 border-t border-border mt-auto">
        <div className="container mx-auto px-4 grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <img src="/logo.gif" alt="ביג-שווק" className="h-10 w-auto mb-4" />
            <p className="text-sm text-muted-foreground mb-4">
              כל המוצרים במחירי מבצע וללא תחרות
            </p>
          </div>
          <div>
            <h3 className="font-bold text-lg mb-4">קניות</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/catalog" className="hover:text-primary">
                  כל המוצרים
                </Link>
              </li>
              <li>
                <Link
                  href="/catalog?sort=newest"
                  className="hover:text-primary"
                >
                  חדש באתר
                </Link>
              </li>
              <li>
                <Link
                  href="/catalog?sort=popular"
                  className="hover:text-primary"
                >
                  הנמכרים ביותר
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="font-bold text-lg mb-4">שירות לקוחות</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/orders" className="hover:text-primary">
                  ההזמנות שלי
                </Link>
              </li>
              <li>
                <Link href="/loyalty" className="hover:text-primary">
                  מועדון לקוחות
                </Link>
              </li>
              <li>
                <Link href="/auth" className="hover:text-primary">
                  התחברות
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="font-bold text-lg mb-4">צור קשר</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>טלפון: 077-1234567</li>
              <li>דוא"ל: support@techstore.co.il</li>
              <li>כתובת: רחוב הטכנולוגיה 1, תל אביב</li>
            </ul>
          </div>
        </div>
        <div className="container mx-auto px-4 mt-8 pt-8 border-t border-border text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} טק-סטור. כל הזכויות שמורות.
        </div>
      </footer>
    </div>
  );
}
