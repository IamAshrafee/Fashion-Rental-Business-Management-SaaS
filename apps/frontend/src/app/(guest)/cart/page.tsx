'use client';

import { useCart } from '@/hooks/use-cart';
import { useLocale } from '@/hooks/use-locale';
import Link from 'next/link';
import { ShoppingBag, ArrowLeft, Trash2, Loader2, AlertCircle, Edit3 } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { validateCart, type CartValidationResponse } from '@/lib/api/guest-booking';

export default function GuestCartPage() {
  const { items, removeItem, updateItem, totalPrice, totalDeposit } = useCart();
  const { formatPrice } = useLocale();
  const [mounted, setMounted] = useState(false);
  const [validation, setValidation] = useState<CartValidationResponse | null>(null);
  const [validating, setValidating] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

  // Validate cart items via backend
  const handleValidate = useCallback(async () => {
    if (items.length === 0) return;

    setValidating(true);
    setValidationError('');

    try {
      const result = await validateCart({
        items: items.map((item) => ({
          productId: item.productId,
          variantId: item.variantId || '',
          startDate: item.startDate,
          endDate: item.endDate,
          selectedSize: undefined,
          backupSize: item.serviceMap.backupSize || undefined,
          tryOn: item.serviceMap.tryOn,
        })),
      });
      setValidation(result);
    } catch (err: any) {
      setValidationError(err?.message || 'Failed to validate cart');
      setValidation(null);
    } finally {
      setValidating(false);
    }
  }, [items]);

  // Auto-validate on mount when items exist
  useEffect(() => {
    if (mounted && items.length > 0) {
      handleValidate();
    }
  }, [mounted]); // eslint-disable-line react-hooks/exhaustive-deps

  // Edit dates handlers
  const startEditing = (itemId: string, startDate: string, endDate: string) => {
    setEditingItemId(itemId);
    setEditStartDate(startDate);
    setEditEndDate(endDate);
  };

  const saveEditDates = (cartItemId: string) => {
    if (editStartDate && editEndDate) {
      const start = new Date(editStartDate);
      const end = new Date(editEndDate);
      const days = end > start
        ? Math.ceil((end.getTime() - start.getTime()) / (1000 * 3600 * 24))
        : 0;
      if (days > 0) {
        updateItem(cartItemId, {
          startDate: editStartDate,
          endDate: editEndDate,
          durationDays: days,
        });
      }
    }
    setEditingItemId(null);
  };

  if (!mounted) return null;

  if (items.length === 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
        <div className="mb-6 rounded-full bg-gray-100 p-8">
          <ShoppingBag className="h-16 w-16 text-gray-300" />
        </div>
        <h1 className="mb-2 font-display text-2xl font-bold text-gray-900">
          Your cart is empty
        </h1>
        <p className="mb-8 text-gray-500">
          Browse our collection and find your perfect outfit!
        </p>
        <Link
          href="/products"
          className="inline-flex items-center gap-2 bg-black px-6 py-3 font-semibold uppercase tracking-wider text-white transition-colors hover:bg-gray-800"
        >
          <ArrowLeft className="h-4 w-4" /> Browse Products
        </Link>
      </div>
    );
  }

  // Use validated data if available
  const summary = validation?.summary;
  const rentalSubtotal = summary?.subtotal || items.reduce((sum, item) => sum + item.basePrice, 0);
  const totalFees = summary?.totalFees || 0;
  const validatedDeposit = summary?.totalDeposit || totalDeposit;
  const shippingFee = summary?.shippingFee || 0;
  const grandTotal = summary?.grandTotal || totalPrice;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex items-center gap-4">
        <Link
          href="/products"
          className="text-sm font-medium text-gray-500 hover:text-black flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" /> Continue Shopping
        </Link>
        <span className="text-gray-300">|</span>
        <h1 className="font-display text-2xl font-bold text-gray-900 tracking-tight">
          Your Cart ({items.length})
        </h1>
      </div>

      {/* Validation errors */}
      {validationError && (
        <div className="mb-6 flex items-center gap-2 rounded bg-red-50 px-4 py-3 text-sm text-red-700 border border-red-200">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {validationError}
        </div>
      )}

      <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
        {/* Cart Items List */}
        <div className="flex-1 space-y-4">
          {items.map((item, idx) => {
            const validatedItem = validation?.items?.[idx];
            const hasError = validatedItem?.errors && validatedItem.errors.length > 0;
            const isEditing = editingItemId === item.cartItemId;

            return (
              <div
                key={item.cartItemId}
                className={`flex gap-4 border bg-white p-4 ${
                  hasError ? 'border-red-300' : 'border-gray-200'
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {item.featuredImage ? (
                  <img
                    src={item.featuredImage}
                    alt={item.productName}
                    className="h-32 w-24 object-cover bg-gray-100"
                  />
                ) : (
                  <div className="h-32 w-24 bg-gray-100 flex items-center justify-center text-gray-400 text-xs">
                    No Image
                  </div>
                )}
                <div className="flex flex-1 flex-col">
                  <div className="flex justify-between">
                    <h3 className="font-bold text-gray-900 leading-tight">
                      {item.productName}
                    </h3>
                    <span className="font-bold text-gray-900">
                      {formatPrice(validatedItem?.itemTotal || item.totalPrice)}
                    </span>
                  </div>

                  {/* Dates or date editor */}
                  {isEditing ? (
                    <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end">
                      <div className="flex-1">
                        <label className="text-xs text-gray-500">Start</label>
                        <input
                          type="date"
                          className="w-full border border-gray-300 p-2 text-sm focus:border-black focus:ring-0"
                          value={editStartDate}
                          onChange={(e) => setEditStartDate(e.target.value)}
                          min={new Date().toISOString().split('T')[0]}
                        />
                      </div>
                      <div className="flex-1">
                        <label className="text-xs text-gray-500">End</label>
                        <input
                          type="date"
                          className="w-full border border-gray-300 p-2 text-sm focus:border-black focus:ring-0"
                          value={editEndDate}
                          onChange={(e) => setEditEndDate(e.target.value)}
                          min={editStartDate || new Date().toISOString().split('T')[0]}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => saveEditDates(item.cartItemId)}
                        className="bg-black px-4 py-2 text-xs font-semibold uppercase text-white hover:bg-gray-800"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingItemId(null)}
                        className="px-3 py-2 text-xs font-semibold text-gray-500 hover:text-black"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="mt-1 text-sm text-gray-500">
                      <p>
                        {item.startDate} → {item.endDate} ({item.durationDays}{' '}
                        days)
                      </p>
                    </div>
                  )}

                  {/* Errors from validation */}
                  {hasError && (
                    <div className="mt-2 text-xs text-red-600">
                      {validatedItem!.errors!.map((err, i) => (
                        <p key={i}>⚠ {err}</p>
                      ))}
                    </div>
                  )}

                  {/* Price breakdown */}
                  <div className="mt-2 text-xs text-gray-500 grid grid-cols-2 gap-x-4 gap-y-1">
                    <span className="flex justify-between">
                      Rental:{' '}
                      <span>{formatPrice(validatedItem?.rentalPrice || item.basePrice)}</span>
                    </span>
                    {(validatedItem?.tryOnFee || 0) > 0 && (
                      <span className="flex justify-between">
                        Try-On: <span>{formatPrice(validatedItem!.tryOnFee)}</span>
                      </span>
                    )}
                    {(validatedItem?.backupSizeFee || 0) > 0 && (
                      <span className="flex justify-between">
                        Backup Size: <span>{formatPrice(validatedItem!.backupSizeFee)}</span>
                      </span>
                    )}
                    {item.serviceMap.tryOn && !validatedItem && (
                      <span className="flex justify-between">Try-On: <span>—</span></span>
                    )}
                    <span className="flex justify-between text-orange-600 font-medium">
                      Deposit:{' '}
                      <span>{formatPrice(validatedItem?.deposit || item.deposit)}</span>
                    </span>
                  </div>

                  <div className="mt-auto flex items-center justify-between pt-4">
                    {!isEditing && (
                      <button
                        type="button"
                        onClick={() =>
                          startEditing(item.cartItemId, item.startDate, item.endDate)
                        }
                        className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-black hover:underline"
                      >
                        <Edit3 className="h-3 w-3" /> Edit Dates
                      </button>
                    )}
                    <button
                      onClick={() => removeItem(item.cartItemId)}
                      className="flex items-center gap-1 text-sm text-red-500 hover:text-red-700 transition-colors ml-auto"
                    >
                      <Trash2 className="h-4 w-4" /> Remove
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Order Summary */}
        <div className="w-full lg:w-[380px] shrink-0 sticky top-24">
          <div className="bg-gray-50 border border-gray-100 p-6">
            <h2 className="font-display text-xl font-bold tracking-tight text-gray-900 mb-6">
              Order Summary
            </h2>

            {validating && (
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
                <Loader2 className="h-4 w-4 animate-spin" /> Validating prices...
              </div>
            )}

            <div className="space-y-3 text-sm text-gray-600">
              <div className="flex justify-between">
                <span>Rental Subtotal ({items.length} items)</span>
                <span className="font-medium text-gray-900">
                  {formatPrice(rentalSubtotal)}
                </span>
              </div>

              {totalFees > 0 && (
                <div className="flex justify-between">
                  <span>Services & Fees</span>
                  <span className="font-medium text-gray-900">
                    {formatPrice(totalFees)}
                  </span>
                </div>
              )}

              {shippingFee > 0 && (
                <div className="flex justify-between">
                  <span>Shipping</span>
                  <span className="font-medium text-gray-900">
                    {formatPrice(shippingFee)}
                  </span>
                </div>
              )}

              <div className="flex justify-between text-orange-600 pb-4 border-b">
                <span>Refundable Deposits</span>
                <span className="font-medium">
                  {formatPrice(validatedDeposit)}
                </span>
              </div>

              <div className="flex justify-between pt-2 text-lg font-bold text-gray-900">
                <span>Grand Total</span>
                <span>{formatPrice(grandTotal)}</span>
              </div>
            </div>

            <div className="mt-8 space-y-3">
              <button
                type="button"
                onClick={handleValidate}
                disabled={validating}
                className="flex w-full items-center justify-center gap-2 border border-gray-300 px-6 py-3 text-xs font-semibold uppercase tracking-wider text-gray-700 transition-colors hover:bg-gray-100"
              >
                {validating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Refresh Prices'
                )}
              </button>
              <Link
                href="/checkout"
                className="flex w-full items-center justify-center bg-black px-6 py-4 text-sm font-bold uppercase tracking-widest text-white transition-colors hover:bg-gray-800"
              >
                Proceed to Checkout
              </Link>
            </div>

            <p className="mt-4 text-center text-xs text-gray-500">
              Prices are verified server-side at checkout.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
