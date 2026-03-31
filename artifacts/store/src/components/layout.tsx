import { ReactNode } from "react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useCart } from "@/hooks/use-cart";
import { ShoppingCart, User, Heart, Search, Menu, Package, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useListCategories } from "@workspace/api-client-react";

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const { cart } = useCart();
  
  const { data: categories } = useListCategories();

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background font-sans text-foreground">
      {/* Top bar */}
      <div className="bg-primary text-primary-foreground py-2 px-4 text-sm flex justify-between items-center">
        <div>שירות לקוחות: 077-1234567</div>
        <div className="hidden md:block">משלוח חינם בקנייה מעל ₪299</div>
      </div>
      
      {/* Main Header */}
      <header className="sticky top-0 z-50 bg-background border-b border-border shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-4 md:gap-8">
          <Link href="/" className="flex items-center gap-2 text-2xl font-black text-primary shrink-0" data-testid="link-logo">
            <Package className="h-8 w-8" />
            <span>טק-סטור</span>
          </Link>
          
          <div className="flex-1 max-w-2xl hidden md:flex relative">
            <Input 
              placeholder="חפש מוצרים, מותגים וקטגוריות..." 
              className="w-full pr-10 rounded-full bg-muted border-none"
              data-testid="input-search"
            />
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          </div>
          
          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden md:flex items-center gap-1 text-sm mr-4">
              {user ? (
                <div className="flex items-center gap-2">
                  <div className="flex flex-col text-left">
                    <span className="font-medium">שלום, {user.firstName}</span>
                    {user.loyaltyTier && (
                      <span className="text-xs text-amber-500 font-bold flex items-center justify-end gap-1">
                        <Star className="h-3 w-3" /> {user.loyaltyTier}
                      </span>
                    )}
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => logout()} data-testid="btn-logout">
                    <User className="h-5 w-5" />
                  </Button>
                </div>
              ) : (
                <Link href="/auth" className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
                  <User className="h-5 w-5" />
                  <span>התחבר / הרשם</span>
                </Link>
              )}
            </div>
            
            <Link href="/wishlist">
              <Button variant="ghost" size="icon" className="relative" data-testid="link-wishlist">
                <Heart className="h-5 w-5" />
              </Button>
            </Link>
            
            <Link href="/cart">
              <Button variant="ghost" size="icon" className="relative" data-testid="link-cart">
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
        
        {/* Categories Menu */}
        <div className="border-t border-border hidden md:block">
          <div className="container mx-auto px-4">
            <ul className="flex items-center gap-6 py-3 text-sm font-medium overflow-x-auto">
              <li>
                <Link href="/catalog" className="flex items-center gap-1 text-primary hover:underline">
                  <Menu className="h-4 w-4" />
                  כל הקטגוריות
                </Link>
              </li>
              {categories?.slice(0, 8).map(category => (
                <li key={category.id}>
                  <Link href={`/catalog?categoryId=${category.id}`} className="hover:text-primary transition-colors">
                    {category.nameHe}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {children}
      </main>

      <footer className="bg-muted py-12 border-t border-border mt-auto">
        <div className="container mx-auto px-4 grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <h3 className="font-bold text-lg mb-4">טק-סטור</h3>
            <p className="text-sm text-muted-foreground mb-4">
              החנות המובילה בישראל למוצרי חשמל, מחשבים וטכנולוגיה. איכות ללא פשרות ושירות מעל הכל.
            </p>
          </div>
          <div>
            <h3 className="font-bold text-lg mb-4">קניות</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/catalog" className="hover:text-primary">כל המוצרים</Link></li>
              <li><Link href="/catalog?sort=newest" className="hover:text-primary">חדש באתר</Link></li>
              <li><Link href="/catalog?sort=popular" className="hover:text-primary">הנמכרים ביותר</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="font-bold text-lg mb-4">שירות לקוחות</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/orders" className="hover:text-primary">ההזמנות שלי</Link></li>
              <li><Link href="/loyalty" className="hover:text-primary">מועדון לקוחות</Link></li>
              <li><Link href="/auth" className="hover:text-primary">התחברות</Link></li>
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
