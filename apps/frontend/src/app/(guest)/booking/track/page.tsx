'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { trackBooking } from '@/lib/api/guest-booking';
import {
  Search,
  Package,
  CheckCircle2,
  ArrowLeft,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useLocale } from '@/hooks/use-locale';

interface TrackingData {
  bookingNumber: string;
  status: string;
  trackingNumber?: string | null;
  courierProvider?: string | null;
  courierStatus?: string | null;
  customerName: string;
  deliveryAddress: string;
  items: Array<{
    productName: string;
    colorName?: string;
    startDate: string;
    endDate: string;
  }>;
  grandTotal: number;
  paidAmount: number;
  createdAt: string;
  statusTimeline: Array<{
    status: string;
    label: string;
    timestamp: string | null;
    type: 'business' | 'courier';
    done: boolean;
  }>;
}

const STATUS_ORDER = [
  'pending',
  'confirmed',
  'shipped',
  'delivered',
  'returned',
  'completed',
];

const STATUS_LABELS: Record<string, string> = {
  pending: 'Order Placed',
  confirmed: 'Confirmed',
  shipped: 'Shipped',
  delivered: 'Delivered',
  returned: 'Returned',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export default function GuestBookingTrackPage() {
  const searchParams = useSearchParams();
  const initialOrderNumber = searchParams?.get('number') || '';
  const { formatPrice } = useLocale();

  const [orderNumber, setOrderNumber] = useState(initialOrderNumber);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [bookingData, setBookingData] = useState<TrackingData | null>(null);

  const handleTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBookingData(null);

    if (!orderNumber.trim()) {
      setError('Booking Number is required.');
      return;
    }

    setLoading(true);
    try {
      const data = await trackBooking(orderNumber.trim());
      if (data && typeof data === 'object') {
        const raw = data as any;
        const currentStatus = raw.status || 'pending';

        let timeline: any[] = [];
        if (raw.timeline && Array.isArray(raw.timeline)) {
          // Push completed events from backend history
          timeline = raw.timeline.map((evt: any) => ({
            status: evt.status,
            label: evt.label,
            timestamp: evt.at,
            type: evt.type || 'business',
            done: true,
          }));

          // Predict future business events to complete the progress bar
          const businessEvents = raw.timeline.filter((e: any) => (e.type || 'business') === 'business').map((e: any) => e.status);
          if (currentStatus !== 'cancelled') {
             for (const flowStep of STATUS_ORDER) {
                if (!businessEvents.includes(flowStep)) {
                   timeline.push({
                     status: flowStep,
                     label: STATUS_LABELS[flowStep] || flowStep,
                     timestamp: null,
                     type: 'business',
                     done: false
                   });
                }
             }
          }
        } else {
          // Fallback if backend does not use unified timeline
          const currentIdx = STATUS_ORDER.indexOf(currentStatus);
          timeline = STATUS_ORDER.map((s, i) => ({
            status: s,
            label: STATUS_LABELS[s] || s,
            timestamp: i <= currentIdx ? raw.createdAt : null,
            type: 'business',
            done: i <= currentIdx,
          }));
        }

        setBookingData({
          bookingNumber: raw.bookingNumber || orderNumber,
          status: currentStatus,
          trackingNumber: raw.trackingNumber,
          courierProvider: raw.courierProvider,
          courierStatus: raw.courierStatus,
          customerName: raw.deliveryName || raw.customer?.fullName || raw.customerName || 'Customer',
          deliveryAddress: raw.deliveryAddressLine1 || raw.deliveryAddress || raw.customer?.addressLine1 || '',
          items: raw.items?.map((item: any) => ({
            productName: item.productName || item.name || 'Product',
            colorName: item.colorName,
            startDate: item.startDate,
            endDate: item.endDate,
          })) || [],
          grandTotal: raw.grandTotal || 0,
          paidAmount: raw.totalPaid || raw.paidAmount || 0,
          createdAt: raw.createdAt || '',
          statusTimeline: timeline,
        });
      } else {
        setError('Booking not found. Please check your booking number.');
      }
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          'Could not find booking. Check your booking number and try again.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8 bg-gray-50 min-h-screen">
      <div className="mb-8">
        <Link
          href="/"
          className="text-sm font-medium text-gray-500 hover:text-black flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Store
        </Link>
      </div>

      <div className="bg-white p-8 shadow-sm border border-gray-100">
        <h1 className="font-display text-3xl font-bold tracking-tight text-gray-900 mb-2">
          Track Your Order
        </h1>
        <p className="text-gray-500 mb-8">
          Enter your booking number below to view the current status of your
          rental.
        </p>

        <form
          onSubmit={handleTrack}
          className="flex flex-col gap-4 sm:flex-row items-end"
        >
          <div className="w-full sm:flex-1">
            <label className="text-sm font-medium text-gray-700 mb-1 block">
              Booking Number
            </label>
            <input
              type="text"
              placeholder="e.g. ORD-2026-123"
              className="w-full rounded-none border border-gray-300 p-3 outline-none focus:border-black"
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value.toUpperCase())}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-black px-8 py-3 font-semibold uppercase tracking-wider text-white hover:bg-gray-800 transition-colors h-12"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Search className="h-4 w-4" /> Track
              </>
            )}
          </button>
        </form>
        {error && (
          <div className="flex items-center gap-2 text-red-600 text-sm mt-3">
            <AlertCircle className="h-4 w-4 flex-shrink-0" /> {error}
          </div>
        )}
      </div>

      {/* Results */}
      {bookingData && (
        <div className="mt-8 bg-white p-8 shadow-sm border border-gray-100 grid md:grid-cols-2 gap-12">
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-6 font-display">
              Status Timeline
            </h2>

            <div className="relative border-l-2 border-gray-200 ml-3 space-y-8 pb-4">
              {bookingData.statusTimeline.map((event, idx) => (
                <div key={idx} className={`relative ${event.type === 'courier' ? 'pl-8 opacity-90' : 'pl-6'}`}>
                  {/* Circle Marker */}
                  <div
                    className={`absolute ${
                      event.type === 'courier' 
                        ? '-left-[6px] top-1.5 h-2.5 w-2.5 bg-gray-500 border-white' 
                        : `-left-[9px] top-0 h-4 w-4 bg-${event.done ? 'black' : 'gray-300'}`
                    } rounded-full border-2 border-white`}
                  />
                  <div>
                    <h3
                      className={`${event.type === 'courier' ? 'text-sm font-medium text-gray-700' : 'font-bold'} ${
                        event.done ? (event.type === 'business' ? 'text-gray-900' : '') : 'text-gray-400'
                      }`}
                    >
                      {event.label}
                    </h3>
                    {event.done && event.timestamp && (
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(event.timestamp).toLocaleString(undefined, {
                          month: 'short', day: 'numeric',
                          hour: '2-digit', minute: '2-digit'
                        })}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <div className="bg-gray-50 p-6 border border-gray-100 h-fit">
              <h2 className="text-lg font-bold text-gray-900 mb-4 border-b pb-2">
                Order Details
              </h2>
            <ul className="text-sm text-gray-600 space-y-3 mb-6">
              <li>
                <strong className="text-gray-900 w-24 inline-block">
                  Order No:
                </strong>{' '}
                {bookingData.bookingNumber}
              </li>
              <li>
                <strong className="text-gray-900 w-24 inline-block">
                  Customer:
                </strong>{' '}
                {bookingData.customerName}
              </li>
              {bookingData.deliveryAddress && (
                <li className="flex">
                  <strong className="text-gray-900 w-24 shrink-0 inline-block">
                    Delivery:
                  </strong>
                  <span>{bookingData.deliveryAddress}</span>
                </li>
              )}
              {bookingData.grandTotal > 0 && (
                <li>
                  <strong className="text-gray-900 w-24 inline-block">
                    Total:
                  </strong>{' '}
                  {formatPrice(bookingData.grandTotal)}
                </li>
              )}
            </ul>

            {bookingData.items.length > 0 && (
              <>
                <h3 className="font-bold text-gray-900 text-sm mb-2">
                  Items Rented
                </h3>
                <div className="space-y-2 text-sm text-gray-600 bg-white p-3 border border-gray-200 shadow-sm">
                  {bookingData.items.map((item, i) => (
                    <div key={i} className="flex justify-between">
                      <span className="font-medium">
                        {item.productName}
                        {item.colorName && (
                          <span className="text-gray-400 font-normal">
                            {' '}
                            ({item.colorName})
                          </span>
                        )}
                      </span>
                      {item.startDate && item.endDate && (
                        <span className="text-xs">
                          {new Date(item.startDate).toLocaleDateString()} –{' '}
                          {new Date(item.endDate).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {bookingData.trackingNumber && bookingData.courierProvider && (
            <div className="bg-blue-50/50 p-6 border border-blue-100 shadow-sm h-fit">
              <div className="flex items-center gap-3 mb-4 border-b border-blue-200 pb-2">
                <Package className="h-5 w-5 text-blue-600" />
                <h2 className="text-lg font-bold text-gray-900">
                  Shipping Information
                </h2>
              </div>
              <ul className="text-sm text-gray-700 space-y-3 mb-6">
                <li className="flex justify-between items-center bg-white p-3 border border-blue-100 rounded-sm">
                  <span className="text-gray-500 font-medium tracking-wide text-xs uppercase">Tracking ID</span>
                  <strong className="font-mono text-blue-700">{bookingData.trackingNumber}</strong>
                </li>
                <li className="flex justify-between items-center bg-white p-3 border border-blue-100 rounded-sm">
                  <span className="text-gray-500 font-medium tracking-wide text-xs uppercase">Courier</span>
                  <span className="capitalize font-semibold text-gray-900">{bookingData.courierProvider}</span>
                </li>
              </ul>
              
              {bookingData.courierProvider.toLowerCase() === 'pathao' && (
                <a
                  href={`https://pathao.com/tracking/?consignment_id=${bookingData.trackingNumber}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white font-semibold py-3 px-4 hover:bg-blue-700 transition"
                >
                  Track on Pathao <Search className="h-4 w-4" />
                </a>
              )}
            </div>
          )}
        </div>
        </div>
      )}
    </div>
  );
}
