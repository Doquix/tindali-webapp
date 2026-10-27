import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { Product, SaleItem } from "./db";

interface CartLine {
  product: Product;
  qty: number;
}

interface Cart {
  lines: CartLine[];
  count: number;
  totalCentavos: number;
  add: (product: Product, qty: number) => void;
  setQty: (productId: number, qty: number) => void;
  clear: () => void;
  toSaleItems: () => SaleItem[];
}

const CartContext = createContext<Cart | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);

  const cart = useMemo<Cart>(() => {
    const add = (product: Product, qty: number) =>
      setLines((prev) => {
        const existing = prev.find((l) => l.product.id === product.id);
        if (existing) return prev.map((l) => (l === existing ? { ...l, qty: l.qty + qty } : l));
        return [...prev, { product, qty }];
      });
    const setQty = (productId: number, qty: number) =>
      setLines((prev) => (qty <= 0 ? prev.filter((l) => l.product.id !== productId) : prev.map((l) => (l.product.id === productId ? { ...l, qty } : l))));
    return {
      lines,
      count: lines.reduce((s, l) => s + l.qty, 0),
      totalCentavos: lines.reduce((s, l) => s + l.product.priceCentavos * l.qty, 0),
      add,
      setQty,
      clear: () => setLines([]),
      toSaleItems: () =>
        lines.map((l) => ({ productId: l.product.id!, name: l.product.name, qty: l.qty, priceCentavos: l.product.priceCentavos, costCentavos: l.product.costCentavos })),
    };
  }, [lines]);

  return <CartContext.Provider value={cart}>{children}</CartContext.Provider>;
}

export function useCart(): Cart {
  const cart = useContext(CartContext);
  if (!cart) throw new Error("useCart must be used inside CartProvider");
  return cart;
}
