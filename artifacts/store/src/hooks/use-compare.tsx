import { createContext, useContext, ReactNode, useState, useEffect } from "react";
import { Product } from "@workspace/api-zod/src/generated/types";
import { toast } from "@/components/ui/use-toast";

interface CompareContextType {
  products: Product[];
  addToCompare: (product: Product) => void;
  removeFromCompare: (productId: number) => void;
  clearCompare: () => void;
}

const CompareContext = createContext<CompareContextType | undefined>(undefined);

export function CompareProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem("compare_products");
    if (saved) {
      try {
        setProducts(JSON.parse(saved));
      } catch (e) {}
    }
  }, []);

  const saveToLocal = (items: Product[]) => {
    localStorage.setItem("compare_products", JSON.stringify(items));
    setProducts(items);
  };

  const addToCompare = (product: Product) => {
    if (products.find((p) => p.id === product.id)) {
      toast({ title: "המוצר כבר קיים בהשוואה" });
      return;
    }
    if (products.length >= 4) {
      toast({ title: "ניתן להשוות עד 4 מוצרים", variant: "destructive" });
      return;
    }
    saveToLocal([...products, product]);
    toast({ title: "המוצר נוסף להשוואה" });
  };

  const removeFromCompare = (productId: number) => {
    saveToLocal(products.filter((p) => p.id !== productId));
  };

  const clearCompare = () => {
    saveToLocal([]);
  };

  return (
    <CompareContext.Provider value={{
      products,
      addToCompare,
      removeFromCompare,
      clearCompare
    }}>
      {children}
    </CompareContext.Provider>
  );
}

export function useCompare() {
  const context = useContext(CompareContext);
  if (context === undefined) {
    throw new Error("useCompare must be used within a CompareProvider");
  }
  return context;
}
