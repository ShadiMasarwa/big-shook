import { createContext, useContext, ReactNode } from "react";
import { useGetCart, getGetCartQueryKey, useAddToCart, useUpdateCartItem, useRemoveFromCart, useClearCart } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

interface CartContextType {
  cart: any;
  isLoading: boolean;
  addToCart: ReturnType<typeof useAddToCart>["mutateAsync"];
  updateItem: ReturnType<typeof useUpdateCartItem>["mutateAsync"];
  removeItem: ReturnType<typeof useRemoveFromCart>["mutateAsync"];
  clearCart: ReturnType<typeof useClearCart>["mutateAsync"];
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { data: cart, isLoading } = useGetCart({
    query: {
      queryKey: getGetCartQueryKey()
    }
  });

  const addToCartMutation = useAddToCart();
  const updateItemMutation = useUpdateCartItem();
  const removeItemMutation = useRemoveFromCart();
  const clearCartMutation = useClearCart();

  const handleSuccess = () => {
    queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() });
  };

  const addToCart = async (data: any, options?: any) => {
    return addToCartMutation.mutateAsync(data, { ...options, onSuccess: handleSuccess });
  };

  const updateItem = async (data: any, options?: any) => {
    return updateItemMutation.mutateAsync(data, { ...options, onSuccess: handleSuccess });
  };

  const removeItem = async (data: any, options?: any) => {
    return removeItemMutation.mutateAsync(data, { ...options, onSuccess: handleSuccess });
  };

  const clearCart = async (data?: any, options?: any) => {
    return clearCartMutation.mutateAsync(data, { ...options, onSuccess: handleSuccess });
  };

  return (
    <CartContext.Provider value={{
      cart: cart || null,
      isLoading,
      addToCart,
      updateItem,
      removeItem,
      clearCart
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
