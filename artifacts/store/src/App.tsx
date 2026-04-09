import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/use-auth";
import { CartProvider } from "@/hooks/use-cart";
import { CompareProvider } from "@/hooks/use-compare";
import NotFound from "@/pages/not-found";

import Catalog from "@/pages/catalog";
import ProductDetail from "@/pages/product-detail";
import Cart from "@/pages/cart";
import Checkout from "@/pages/checkout";
import Auth from "@/pages/auth";
import Orders from "@/pages/orders";
import OrderDetail from "@/pages/order-detail";
import Wishlist from "@/pages/wishlist";
import Compare from "@/pages/compare";
import Profile from "@/pages/profile";
import InfoPage from "@/pages/info-page";
import ResetPassword from "@/pages/reset-password";

// Admin
import AdminDashboard from "@/pages/admin/dashboard";
import AdminProducts from "@/pages/admin/products";
import AdminProductForm from "@/pages/admin/product-form";
import AdminOrders from "@/pages/admin/orders";
import AdminInventory from "@/pages/admin/inventory";
import AdminCoupons from "@/pages/admin/coupons";
import AdminLoyalty from "@/pages/admin/loyalty";
import AdminAnalytics from "@/pages/admin/analytics";
import AdminUsers from "@/pages/admin/users";
import AdminUserDetail from "@/pages/admin/user-detail";
import AdminImport from "@/pages/admin/import";
import AdminSuppliers from "@/pages/admin/suppliers";
import AdminSupplierForm from "@/pages/admin/supplier-form";
import AdminSupplierDetail from "@/pages/admin/supplier-detail";
import AdminCategories from "@/pages/admin/categories";
import AdminBrands from "@/pages/admin/brands";
import AdminOrderDetail from "@/pages/admin/order-detail";
import AdminAds from "@/pages/admin/ads";
import AdminMedia from "@/pages/admin/media";
import AdminSiteInfo from "@/pages/admin/site-info";
import AdminManagers from "@/pages/admin/managers";
import SetupManagerPassword from "@/pages/admin/setup-password";

const queryClient = new QueryClient();

function ScrollToTop() {
  const [location] = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [location]);
  return null;
}

function Router() {
  return (
    <>
      <ScrollToTop />
      <Switch>
      <Route path="/" component={Catalog} />
      <Route path="/catalog" component={Catalog} />
      <Route path="/product/:id" component={ProductDetail} />
      <Route path="/product/slug/:slug" component={ProductDetail} />
      <Route path="/cart" component={Cart} />
      <Route path="/checkout" component={Checkout} />
      <Route path="/auth" component={Auth} />
      <Route path="/orders" component={Orders} />
      <Route path="/orders/:id" component={OrderDetail} />
      <Route path="/wishlist" component={Wishlist} />
      <Route path="/compare" component={Compare} />
      <Route path="/profile" component={Profile} />
      <Route path="/info/:slug" component={InfoPage} />
      <Route path="/reset-password" component={ResetPassword} />

      <Route path="/admin" component={AdminDashboard} />
      <Route path="/admin/products" component={AdminProducts} />
      <Route path="/admin/products/new" component={AdminProductForm} />
      <Route path="/admin/products/:id/edit" component={AdminProductForm} />
      <Route path="/admin/orders" component={AdminOrders} />
      <Route path="/admin/orders/:id" component={AdminOrderDetail} />
      <Route path="/admin/inventory" component={AdminInventory} />
      <Route path="/admin/coupons" component={AdminCoupons} />
      <Route path="/admin/loyalty" component={AdminLoyalty} />
      <Route path="/admin/analytics" component={AdminAnalytics} />
      <Route path="/admin/customers" component={AdminUsers} />
      <Route path="/admin/customers/:id" component={AdminUserDetail} />
      <Route path="/admin/users" component={AdminUsers} />
      <Route path="/admin/import" component={AdminImport} />
      <Route path="/admin/suppliers" component={AdminSuppliers} />
      <Route path="/admin/suppliers/new" component={AdminSupplierForm} />
      <Route path="/admin/suppliers/:id" component={AdminSupplierDetail} />
      <Route path="/admin/suppliers/:id/edit" component={AdminSupplierForm} />
      <Route path="/admin/categories" component={AdminCategories} />
      <Route path="/admin/brands" component={AdminBrands} />
      <Route path="/admin/ads" component={AdminAds} />
      <Route path="/admin/media" component={AdminMedia} />
      <Route path="/admin/site-info" component={AdminSiteInfo} />
      <Route path="/admin/managers" component={AdminManagers} />
      <Route path="/setup-manager-password" component={SetupManagerPassword} />

      <Route component={NotFound} />
    </Switch>
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <CartProvider>
          <CompareProvider>
            <TooltipProvider>
              <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
                <Router />
              </WouterRouter>
              <Toaster />
            </TooltipProvider>
          </CompareProvider>
        </CartProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
