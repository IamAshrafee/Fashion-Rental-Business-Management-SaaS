'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, ArrowRight, Loader2, MessageCircle } from 'lucide-react';
import { useTenant } from '@/hooks/use-tenant';
import { initiateSslcommerz } from '@/lib/api/guest-booking';

export default function GuestBookingConfirmationPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-gray-500">Loading confirmation…</div>}>
      <GuestBookingConfirmationContent />
    </Suspense>
  );
}

function GuestBookingConfirmationContent() {
  const searchParams = useSearchParams();
  const orderNumber = searchParams?.get('number');
  const trackingToken = searchParams?.get('token');
  const bookingId = searchParams?.get('bookingId');
  const payment = searchParams?.get('payment');
  const { tenant } = useTenant();
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState('');

  const retryPayment = async () => {
    if (!bookingId || !trackingToken) return;
    setRetrying(true);
    setRetryError('');
    try {
      window.location.assign(await initiateSslcommerz(bookingId, trackingToken));
    } catch (cause: unknown) {
      setRetryError(cause instanceof Error ? cause.message : 'Secure payment is temporarily unavailable.');
      setRetrying(false);
    }
  };

  return (
    <div className="flex min-h-[70vh] items-center justify-center p-4">
      <div className="mx-auto w-full max-w-lg bg-white p-8 sm:p-12 shadow-2xl border border-gray-100 text-center">
        
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-50 animate-in zoom-in duration-500">
          <CheckCircle2 className="h-10 w-10 text-green-500" />
        </div>
        
        <h1 className="font-display text-3xl font-bold tracking-tight text-gray-900 mb-2">Booking received</h1>
        <p className="text-gray-500 mb-8">
          Your request {orderNumber ? <strong className="text-black inline-block ml-1">#{orderNumber}</strong> : 'has been placed'} is pending store review.
        </p>

        {payment === 'retry' && bookingId && trackingToken && (
          <div className="mb-8 border border-amber-200 bg-amber-50 p-4 text-left text-sm text-amber-900">
            <p className="font-semibold">Your booking is safe, but the payment page did not open.</p>
            <button onClick={() => void retryPayment()} disabled={retrying} className="mt-3 inline-flex items-center gap-2 bg-black px-4 py-2 font-semibold text-white disabled:opacity-60">
              {retrying && <Loader2 className="h-4 w-4 animate-spin" />} Retry secure payment
            </button>
            {retryError && <p className="mt-2 text-red-700">{retryError}</p>}
          </div>
        )}

        <div className="bg-gray-50 border border-gray-100 p-6 rounded text-left mb-8">
           <h2 className="font-bold text-gray-900 mb-4 text-sm uppercase tracking-wider">What happens next?</h2>
           <ul className="space-y-4 text-sm text-gray-600">
             <li className="flex gap-3">
               <span className="flex-shrink-0 h-6 w-6 rounded-full bg-white border border-gray-200 flex items-center justify-center font-bold text-xs text-black">1</span>
               <p>We&apos;re reviewing your booking and will verify availability.</p>
             </li>
             <li className="flex gap-3">
               <span className="flex-shrink-0 h-6 w-6 rounded-full bg-white border border-gray-200 flex items-center justify-center font-bold text-xs text-black">2</span>
               <p>You&apos;ll receive an SMS with delivery updates soon.</p>
             </li>
           </ul>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row justify-center">
          <Link
            href="/products"
            className="flex items-center justify-center gap-2 border border-black px-6 py-3 font-semibold uppercase tracking-wider text-black transition-colors hover:bg-black hover:text-white"
          >
            Continue Shopping
          </Link>
          <Link
            href={trackingToken ? `/booking/track?token=${encodeURIComponent(trackingToken)}` : '/booking/track'}
            className="flex items-center justify-center gap-2 bg-black px-6 py-3 font-semibold uppercase tracking-wider text-white transition-colors hover:bg-gray-800"
          >
            Track Booking <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {tenant?.whatsapp && (
          <div className="mt-8 border-t border-gray-100 pt-8">
             <p className="text-sm text-gray-500 mb-3">Questions about your order?</p>
             <a 
               href={`https://wa.me/${tenant.whatsapp.replace(/[^0-9]/g, '')}`} 
               target="_blank" 
               rel="noopener noreferrer"
               className="inline-flex items-center gap-2 text-sm font-medium text-green-600 hover:underline"
             >
               <MessageCircle className="h-4 w-4" /> Message us on WhatsApp
             </a>
          </div>
        )}
      </div>
    </div>
  );
}
