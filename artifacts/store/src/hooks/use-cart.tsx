import { createContext, useContext, ReactNode } from "react";
import { useGetCart, getGetCartQueryKey, useAddToCart, useUpdateCartItem, useRemoveFromCart, useClearCart } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

interface CartContextType {
  cart: any;
  isLoading: boolean;
  addToCart: (args: { productId: number; quantity: number; variationId?: number | null; variationAttributes?: Record<string, string> | null }, options?: any) => Promise<any>;
  updateItem: (args: { productId: number; quantity: number }, options?: any) => Promise<any>;
  removeItem: (args: { productId: number }, options?: any) => Promise<any>;
  clearCart: (options?: any) => Promise<any>;
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

  const applyCart = (updatedCart: any) => {
    queryClient.setQueryData(getGetCartQueryKey(), updatedCart);
    queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() });
  };

  const addToCart = async (
    { productId, quantity, variationId, variationAttributes }: { productId: number; quantity: number; variationId?: number | null; variationAttributes?: Record<string, string> | null },
    options?: any,
  ) => {
    const data: any = { productId, quantity };
    if (variationId != null) data.variationId = variationId;
    if (variationAttributes) data.variationAttributes = variationAttributes;
    const result = await addToCartMutation.mutateAsync({ data }, options);
    applyCart(result);
    return result;
  };

  const updateItem = async ({ productId, quantity }: { productId: number; quantity: number }, options?: any) => {
    const result = await updateItemMutation.mutateAsync({ productId, data: { quantity } }, options);
    applyCart(result);
    return result;
  };

  const removeItem = async ({ productId }: { productId: number }, options?: any) => {
    const result = await removeItemMutation.mutateAsync({ productId }, options);
    applyCart(result);
    return result;
  };

  const clearCart = async (options?: any) => {
    const result = await clearCartMutation.mutateAsync(undefined, options);
    applyCart(result);
    return result;
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
