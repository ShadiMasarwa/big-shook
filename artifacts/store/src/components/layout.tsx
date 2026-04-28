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
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useListCategories, useGetWishlist } from "@workspace/api-client-react";
import { SearchSuggest } from "@/components/search-suggest";

type AdItem = {
  id: number;
  position: number;
  imageUrl: string;
  linkUrl?: string | null;
  title?: string | null;
};

function AdsCarousel({ ads }: { ads: AdItem[] }) {
  const [current, setCurrent] = useState(0);
  const paused = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (ads.length <= 1) return;
    const tick = () => {
      if (!paused.current) setCurrent((i) => (i + 1) % ads.length);
    };
    intervalRef.current = setInterval(tick, 4000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [ads.length]);

  const sorted = [...ads].sort((a, b) => a.position - b.position);

  return (
    <div
      className="relative overflow-hidden rounded-lg"
      style={{ aspectRatio: "2/1" }}
      onMouseEnter={() => {
        paused.current = true;
      }}
      onMouseLeave={() => {
        paused.current = false;
      }}
    >
      {/* Slides strip — LTR so translateX maths is straightforward */}
      <div
        dir="ltr"
        className="flex h-full transition-transform duration-700 ease-in-out"
        style={{ transform: `translateX(-${current * 100}%)` }}
      >
        {sorted.map((ad) => {
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
                <a
                  href={ad.linkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full h-full"
                >
                  {img}
                </a>
              ) : (
                img
              )}
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

  // Parse categories into parent / children structure
  const parents = (categories ?? []).filter(
    (c) => c.parentId === null || c.parentId === undefined,
  );
  const childrenByParent: Record<number, typeof parents> = {};
  (categories ?? []).forEach((c) => {
    if (c.parentId !== null && c.parentId !== undefined) {
      if (!childrenByParent[c.parentId]) childrenByParent[c.parentId] = [];
      childrenByParent[c.parentId].push(c);
    }
  });

  const activeParentId = searchParams.get("parentId")
    ? Number(searchParams.get("parentId"))
    : null;

  // Desktop hover submenu state
  const [openParentId, setOpenParentId] = useState<number | null>(null);

  // Mobile expandable parent state
  const [mobileExpandedId, setMobileExpandedId] = useState<number | null>(null);

  // Mobile drawer filter state (synced from URL)
  const [mobilePriceMin, setMobilePriceMin] = useState(
    searchParams.get("minPrice") ?? "",
  );
  const [mobilePriceMax, setMobilePriceMax] = useState(
    searchParams.get("maxPrice") ?? "",
  );
  const mobileInStock = searchParams.get("inStock") === "true";
  const mobileBrandId = searchParams.get("brandId")
    ? Number(searchParams.get("brandId"))
    : null;

  // Sync price inputs when URL changes
  useEffect(() => {
    setMobilePriceMin(searchParams.get("minPrice") ?? "");
    setMobilePriceMax(searchParams.get("maxPrice") ?? "");
  }, [search]);

  // Helper to update catalog filter params without closing the drawer
  const updateCatalogFilter = (updates: Record<string, string | null>) => {
    const p = new URLSearchParams(search);
    p.delete("page");
    for (const [k, v] of Object.entries(updates)) {
      if (v === null || v === "") p.delete(k);
      else p.set(k, v);
    }
    navigate(`/catalog?${p.toString()}`);
  };

  // Brands for mobile drawer — filtered by current category context.
  // Always include withActiveProducts=true so the drawer only shows brands the user can buy from.
  const mobileBrandsQp = new URLSearchParams();
  mobileBrandsQp.set("withActiveProducts", "true");
  if (searchParams.get("categoryId"))
    mobileBrandsQp.set("categoryId", searchParams.get("categoryId")!);
  if (searchParams.get("parentId"))
    mobileBrandsQp.set("parentCategoryId", searchParams.get("parentId")!);
  const mobileBrandsQs = mobileBrandsQp.toString();
  const { data: mobileBrands } = useQuery<{ id: number; nameHe: string }[]>({
    queryKey: ["/api/brands", "mobile", mobileBrandsQs],
    queryFn: () =>
      fetch(`/api/brands${mobileBrandsQs ? `?${mobileBrandsQs}` : ""}`).then(
        (r) => r.json(),
      ),
    enabled: isOnCatalog,
    staleTime: 2 * 60 * 1000,
  });

  const { data: ads } = useQuery<AdItem[]>({
    queryKey: ["ads"],
    queryFn: async () => {
      const res = await fetch("/api/ads");
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: siteSettings } = useQuery<Record<string, string>>({
    queryKey: ["site-settings"],
    queryFn: async () => {
      const res = await fetch("/api/site-settings");
      if (!res.ok) return {};
      return res.json();
    },
    staleTime: 0,
    gcTime: 0,
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
      {/* ── Skip to main content link — visible only on focus ── */}
      <a href="#main-content" className="skip-link">
        דלג לתוכן הראשי
      </a>

      {/* Top bar */}
      <div
        role="banner"
        aria-label="מידע כללי"
        className="bg-primary text-primary-foreground py-2 px-4 text-sm flex justify-between items-center"
      >
        <div>{siteSettings?.topbar_left ?? "שירות לקוחות: 077-1234577"}</div>
        <div className="hidden md:block">
          {siteSettings?.topbar_right ?? "משלוח חינם בקנייה מעל ₪299"}
        </div>
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
            aria-label="פתח תפריט ניווט"
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav-sheet"
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
              <span className="text-xs text-muted-foreground font-medium">
                חנות מבצעים
              </span>
            </div>
          </Link>

          {/* Desktop search */}
          <div className="flex-1 max-w-2xl hidden md:flex relative">
            <SearchSuggest
              inputId="desktop-search"
              placeholder="חפש מוצרים, מותגים, תגיות..."
              inputClassName="w-full pr-10 rounded-full bg-muted border-none h-10 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              value={searchValue}
              onChange={setSearchValue}
              onSubmit={() => {
                const q = searchValue.trim();
                if (q) navigate(`/catalog?q=${encodeURIComponent(q)}`);
              }}
              testId="input-search"
              variant="desktop"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden md:flex items-center gap-1 text-sm mr-4">
              {user ? (
                <div className="flex items-top gap-2">
                  <span className="font-medium">שלום, {user.firstName}</span>
                  <Link
                    href="/profile"
                    className="flex flex-col text-left hover:text-primary transition-colors"
                  >
                    <span className="font-medium">(איזור אישי)</span>
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
                    aria-label="התנתק מהחשבון"
                  >
                    <LogOut className="h-5 w-5" aria-hidden="true" />
                  </Button>
                </div>
              ) : (
                <Link
                  href="/auth"
                  className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
                >
                  <User className="h-5 w-5" />
                  <span>התחבר / הרשם</span>
                </Link>
              )}
            </div>

            <Link
              href="/wishlist"
              aria-label={
                wishlist && wishlist.length > 0
                  ? `רשימת מועדפים, ${wishlist.length} פריטים`
                  : "רשימת מועדפים"
              }
            >
              <Button
                variant="ghost"
                size="icon"
                className="relative"
                data-testid="link-wishlist"
                tabIndex={-1}
                aria-hidden="true"
              >
                <Heart className="h-5 w-5" aria-hidden="true" />
                {wishlist && wishlist.length > 0 && (
                  <span
                    aria-hidden="true"
                    className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center"
                  >
                    {wishlist.length}
                  </span>
                )}
              </Button>
            </Link>

            <Link
              href="/cart"
              aria-label={
                cart && cart.itemCount > 0
                  ? `עגלת קניות, ${cart.itemCount} פריטים`
                  : "עגלת קניות"
              }
            >
              <Button
                variant="ghost"
                size="icon"
                className="relative"
                data-testid="link-cart"
                tabIndex={-1}
                aria-hidden="true"
              >
                <ShoppingCart className="h-5 w-5" aria-hidden="true" />
                {cart && cart.itemCount > 0 && (
                  <span
                    aria-hidden="true"
                    className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center"
                  >
                    {cart.itemCount}
                  </span>
                )}
              </Button>
            </Link>
          </div>
        </div>

        {/* Desktop Categories Mega Menu */}
        <nav
          aria-label="ניווט קטגוריות"
          className="border-t border-border hidden md:block"
        >
          <div className="relative" onMouseLeave={() => setOpenParentId(null)}>
            <div className="container mx-auto px-4">
              <ul className="flex items-center gap-1 py-2 ps-1 overflow-x-auto scrollbar-hide">
                <li>
                  <button
                    onMouseEnter={() => setOpenParentId(null)}
                    onClick={() => navigate("/catalog")}
                    className={`flex flex-col items-center gap-0 px-1 py-1 rounded-xl transition-all cursor-pointer ${
                      isOnCatalog && !activeCategoryId && !activeParentId
                        ? "ring-2 ring-primary"
                        : "hover:opacity-90"
                    }`}
                  >
                    <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-muted border border-border shrink-0">
                      <img
                        src="/api/uploads/1775906900586-mpauoy903c.png"
                        alt=""
                        aria-hidden="true"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-x-0 bottom-0 bg-black/55 px-1 py-0.5">
                        <span className="block text-[10px] font-semibold text-white whitespace-nowrap truncate text-center leading-tight">
                          כל הקטגוריות
                        </span>
                      </div>
                    </div>
                  </button>
                </li>
                {parents.map((parent) => {
                  const children = childrenByParent[parent.id] ?? [];
                  const isActive =
                    activeParentId === parent.id ||
                    children.some((c) => c.id === activeCategoryId);
                  return (
                    <li key={parent.id}>
                      <button
                        onMouseEnter={() => setOpenParentId(parent.id)}
                        onClick={() => {
                          navigate(`/catalog?parentId=${parent.id}`);
                          setOpenParentId(null);
                        }}
                        className={`flex flex-col items-center gap-0 px-1 py-1 rounded-xl transition-all cursor-pointer ${
                          isActive ? "ring-2 ring-primary" : "hover:opacity-90"
                        }`}
                        aria-haspopup={children.length > 0}
                        aria-expanded={openParentId === parent.id}
                      >
                        <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-muted border border-border shrink-0">
                          {parent.imageUrl ? (
                            <img
                              src={parent.imageUrl}
                              alt=""
                              aria-hidden="true"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-muted-foreground text-lg">
                              🛍️
                            </div>
                          )}
                          <div className="absolute inset-x-0 bottom-0 bg-black/55 px-1 py-0.5">
                            <span className="block text-[10px] font-semibold text-white whitespace-nowrap truncate text-center leading-tight">
                              {parent.nameHe}
                            </span>
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Flyout submenu */}
            {openParentId !== null &&
              (childrenByParent[openParentId] ?? []).length > 0 && (
                <div className="absolute top-full right-0 left-0 z-50 bg-background border-b border-border shadow-2xl">
                  <div className="container mx-auto px-4 py-4">
                    <ul className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide flex-wrap">
                      {(childrenByParent[openParentId] ?? []).map((child) => (
                        <li key={child.id}>
                          <Link
                            href={`/catalog?categoryId=${child.id}`}
                            onClick={() => setOpenParentId(null)}
                            className={`flex flex-col items-center gap-0 rounded-xl transition-all group ${
                              activeCategoryId === child.id
                                ? "ring-2 ring-primary"
                                : "hover:opacity-90"
                            }`}
                          >
                            <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-muted border border-border">
                              {child.imageUrl ? (
                                <img
                                  src={child.imageUrl}
                                  alt=""
                                  aria-hidden="true"
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-muted-foreground text-2xl">
                                  📦
                                </div>
                              )}
                              <div className="absolute inset-x-0 bottom-0 bg-black/55 px-1.5 py-1">
                                <span className="block text-[11px] font-semibold text-white text-center whitespace-nowrap truncate leading-tight">
                                  {child.nameHe}
                                </span>
                              </div>
                            </div>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
          </div>
        </nav>
      </header>

      {/* Ad Banner Strip */}
      {ads && ads.length > 0 && (
        <div className="border-b border-border bg-background">
          <div className="container mx-auto px-4 py-3">
            {/* Desktop: 4-column grid */}
            <div className="hidden lg:grid grid-cols-4 gap-3">
              {[...ads]
                .sort((a, b) => a.position - b.position)
                .map((ad) => {
                  const inner = (
                    <div
                      className="relative w-full overflow-hidden rounded-lg"
                      style={{ aspectRatio: "2/1" }}
                    >
                      <img
                        src={ad.imageUrl}
                        alt={ad.title ?? `מודעה ${ad.position}`}
                        className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                      />
                    </div>
                  );
                  return ad.linkUrl ? (
                    <a
                      key={ad.id}
                      href={ad.linkUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block"
                    >
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
        <SheetContent
          id="mobile-nav-sheet"
          side="right"
          className="w-72 p-0 flex flex-col"
          dir="rtl"
          aria-label="תפריט ניווט"
        >
          <SheetHeader className="px-4 py-4 border-b">
            <SheetTitle>
              <img src="/logo.gif" alt="ביג-שווק" className="h-9 w-auto" />
            </SheetTitle>
          </SheetHeader>

          {/* Mobile search */}
          <div className="px-4 py-3 border-b">
            <SearchSuggest
              inputId="mobile-search"
              placeholder="חפש מוצרים, תגיות..."
              inputClassName="w-full h-10 px-3 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              value={searchValue}
              onChange={setSearchValue}
              onSubmit={() => {
                const q = searchValue.trim();
                if (q) {
                  navigate(`/catalog?q=${encodeURIComponent(q)}`);
                  setMobileOpen(false);
                }
              }}
              variant="mobile"
            />
          </div>

          {/* Mobile nav links */}
          <nav aria-label="ניווט ראשי" className="flex-1 overflow-y-auto">
            <div className="px-4 py-2">
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide mb-2">
                קטגוריות
              </p>
              <ul className="space-y-1">
                {parents.map((parent) => {
                  const children = childrenByParent[parent.id] ?? [];
                  const isExpanded = mobileExpandedId === parent.id;
                  const isActive =
                    activeParentId === parent.id ||
                    children.some((c) => c.id === activeCategoryId);
                  return (
                    <li key={parent.id}>
                      <div className="flex items-center gap-1">
                        <Link
                          href={`/catalog?parentId=${parent.id}`}
                          onClick={handleCategoryClick}
                          className={`flex items-center gap-2 py-2 px-3 rounded-md text-sm font-medium flex-1 transition-colors duration-200 ${isActive ? "text-primary bg-primary/10" : "hover:bg-muted"}`}
                        >
                          {parent.imageUrl && (
                            <img
                              src={parent.imageUrl}
                              alt=""
                              aria-hidden="true"
                              className="w-8 h-6 object-cover rounded shrink-0"
                            />
                          )}
                          {parent.nameHe}
                        </Link>
                        {children.length > 0 && (
                          <button
                            onClick={() =>
                              setMobileExpandedId(isExpanded ? null : parent.id)
                            }
                            className="p-2 hover:bg-muted rounded-md shrink-0"
                            aria-label={
                              isExpanded
                                ? "סגור קטגוריות משנה"
                                : "פתח קטגוריות משנה"
                            }
                            aria-expanded={isExpanded}
                          >
                            <ChevronDown
                              className={`h-4 w-4 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                            />
                          </button>
                        )}
                      </div>
                      {isExpanded && children.length > 0 && (
                        <ul className="me-4 mt-1 space-y-1 border-e border-border pe-2">
                          {children.map((child) => (
                            <li key={child.id}>
                              <Link
                                href={`/catalog?categoryId=${child.id}`}
                                onClick={handleCategoryClick}
                                className={`flex items-center gap-2 py-1.5 px-3 rounded-md text-sm transition-colors duration-200 ${activeCategoryId === child.id ? "text-primary font-bold bg-primary/10" : "hover:bg-muted"}`}
                              >
                                {child.imageUrl && (
                                  <img
                                    src={child.imageUrl}
                                    alt=""
                                    aria-hidden="true"
                                    className="w-7 h-5 object-cover rounded shrink-0"
                                  />
                                )}
                                {child.nameHe}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Catalog-specific filters — only shown on catalog page */}
            {isOnCatalog && (
              <>
                {/* Brands */}
                {mobileBrands && mobileBrands.length > 0 && (
                  <div className="px-4 py-2 border-t mt-1">
                    <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide mb-2">
                      מותגים
                    </p>
                    <ul className="space-y-1">
                      <li>
                        <button
                          className={`text-sm w-full text-right py-0.5 transition-colors ${mobileBrandId === null ? "font-bold text-primary" : "text-muted-foreground hover:text-foreground"}`}
                          onClick={() => updateCatalogFilter({ brandId: null })}
                        >
                          כל המותגים
                        </button>
                      </li>
                      {mobileBrands.map((brand) => (
                        <li key={brand.id}>
                          <button
                            className={`text-sm w-full text-right py-0.5 transition-colors ${mobileBrandId === brand.id ? "font-bold text-primary" : "text-muted-foreground hover:text-foreground"}`}
                            onClick={() =>
                              updateCatalogFilter({
                                brandId:
                                  brand.id === mobileBrandId
                                    ? null
                                    : String(brand.id),
                              })
                            }
                          >
                            {brand.nameHe}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Price range */}
                <div className="px-4 py-2 border-t">
                  <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide mb-2">
                    מחיר (₪)
                  </p>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      placeholder="מ-"
                      className="w-full h-8 text-sm"
                      value={mobilePriceMin}
                      onChange={(e) => setMobilePriceMin(e.target.value)}
                      onBlur={() =>
                        updateCatalogFilter({
                          minPrice: mobilePriceMin || null,
                          maxPrice: mobilePriceMax || null,
                        })
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter")
                          updateCatalogFilter({
                            minPrice: mobilePriceMin || null,
                            maxPrice: mobilePriceMax || null,
                          });
                      }}
                    />
                    <span className="text-muted-foreground text-sm shrink-0">
                      -
                    </span>
                    <Input
                      type="number"
                      placeholder="עד"
                      className="w-full h-8 text-sm"
                      value={mobilePriceMax}
                      onChange={(e) => setMobilePriceMax(e.target.value)}
                      onBlur={() =>
                        updateCatalogFilter({
                          minPrice: mobilePriceMin || null,
                          maxPrice: mobilePriceMax || null,
                        })
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter")
                          updateCatalogFilter({
                            minPrice: mobilePriceMin || null,
                            maxPrice: mobilePriceMax || null,
                          });
                      }}
                    />
                  </div>
                </div>

                {/* In-stock */}
                <div className="px-4 py-2 border-t flex items-center gap-2">
                  <Checkbox
                    id="mobile-inStock"
                    checked={mobileInStock}
                    onCheckedChange={(c) =>
                      updateCatalogFilter({
                        inStock: c === true ? "true" : null,
                      })
                    }
                  />
                  <Label
                    htmlFor="mobile-inStock"
                    className="cursor-pointer text-sm"
                  >
                    במלאי בלבד
                  </Label>
                </div>
              </>
            )}

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

      <main id="main-content" className="flex-1" tabIndex={-1}>
        {children}
      </main>

      <footer className="bg-muted py-12 border-t border-border mt-auto">
        <div className="container mx-auto px-4 grid grid-cols-1 md:grid-cols-5 gap-8">
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
                <Link href="/auth" className="hover:text-primary">
                  התחברות
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="font-bold text-lg mb-4">צור קשר</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link
                  href="/contact"
                  className="hover:text-primary font-semibold"
                >
                  טופס יצירת קשר ←
                </Link>
              </li>
              <li>טלפון: 051-5008661</li>
              <li>דוא"ל: support@bigshook.com</li>
              <li>כתובת: ת.ד. 3869, טייבה 4040000</li>
            </ul>
          </div>
          <div>
            <h3 className="font-bold text-lg mb-4">תנאי שימוש באתר ומידע</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/info/takanon" className="hover:text-primary">
                  תקנון
                </Link>
              </li>
              <li>
                <Link href="/info/delivery" className="hover:text-primary">
                  מדיניות הובלה
                </Link>
              </li>
              <li>
                <Link href="/info/privacy" className="hover:text-primary">
                  הגנת הפרטיות
                </Link>
              </li>
              <li>
                <Link href="/info/accessibility" className="hover:text-primary">
                  נגישות
                </Link>
              </li>
              <li>
                <Link href="/info/cancellation" className="hover:text-primary">
                  מדיניות ביטול עסקה
                </Link>
              </li>
              <li>
                <Link href="/info/loyalty" className="hover:text-primary">
                  מועדון נאמנות
                </Link>
              </li>
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
