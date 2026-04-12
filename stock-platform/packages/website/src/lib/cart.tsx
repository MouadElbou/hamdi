'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

interface CartItem {
  lotId: string;
  designation: string;
  category: string;
  quantity: number;
  price: number | null; // centimes, null if not published
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'quantity'>) => void;
  removeItem: (lotId: string) => void;
  updateQuantity: (lotId: string, qty: number) => void;
  clearCart: () => void;
  totalItems: number;
}

const CART_STORAGE_KEY = 'stock-platform-cart';

function isValidCartItem(item: unknown): item is CartItem {
  if (typeof item !== 'object' || item === null) return false;
  const obj = item as Record<string, unknown>;
  return (
    typeof obj['lotId'] === 'string' &&
    typeof obj['designation'] === 'string' &&
    typeof obj['category'] === 'string' &&
    typeof obj['quantity'] === 'number' && Number.isFinite(obj['quantity'] as number) && (obj['quantity'] as number) > 0 &&
    (obj['price'] === null || typeof obj['price'] === 'number')
  );
}

function loadCart(): CartItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Filter out any corrupted items (e.g. from prior event-leak bugs)
    return parsed.filter(isValidCartItem);
  } catch {
    return [];
  }
}

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [items, setItems] = useState<CartItem[]>(loadCart);

  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    } catch { /* quota exceeded — ignore */ }
  }, [items]);

  const addItem = useCallback((item: Omit<CartItem, 'quantity'>) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.lotId === item.lotId);
      if (existing) {
        return prev.map((i) => i.lotId === item.lotId ? { ...i, quantity: Math.min(999, i.quantity + 1) } : i);
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  }, []);

  const removeItem = useCallback((lotId: string) => {
    setItems((prev) => prev.filter((i) => i.lotId !== lotId));
  }, []);

  const updateQuantity = useCallback((lotId: string, qty: number) => {
    if (!Number.isFinite(qty) || qty <= 0) {
      setItems((prev) => prev.filter((i) => i.lotId !== lotId));
    } else {
      const clamped = Math.min(999, Math.round(qty));
      setItems((prev) => prev.map((i) => i.lotId === lotId ? { ...i, quantity: clamped } : i));
    }
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const totalItems = items.reduce((s, i) => s + i.quantity, 0);

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateQuantity, clearCart, totalItems }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextType {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
