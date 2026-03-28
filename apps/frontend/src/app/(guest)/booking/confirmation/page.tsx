'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, ArrowRight, MessageCircle } from 'lucide-react';
import { useTenant } from '@/hooks/use-tenant';

export default function GuestBookingConfirmationPage() {
  const searchParams = useSearchParams();
  const orderNumber = searchParams?.get('number');
  const { tenant } = useTenant();

  return (
    <div className="flex min-h-[70vh] items-center justify-center p-4">
      <div className="mx-auto w-full max-w-lg bg-white p-8 sm:p-12 shadow-2xl border border-gray-100 text-center">
        
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-50 animate-in zoom-in duration-500">
          <CheckCircle2 className="h-10 w-10 text-green-500" />
        </div>
        
        <h1 className="font-display text-3xl font-bold tracking-tight text-gray-900 mb-2">Booking Confirmed!</h1>
        <p className="text-gray-500 mb-8">
          Your booking {orderNumber ? <strong className="text-black inline-block ml-1">#{orderNumber}</strong> : 'has been placed'} successfully.
        </p>

        <div className="bg-gray-50 border border-gray-100 p-6 rounded text-left mb-8">
           <h2 className="font-bold text-gray-900 mb-4 text-sm uppercase tracking-wider">What happens next?</h2>
           <ul className="space-y-4 text-sm text-gray-600">
             <li className="flex gap-3">
               <span className="flex-shrink-0 h-6 w-6 rounded-full bg-white border border-gray-200 flex items-center justify-center font-bold text-xs text-black">1</span>
               <p>We're reviewing your booking and will verify availability.</p>
             </li>
             <li className="flex gap-3">
               <span className="flex-shrink-0 h-6 w-6 rounded-full bg-white border border-gray-200 flex items-center justify-center font-bold text-xs text-black">2</span>
               <p>You'll receive an SMS with delivery updates soon.</p>
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
            href="/booking/track"
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
