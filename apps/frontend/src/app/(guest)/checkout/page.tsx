'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { syncStorefrontCart, useCart } from '@/hooks/use-cart';
import { useLocale } from '@/hooks/use-locale';
import { useTenant } from '@/hooks/use-tenant';
import { createBooking, initiateSslcommerz, validateCart, type CartValidationResponse } from '@/lib/api/guest-booking';
import { ArrowLeft, Loader2, MapPin, CreditCard, UserCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function GuestCheckoutPage() {
  const router = useRouter();
  const { items, clearCart } = useCart();
  const { formatPrice } = useLocale();
  const { tenant } = useTenant();

  const [mounted, setMounted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorObj, setErrorObj] = useState<Record<string, string>>({});
  const [globalError, setGlobalError] = useState('');
  const [pricing, setPricing] = useState<CartValidationResponse | null>(null);
  const [pricingLoading, setPricingLoading] = useState(true);
  const idempotencyKeyRef = useRef<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    altPhone: '',
    email: '',
    address: '',
    area: '',
    district: '',
    notes: '',
  });

  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'bkash' | 'nagad' | 'sslcommerz'>('cod');
  const [transactionId, setTransactionId] = useState('');
  
  const checkoutItems = useMemo(() => items.map(i => ({
    productId: i.productId,
    variantId: i.variantId || '',
    variantSizeId: i.variantSizeId,
    preferredStockUnitId: i.preferredStockUnitId,
    quantity: i.quantity,
    startDate: i.startDate,
    endDate: i.endDate,
    selectedSize: i.selectedSize,
    tryOn: i.serviceMap?.tryOn || false,
    backupSize: i.serviceMap?.backupSize || undefined,
    compositionSelections: i.compositionSelections?.map(({ label: _label, ...selection }) => selection),
  })), [items]);

  useEffect(() => {
    setMounted(true);
    if (items.length === 0) {
      router.push('/cart');
    }
  }, [items.length, router]);

  useEffect(() => {
    if (!mounted || checkoutItems.length === 0) return;
    let active = true;
    setPricingLoading(true);
    syncStorefrontCart(items)
      .then(() => validateCart({ items: checkoutItems, issueCheckoutQuote: true }))
      .then((result) => {
        if (!active) return;
        setPricing(result);
        setGlobalError(result.valid ? '' : 'One or more items are no longer available for these dates.');
      })
      .catch((error: unknown) => {
        if (!active) return;
        setPricing(null);
        setGlobalError(error instanceof Error ? error.message : 'Could not confirm current availability.');
      })
      .finally(() => { if (active) setPricingLoading(false); });
    return () => { active = false; };
  }, [checkoutItems, items, mounted]);

  if (!mounted || items.length === 0) return null;

  const summary = pricing?.summary;
  const authoritativeTotal = summary?.grandTotal ?? 0;

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!formData.name) errs.name = 'Name is required';
    if (!/^(01\d{9}|\+?[1-9]\d{7,14})$/.test(formData.phone)) errs.phone = 'Enter a valid mobile number';
    if (!formData.address) errs.address = 'Detailed address is required';
    if (!formData.area) errs.area = 'Area is required';
    if (!formData.district) errs.district = 'District is required';
    if (['bkash', 'nagad'].includes(paymentMethod) && !transactionId) errs.transactionId = 'Transaction ID is required for mobile payments';
    
    setErrorObj(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGlobalError('');
    
    if (!validate()) return;
    
    setSubmitting(true);
    try {
      await syncStorefrontCart(items);
      const currentPricing = await validateCart({ items: checkoutItems, issueCheckoutQuote: true });
      setPricing(currentPricing);
      if (!currentPricing.valid || !currentPricing.checkoutQuote) {
        throw new Error('Availability changed. Review your cart and choose available dates.');
      }
      if (!idempotencyKeyRef.current) idempotencyKeyRef.current = crypto.randomUUID();
      const response = await createBooking({
        customer: {
          fullName: formData.name,
          phone: formData.phone,
          email: formData.email || undefined,
        },
        delivery: {
          address: formData.address,
          area: formData.area || undefined,
          district: formData.district || undefined,
        },
        items: checkoutItems,
        paymentMethod,
        checkoutQuoteId: currentPricing.checkoutQuote.id,
        checkoutQuoteHash: currentPricing.checkoutQuote.quoteHash,
        bkashTransactionId: paymentMethod === 'bkash' ? transactionId : undefined,
        nagadTransactionId: paymentMethod === 'nagad' ? transactionId : undefined,
        customerNotes: formData.notes || undefined,
      }, idempotencyKeyRef.current);

      if (paymentMethod === 'sslcommerz') {
        try {
          const paymentUrl = await initiateSslcommerz(response.bookingId, response.trackingToken);
          clearCart();
          window.location.assign(paymentUrl);
          return;
        } catch {
          clearCart();
          router.push(`/booking/confirmation?number=${encodeURIComponent(response.bookingNumber)}&token=${encodeURIComponent(response.trackingToken)}&bookingId=${encodeURIComponent(response.bookingId)}&payment=retry`);
          return;
        }
      }
      clearCart();
      router.push(`/booking/confirmation?number=${encodeURIComponent(response.bookingNumber)}&token=${encodeURIComponent(response.trackingToken)}`);

    } catch (err: unknown) {
      setGlobalError(err instanceof Error ? err.message : 'Failed to place booking. Dates may have become unavailable.');
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 bg-gray-50 min-h-screen">
      <div className="mb-8">
        <Link href="/cart" className="text-sm font-medium text-gray-500 hover:text-black flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" /> Back to Cart
        </Link>
        <h1 className="mt-4 font-display text-3xl font-bold text-gray-900 tracking-tight">Checkout</h1>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-8 lg:flex-row lg:items-start pb-20">
        
        <div className="flex-1 space-y-8">
          {globalError && (
             <div className="bg-red-50 border border-red-200 text-red-700 p-4 font-medium flex gap-3">
               <span>⚠️</span> {globalError}
             </div>
          )}

          {/* Section 1: Customer Info */}
          <section className="bg-white p-6 shadow-sm border border-gray-100">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold text-gray-900 mb-6 border-b pb-4">
              <UserCircle className="text-gray-400" /> Your Information
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1 md:col-span-2">
                <label className="text-sm font-medium text-gray-700">Phone Number *</label>
                <div className="relative">
                  <input
                    type="tel"
                    placeholder="01712345678"
                    className={cn(
                      "w-full rounded-none border p-3 text-sm focus:ring-0 transition-colors",
                      errorObj.phone ? "border-red-500 focus:border-red-500" : "border-gray-300 focus:border-black",
                      "bg-white"
                    )}
                    value={formData.phone}
                    onChange={e => setFormData({...formData, phone: e.target.value.replace(/[^+\d]/g, '').slice(0, 16)})}
                    disabled={submitting}
                  />
                </div>
                {errorObj.phone && <p className="text-red-500 text-xs">{errorObj.phone}</p>}
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Full Name *</label>
                <input
                  type="text"
                  className={cn(
                    "w-full rounded-none border p-3 text-sm focus:ring-0",
                    errorObj.name ? "border-red-500 focus:border-red-500" : "border-gray-300 focus:border-black"
                  )}
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  disabled={submitting}
                />
                {errorObj.name && <p className="text-red-500 text-xs">{errorObj.name}</p>}
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Email (Optional)</label>
                <input
                  type="email"
                  className="w-full rounded-none border border-gray-300 p-3 text-sm focus:border-black focus:ring-0"
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                  disabled={submitting}
                />
              </div>
            </div>
          </section>

          {/* Section 2: Delivery */}
          <section className="bg-white p-6 shadow-sm border border-gray-100">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold text-gray-900 mb-6 border-b pb-4">
              <MapPin className="text-gray-400" /> Delivery Address
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1 md:col-span-2">
                <label className="text-sm font-medium text-gray-700">Detailed Address (House, Road, Block) *</label>
                <input
                  type="text"
                  className={cn(
                    "w-full rounded-none border p-3 text-sm focus:ring-0",
                    errorObj.address ? "border-red-500 focus:border-red-500" : "border-gray-300 focus:border-black"
                  )}
                  value={formData.address}
                  onChange={e => setFormData({...formData, address: e.target.value})}
                  disabled={submitting}
                />
                {errorObj.address && <p className="text-red-500 text-xs">{errorObj.address}</p>}
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Area *</label>
                <input
                  type="text"
                  placeholder="e.g. Dhanmondi"
                  className={cn(
                    "w-full rounded-none border p-3 text-sm focus:ring-0",
                    errorObj.area ? "border-red-500 focus:border-red-500" : "border-gray-300 focus:border-black"
                  )}
                  value={formData.area}
                  onChange={e => setFormData({...formData, area: e.target.value})}
                  disabled={submitting}
                />
                {errorObj.area && <p className="text-red-500 text-xs">{errorObj.area}</p>}
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">District *</label>
                <select
                  className={cn(
                    "w-full rounded-none border p-3 text-sm focus:ring-0 bg-white",
                    errorObj.district ? "border-red-500 focus:border-red-500" : "border-gray-300 focus:border-black"
                  )}
                  value={formData.district}
                  onChange={e => setFormData({...formData, district: e.target.value})}
                  disabled={submitting}
                >
                  <option value="">Select District</option>
                  <option value="Dhaka">Dhaka</option>
                  <option value="Chittagong">Chittagong</option>
                  <option value="Sylhet">Sylhet</option>
                  <option value="Khulna">Khulna</option>
                  <option value="Rajshahi">Rajshahi</option>
                  <option value="Barisal">Barisal</option>
                  <option value="Rangpur">Rangpur</option>
                  <option value="Mymensingh">Mymensingh</option>
                </select>
                {errorObj.district && <p className="text-red-500 text-xs">{errorObj.district}</p>}
              </div>
              
              <div className="space-y-1 md:col-span-2">
                <label className="text-sm font-medium text-gray-700">Special Instructions (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Please call before arriving"
                  className="w-full rounded-none border border-gray-300 p-3 text-sm focus:border-black focus:ring-0"
                  value={formData.notes}
                  onChange={e => setFormData({...formData, notes: e.target.value})}
                  disabled={submitting}
                />
              </div>
            </div>
          </section>

          {/* Section 3: Payment */}
          <section className="bg-white p-6 shadow-sm border border-gray-100">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold text-gray-900 mb-6 border-b pb-4">
              <CreditCard className="text-gray-400" /> Payment Method
            </h2>
            
            <div className="space-y-4">
              <label className={cn("flex cursor-pointer items-start gap-4 border p-4 transition-colors", paymentMethod === 'cod' ? "border-black bg-gray-50" : "border-gray-200")}>
                <input type="radio" name="payment" className="mt-1 h-5 w-5 border-gray-300 text-black focus:ring-black" checked={paymentMethod === 'cod'} onChange={() => setPaymentMethod('cod')} />
                <div className="flex flex-col">
                  <span className="font-bold text-gray-900">Cash on Delivery (COD)</span>
                  <span className="text-sm text-gray-500">Pay the full amount when the product is delivered.</span>
                </div>
              </label>

              {tenant?.bkashNumber && <label className={cn("flex cursor-pointer items-start gap-4 border p-4 transition-colors", paymentMethod === 'bkash' ? "border-black bg-gray-50" : "border-gray-200")}>
                <input type="radio" name="payment" className="mt-1 h-5 w-5 border-gray-300 text-black focus:ring-black" checked={paymentMethod === 'bkash'} onChange={() => setPaymentMethod('bkash')} />
                <div className="flex flex-col w-full">
                  <span className="font-bold text-gray-900">bKash Manual Send</span>
                  <span className="text-sm text-gray-500">Send {formatPrice(authoritativeTotal)} to the store bKash number.</span>
                  
                  {paymentMethod === 'bkash' && (
                    <div className="mt-4 border-t border-gray-200 pt-4 cursor-default" onClick={e => e.preventDefault()}>
                      <div className="bg-pink-50 p-3 mb-3 border border-pink-200 text-pink-900 text-sm">
                        bKash: <strong>{tenant.bkashNumber}</strong> <br/>
                        Amount: <strong>{formatPrice(authoritativeTotal)}</strong>
                      </div>
                      <label className="text-sm font-medium text-gray-700 block mb-1">Enter Transaction ID (TrxID) *</label>
                      <input
                        type="text"
                        placeholder="8J9KH2L11M"
                        className={cn(
                          "w-full rounded-none border p-3 text-sm focus:ring-0 uppercase bg-white",
                          errorObj.transactionId ? "border-red-500 focus:border-red-500" : "border-gray-300 focus:border-black"
                        )}
                        value={transactionId}
                        onChange={e => setTransactionId(e.target.value.toUpperCase())}
                      />
                      {errorObj.transactionId && <p className="text-red-500 text-xs mt-1">{errorObj.transactionId}</p>}
                    </div>
                  )}
                </div>
              </label>}

              {tenant?.nagadNumber && <label className={cn("flex cursor-pointer items-start gap-4 border p-4 transition-colors", paymentMethod === 'nagad' ? "border-black bg-gray-50" : "border-gray-200")}>
                <input type="radio" name="payment" className="mt-1 h-5 w-5 border-gray-300 text-black focus:ring-black" checked={paymentMethod === 'nagad'} onChange={() => setPaymentMethod('nagad')} />
                <div className="flex w-full flex-col">
                  <span className="font-bold text-gray-900">Nagad Manual Send</span>
                  <span className="text-sm text-gray-500">Send {formatPrice(authoritativeTotal)} to the store Nagad number.</span>
                  {paymentMethod === 'nagad' && (
                    <div className="mt-4 cursor-default border-t border-gray-200 pt-4" onClick={e => e.preventDefault()}>
                      <div className="mb-3 border border-orange-200 bg-orange-50 p-3 text-sm text-orange-900">
                        Nagad: <strong>{tenant.nagadNumber}</strong><br />
                        Amount: <strong>{formatPrice(authoritativeTotal)}</strong>
                      </div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">Enter Transaction ID *</label>
                      <input type="text" value={transactionId} onChange={e => setTransactionId(e.target.value.toUpperCase())} className={cn("w-full border bg-white p-3 text-sm uppercase", errorObj.transactionId ? "border-red-500" : "border-gray-300 focus:border-black")} />
                      {errorObj.transactionId && <p className="mt-1 text-xs text-red-500">{errorObj.transactionId}</p>}
                    </div>
                  )}
                </div>
              </label>}
              
              {tenant?.sslcommerzEnabled && <label className={cn("flex cursor-pointer items-start gap-4 border p-4 transition-colors", paymentMethod === 'sslcommerz' ? "border-black bg-gray-50" : "border-gray-200")}>
                <input type="radio" name="payment" className="mt-1 h-5 w-5 border-gray-300 text-black focus:ring-black" checked={paymentMethod === 'sslcommerz'} onChange={() => setPaymentMethod('sslcommerz')} />
                <div className="flex flex-col">
                  <span className="font-bold text-gray-900">SSLCommerz (Card / Online Banking)</span>
                  <span className="text-sm text-gray-500">Redirects securely to SSLCommerz to process payment.</span>
                </div>
              </label>}
            </div>
          </section>

        </div>

        {/* Right Sticky Summary */}
        <div className="w-full lg:w-[400px] shrink-0 sticky top-24">
          <div className="bg-white border border-gray-200 p-6 shadow-xl shadow-black/5">
            <h2 className="font-display text-xl font-bold tracking-tight text-gray-900 mb-6">Order Booking</h2>
            
            <div className="space-y-4 text-sm mb-6 border-b border-gray-100 pb-6 max-h-[40vh] overflow-y-auto no-scrollbar">
               {items.map((item, index) => (
                 <div key={item.cartItemId} className="flex gap-3">
                   {/* eslint-disable-next-line @next/next/no-img-element */}
                   <img src={item.featuredImage || '/placeholder-product.jpg'} alt="" className="w-12 h-16 object-cover bg-gray-100" />
                   <div className="flex-1 flex flex-col justify-center">
                     <p className="font-semibold text-gray-900 line-clamp-1">{item.productName}</p>
                     <p className="text-gray-500 text-xs">{item.startDate} ({item.durationDays}d)</p>
                   </div>
                   <div className="font-semibold">{formatPrice(pricing?.items[index]?.itemTotal ?? item.totalPrice)}</div>
                 </div>
               ))}
            </div>

            <div className="space-y-3 text-sm text-gray-600 mb-6">
              <div className="flex justify-between">
                <span>Total Deposit (Refundable)</span>
                <span className="font-medium text-orange-600">{formatPrice(summary?.totalDeposit ?? 0)}</span>
              </div>
              <div className="flex justify-between pt-2 text-xl font-bold text-gray-900 border-t border-gray-200">
                <span>Grand Total</span>
                <span>{pricingLoading ? 'Checking…' : formatPrice(authoritativeTotal)}</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || pricingLoading || !pricing?.valid || !pricing.checkoutQuote}
              className="flex w-full items-center justify-center gap-2 bg-black px-6 py-4 text-sm font-bold uppercase tracking-widest text-white transition-colors hover:bg-gray-800 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : `Confirm Booking`}
            </button>
            
            <p className="mt-4 text-center text-xs text-gray-500 leading-relaxed">
              By confirming, you agree to our Rental Terms, Return Policy, and forfeit rules around deposits.
            </p>
          </div>
        </div>
        
      </form>
    </div>
  );
}
