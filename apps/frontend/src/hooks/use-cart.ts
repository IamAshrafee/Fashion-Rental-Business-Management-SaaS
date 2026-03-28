"use client";

import { useState, useEffect, useCallback, useSyncExternalStore } from 'react';

export interface CartItem {
  cartItemId: string; // Unique generated ID for the item in cart
  productId: string;
  variantId?: string;
  productName: string;
  categoryName?: string;
  featuredImage?: string;
  basePrice: number;       // base price per period
  deposit: number;         // security deposit required
  startDate: string;       // YYYY-MM-DD
  endDate: string;         // YYYY-MM-DD
  durationDays: number;
  serviceMap: { 
    tryOn: boolean;
    backupSize?: string | null; 
    cleaning?: boolean; 
  };
  totalPrice: number;      // Calculated total
}

const CART_STORAGE_KEY = 'closetrent_guest_cart';

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

export function useCart() {
  const storeSnapshot = useSyncExternalStore(subscribe, getCartSnapshot, () => '[]');
  
  const items: CartItem[] = JSON.parse(storeSnapshot);

  const saveItems = useCallback((newItems: CartItem[]) => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(newItems));
    window.dispatchEvent(new Event('cart-update'));
  }, []);

  const addItem = useCallback((item: Omit<CartItem, 'cartItemId'>) => {
    const newItem = {
      ...item,
      cartItemId: Math.random().toString(36).substring(2, 9),
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
