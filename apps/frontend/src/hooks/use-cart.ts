"use client";

import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import {
  getStorefrontCart,
  replaceStorefrontCart,
  type StorefrontCartItem,
} from '@/lib/api/guest-booking';

export interface CartItem {
  cartItemId: string; // Unique generated ID for the item in cart
  productId: string;
  variantId?: string;
  variantSizeId: string;
  quantity: number;
  productName: string;
  categoryName?: string;
  featuredImage?: string;
  basePrice: number;       // base price per period
  deposit: number;         // security deposit required
  startDate: string;       // YYYY-MM-DD
  endDate: string;         // YYYY-MM-DD
  durationDays: number;
  selectedSize?: string;   // The size selected by customer
  compositionSelections?: Array<{
    compositionRuleId: string;
    productId?: string;
    variantSizeId?: string;
    quantity?: number;
    label?: string;
  }>;
  bundleSummary?: Array<{
    ruleId: string;
    label: string;
    productName: string;
    sizeLabel?: string;
    quantity: number;
    priceAdjustment: number;
  }>;
  serviceMap: { 
    tryOn: boolean;
    backupSize?: string | null; 
    cleaning?: boolean; 
  };
  totalPrice: number;      // Calculated total
}

const CART_STORAGE_KEY = 'closetrent_guest_cart_v4';
let hydrationStarted = false;
let syncChain: Promise<unknown> = Promise.resolve();


// Fallback logic for SSR
const getCartSnapshot = () => {
  if (typeof window === 'undefined') return '[]';
  return localStorage.getItem(CART_STORAGE_KEY) || '[]';
};

const subscribe = (listener: () => void) => {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('storage', listener);
  window.addEventListener('cart-update', listener);
  return () => {
    window.removeEventListener('storage', listener);
    window.removeEventListener('cart-update', listener);
  };
};

function toServerItems(items: CartItem[]): StorefrontCartItem[] {
  return items.map((item) => ({
    lineKey: item.cartItemId,
    productId: item.productId,
    variantId: item.variantId || '',
    variantSizeId: item.variantSizeId,
    quantity: item.quantity,
    startDate: item.startDate,
    endDate: item.endDate,
    selectedSize: item.selectedSize,
    tryOn: item.serviceMap.tryOn,
    backupSize: item.serviceMap.backupSize || undefined,
    compositionSelections: item.compositionSelections?.map(({ label: _label, ...selection }) => selection),
    displaySnapshot: {
      productName: item.productName,
      categoryName: item.categoryName,
      featuredImage: item.featuredImage,
      basePrice: item.basePrice,
      deposit: item.deposit,
      durationDays: item.durationDays,
      bundleSummary: item.bundleSummary,
      cleaning: item.serviceMap.cleaning,
      totalPrice: item.totalPrice,
    },
  }));
}

function fromServerItems(items: StorefrontCartItem[]): CartItem[] {
  return items.map((item) => {
    const snapshot = item.displaySnapshot ?? {};
    const durationDays = Math.max(1, Math.round(
      (new Date(`${item.endDate}T00:00:00Z`).getTime() - new Date(`${item.startDate}T00:00:00Z`).getTime()) / 86_400_000,
    ) + 1);
    return {
      cartItemId: item.lineKey,
      productId: item.productId,
      variantId: item.variantId,
      variantSizeId: item.variantSizeId,
      quantity: item.quantity,
      productName: typeof snapshot.productName === 'string' ? snapshot.productName : 'Rental item',
      categoryName: typeof snapshot.categoryName === 'string' ? snapshot.categoryName : undefined,
      featuredImage: typeof snapshot.featuredImage === 'string' ? snapshot.featuredImage : undefined,
      basePrice: typeof snapshot.basePrice === 'number' ? snapshot.basePrice : 0,
      deposit: typeof snapshot.deposit === 'number' ? snapshot.deposit : 0,
      startDate: item.startDate,
      endDate: item.endDate,
      durationDays: typeof snapshot.durationDays === 'number' ? snapshot.durationDays : durationDays,
      selectedSize: item.selectedSize,
      compositionSelections: item.compositionSelections,
      bundleSummary: Array.isArray(snapshot.bundleSummary) ? snapshot.bundleSummary as CartItem['bundleSummary'] : undefined,
      serviceMap: {
        tryOn: item.tryOn === true,
        backupSize: item.backupSize,
        cleaning: snapshot.cleaning === true,
      },
      totalPrice: typeof snapshot.totalPrice === 'number' ? snapshot.totalPrice : 0,
    };
  });
}

export function syncStorefrontCart(items: CartItem[]) {
  const operation = syncChain
    .catch(() => undefined)
    .then(() => replaceStorefrontCart(toServerItems(items)));
  syncChain = operation;
  return operation;
}

export function useCart() {
  const storeSnapshot = useSyncExternalStore(subscribe, getCartSnapshot, () => '[]');
  
  const items = useMemo<CartItem[]>(() => {
    try {
      const parsed: unknown = JSON.parse(storeSnapshot);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((item): item is CartItem => Boolean(
        item && typeof item === 'object'
        && typeof (item as CartItem).cartItemId === 'string'
        && typeof (item as CartItem).productId === 'string'
        && typeof (item as CartItem).variantSizeId === 'string'
        && typeof (item as CartItem).startDate === 'string'
        && typeof (item as CartItem).endDate === 'string',
      ));
    } catch {
      return [];
    }
  }, [storeSnapshot]);

  const saveItems = useCallback((newItems: CartItem[]) => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(newItems));
    window.dispatchEvent(new Event('cart-update'));
    void syncStorefrontCart(newItems);
  }, []);

  useEffect(() => {
    if (hydrationStarted) return;
    hydrationStarted = true;
    const initialSnapshot = getCartSnapshot();
    void getStorefrontCart()
      .then((serverCart) => {
        const currentSnapshot = getCartSnapshot();
        if (currentSnapshot !== initialSnapshot) {
          const current = JSON.parse(currentSnapshot) as CartItem[];
          void syncStorefrontCart(current);
          return;
        }
        if (serverCart.items.length > 0) {
          localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(fromServerItems(serverCart.items)));
          window.dispatchEvent(new Event('cart-update'));
        } else {
          const local = JSON.parse(initialSnapshot) as CartItem[];
          if (local.length > 0) void syncStorefrontCart(local);
        }
      })
      .catch(() => {
        // The local copy remains usable; checkout reports any server sync error.
      });
  }, []);

  const addItem = useCallback((item: Omit<CartItem, 'cartItemId'>) => {
    const newItem = {
      ...item,
      cartItemId: crypto.randomUUID(),
    };
    saveItems([...items, newItem]);
  }, [items, saveItems]);

  const removeItem = useCallback((cartItemId: string) => {
    saveItems(items.filter(item => item.cartItemId !== cartItemId));
  }, [items, saveItems]);

  const updateItem = useCallback((cartItemId: string, updates: Partial<CartItem>) => {
    saveItems(items.map(item => item.cartItemId === cartItemId ? { ...item, ...updates } : item));
  }, [items, saveItems]);

  const clearCart = useCallback(() => {
    saveItems([]);
  }, [saveItems]);

  const totalItems = items.length;
  const totalPrice = items.reduce((sum, item) => sum + item.totalPrice, 0);
  const totalDeposit = items.reduce((sum, item) => sum + item.deposit, 0);

  return {
    items,
    addItem,
    removeItem,
    updateItem,
    clearCart,
    totalItems,
    totalPrice,
    totalDeposit
  };
}
