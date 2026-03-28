'use client';

import { useCart } from '@/hooks/use-cart';
import { useLocale } from '@/hooks/use-locale';
import Link from 'next/link';
import { ShoppingBag, ArrowLeft, Trash2 } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function GuestCartPage() {
  const { items, removeItem, totalPrice, totalDeposit } = useCart();
  const { formatPrice } = useLocale();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null; // Wait for hydration (localStorage access)

  // Empty state
  if (items.length === 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
        <div className="mb-6 rounded-full bg-gray-100 p-8">
          <ShoppingBag className="h-16 w-16 text-gray-300" />
        </div>
        <h1 className="mb-2 font-display text-2xl font-bold text-gray-900">Your cart is empty</h1>
        <p className="mb-8 text-gray-500">Browse our collection and find your perfect outfit!</p>
        <Link
          href="/products"
          className="inline-flex items-center gap-2 bg-black px-6 py-3 font-semibold uppercase tracking-wider text-white transition-colors hover:bg-gray-800"
        >
          <ArrowLeft className="h-4 w-4" /> Browse Products
        </Link>
      </div>
    );
  }

  // Calculate Subtotals
  const rentalSubtotal = items.reduce((sum, item) => sum + item.basePrice, 0);
  const cleaningFees = items.reduce((sum, item) => sum + (item.serviceMap.cleaning ? 500 : 0), 0);
  const tryOnFees = items.reduce((sum, item) => sum + (item.serviceMap.tryOn ? 1000 : 0), 0);
  const backupFees = items.reduce((sum, item) => sum + (item.serviceMap.backupSize ? 300 : 0), 0);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex items-center gap-4">
        <Link href="/products" className="text-sm font-medium text-gray-500 hover:text-black flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" /> Continue Shopping
        </Link>
        <span className="text-gray-300">|</span>
        <h1 className="font-display text-2xl font-bold text-gray-900 tracking-tight">Your Cart ({items.length})</h1>
      </div>

      <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
        {/* Cart Items List */}
        <div className="flex-1 space-y-4">
          {items.map((item) => (
             <div key={item.cartItemId} className="flex gap-4 border border-gray-200 bg-white p-4">
               {/* eslint-disable-next-line @next/next/no-img-element */}
               <img src={item.featuredImage || '/placeholder-product.jpg'} alt={item.productName} className="h-32 w-24 object-cover bg-gray-100" />
               <div className="flex flex-1 flex-col">
                 <div className="flex justify-between">
                   <h3 className="font-bold text-gray-900 leading-tight">{item.productName}</h3>
                   <span className="font-bold text-gray-900">{formatPrice(item.totalPrice)}</span>
                 </div>
                 
                 <div className="mt-1 text-sm text-gray-500">
                    <p>{item.startDate} → {item.endDate} ({item.durationDays} days)</p>
                    {item.variantId && <p>Color Variant ID: {item.variantId}</p>}
                 </div>

                 <div className="mt-2 text-xs text-gray-500 grid grid-cols-2 gap-x-4 gap-y-1">
                    <span className="flex justify-between">Rental: <span>{formatPrice(item.basePrice)}</span></span>
                    {item.serviceMap.tryOn && <span className="flex justify-between">Try-On: <span>{formatPrice(1000)}</span></span>}
                    {item.serviceMap.backupSize && <span className="flex justify-between">Backup Size ({item.serviceMap.backupSize}): <span>{formatPrice(300)}</span></span>}
                    <span className="flex justify-between text-orange-600 font-medium">Deposit: <span>{formatPrice(item.deposit)}</span></span>
                 </div>

                 <div className="mt-auto flex items-center justify-between pt-4">
                    <button type="button" className="text-xs font-semibold uppercase tracking-wider text-black underline">Edit Dates</button>
                    <button 
                      onClick={() => removeItem(item.cartItemId)}
                      className="flex items-center gap-1 text-sm text-red-500 hover:text-red-700 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" /> Remove
                    </button>
                 </div>
               </div>
             </div>
          ))}
        </div>

        {/* Order Summary */}
        <div className="w-full lg:w-[380px] shrink-0 sticky top-24">
          <div className="bg-gray-50 border border-gray-100 p-6">
            <h2 className="font-display text-xl font-bold tracking-tight text-gray-900 mb-6">Order Summary</h2>
            
            <div className="space-y-3 text-sm text-gray-600">
              <div className="flex justify-between">
                <span>Rental Subtotal ({items.length} items)</span>
                <span className="font-medium text-gray-900">{formatPrice(rentalSubtotal)}</span>
              </div>
              
              {cleaningFees > 0 && (
                <div className="flex justify-between">
                  <span>Cleaning Fees</span>
                  <span className="font-medium text-gray-900">{formatPrice(cleaningFees)}</span>
                </div>
              )}
              
              {(tryOnFees + backupFees) > 0 && (
                <div className="flex justify-between">
                  <span>Additional Services</span>
                  <span className="font-medium text-gray-900">{formatPrice(tryOnFees + backupFees)}</span>
                </div>
              )}

              <div className="flex justify-between text-orange-600 pb-4 border-b">
                <span>Refundable Deposits</span>
                <span className="font-medium">{formatPrice(totalDeposit)}</span>
              </div>
              
              <div className="flex justify-between pt-2 text-lg font-bold text-gray-900">
                <span>Grand Total</span>
                <span>{formatPrice(totalPrice)}</span>
              </div>
            </div>

            <div className="mt-8">
              <Link
                href="/checkout"
                className="flex w-full items-center justify-center bg-black px-6 py-4 text-sm font-bold uppercase tracking-widest text-white transition-colors hover:bg-gray-800"
              >
                Proceed to Checkout
              </Link>
            </div>
            
            <p className="mt-4 text-center text-xs text-gray-500">
              Need help? Contact our support line or hit the WhatsApp button below.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
