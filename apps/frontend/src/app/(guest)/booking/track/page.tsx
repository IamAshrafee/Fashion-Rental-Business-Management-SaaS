'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AlertCircle, ArrowLeft, Loader2, Package, Search } from 'lucide-react';
import { trackBooking, type PublicBookingTracking } from '@/lib/api/guest-booking';
import { cn } from '@/lib/utils';

export default function GuestBookingTrackPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-gray-500">Loading booking tracker…</div>}>
      <GuestBookingTrackContent />
    </Suspense>
  );
}

function GuestBookingTrackContent() {
  const searchParams = useSearchParams();
  const initialToken = searchParams?.get('token') ?? '';
  const [token, setToken] = useState(initialToken);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [booking, setBooking] = useState<PublicBookingTracking | null>(null);

  const load = async (trackingToken: string) => {
    if (!trackingToken.trim()) {
      setError('Open the private tracking link from your booking confirmation.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      setBooking(await trackBooking(trackingToken.trim()));
    } catch (cause: unknown) {
      setBooking(null);
      setError(cause instanceof Error ? cause.message : 'This tracking link is invalid or expired.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialToken) void load(initialToken);
    // The initial capability is intentionally consumed once from the URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialToken]);

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <Link href="/" className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-black">
          <ArrowLeft className="h-4 w-4" /> Back to store
        </Link>

        <section className="border border-gray-100 bg-white p-6 shadow-sm sm:p-8">
          <h1 className="font-display text-3xl font-bold tracking-tight text-gray-900">Track your rental</h1>
          <p className="mt-2 text-gray-500">Use the private tracking code from your confirmation link. A booking number alone cannot expose customer information.</p>
          <form className="mt-6 flex flex-col gap-3 sm:flex-row" onSubmit={(event) => { event.preventDefault(); void load(token); }}>
            <label className="flex-1">
              <span className="mb-1 block text-sm font-medium text-gray-700">Private tracking code</span>
              <input value={token} onChange={(event) => setToken(event.target.value.trim())} autoComplete="off" className="h-12 w-full border border-gray-300 px-3 outline-none focus:border-black" placeholder="Paste your tracking code" />
            </label>
            <button disabled={loading} className="mt-auto inline-flex h-12 items-center justify-center gap-2 bg-black px-7 text-sm font-semibold uppercase tracking-wider text-white disabled:opacity-60">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Track
            </button>
          </form>
          {error && <p className="mt-3 flex items-center gap-2 text-sm text-red-600"><AlertCircle className="h-4 w-4" />{error}</p>}
        </section>

        {booking && (
          <section className="mt-8 grid gap-8 border border-gray-100 bg-white p-6 shadow-sm md:grid-cols-2 sm:p-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Booking</p>
              <h2 className="mt-1 text-2xl font-bold text-gray-900">{booking.bookingNumber}</h2>
              <span className="mt-3 inline-flex bg-gray-900 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">{booking.status.replaceAll('_', ' ')}</span>

              <div className="mt-8 border-l-2 border-gray-200 pl-6">
                {booking.timeline.map((event, index) => (
                  <div key={`${event.status}-${event.at}-${index}`} className="relative pb-7 last:pb-0">
                    <span className={cn('absolute -left-[31px] top-1 h-3 w-3 rounded-full ring-4 ring-white', event.type === 'courier' ? 'bg-blue-500' : 'bg-black')} />
                    <p className="font-semibold text-gray-900">{event.label}</p>
                    <p className="mt-1 text-xs text-gray-500">{new Date(event.at).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-6">
              {booking.rentalPeriod && (
                <div className="bg-gray-50 p-5">
                  <h3 className="font-bold text-gray-900">Rental period</h3>
                  <p className="mt-2 text-sm text-gray-600">{new Date(booking.rentalPeriod.startDate).toLocaleDateString()} – {new Date(booking.rentalPeriod.endDate).toLocaleDateString()}</p>
                  <p className="mt-1 text-sm text-gray-500">{booking.rentalPeriod.totalDays} days</p>
                </div>
              )}
              <div>
                <h3 className="font-bold text-gray-900">Items</h3>
                <div className="mt-3 divide-y border border-gray-200">
                  {booking.items.map((item, index) => (
                    <div key={`${item.productName}-${index}`} className="p-4">
                      <p className="font-medium text-gray-900">{item.productName}</p>
                      <p className="mt-1 text-xs text-gray-500">{new Date(item.startDate).toLocaleDateString()} – {new Date(item.endDate).toLocaleDateString()}</p>
                    </div>
                  ))}
                </div>
              </div>
              {booking.trackingNumber && (
                <div className="border border-blue-100 bg-blue-50 p-5">
                  <h3 className="flex items-center gap-2 font-bold text-gray-900"><Package className="h-4 w-4 text-blue-600" /> Delivery</h3>
                  <p className="mt-2 text-sm text-gray-600">{booking.courierProvider ?? 'Courier'} · <span className="font-mono">{booking.trackingNumber}</span></p>
                  {booking.courierStatus && <p className="mt-1 text-xs uppercase tracking-wide text-blue-700">{booking.courierStatus.replaceAll('_', ' ')}</p>}
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
