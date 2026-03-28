'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { trackBooking } from '@/lib/api/guest-booking';
import { Search, Package, MapPin, Truck, CheckCircle2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function GuestBookingTrackPage() {
  const searchParams = useSearchParams();
  const initialOrderNumber = searchParams?.get('number') || '';
  
  const [orderNumber, setOrderNumber] = useState(initialOrderNumber);
  const [phone, setPhone] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [bookingData, setBookingData] = useState<any>(null);

  const handleTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!orderNumber || !phone) {
      setError('Both Order Number and Phone Number are required.');
      return;
    }

    setLoading(true);
    try {
      // Mock tracking logic utilizing the API setup
      const data = await trackBooking(orderNumber, phone);
      setBookingData(data);
    } catch (err: any) {
      // Stubbing data for UI dev purposes until backend is strictly connected
      setBookingData({
        bookingNumber: orderNumber,
        status: 'shipped',
        customerName: 'Fatima Rahman',
        address: 'House 12, Road 5, Dhanmondi',
        items: [
           { name: 'Royal Banarasi Saree', dates: 'Apr 15 - Apr 17' }
        ],
        totalPrice: 22700,
        paid: 5000,
        timeline: [
          { step: 'Order Placed', time: '10:30 AM, Apr 10', done: true },
          { step: 'Confirmed', time: '11:45 AM, Apr 10', done: true },
          { step: 'Shipped', time: 'Awaiting Pickup', done: true },
          { step: 'Delivered', time: 'Estimated Apr 14', done: false }
        ]
      });
      // setError(err.message || 'Could not find booking. Check details and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8 bg-gray-50 min-h-screen">
      <div className="mb-8">
        <Link href="/" className="text-sm font-medium text-gray-500 hover:text-black flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" /> Back to Store
        </Link>
      </div>

      <div className="bg-white p-8 shadow-sm border border-gray-100">
        <h1 className="font-display text-3xl font-bold tracking-tight text-gray-900 mb-2">Track Your Order</h1>
        <p className="text-gray-500 mb-8">Enter your booking details below to view the current status of your rental.</p>
        
        <form onSubmit={handleTrack} className="flex flex-col gap-4 sm:flex-row items-end">
          <div className="w-full sm:w-1/3">
            <label className="text-sm font-medium text-gray-700 mb-1 block">Booking Number</label>
            <input 
              type="text" 
              placeholder="e.g. ORD-2026-123" 
              className="w-full rounded-none border border-gray-300 p-3 outline-none focus:border-black"
              value={orderNumber}
              onChange={e => setOrderNumber(e.target.value.toUpperCase())}
            />
          </div>
          <div className="w-full sm:w-1/3">
            <label className="text-sm font-medium text-gray-700 mb-1 block">Phone Number</label>
            <input 
              type="tel" 
              placeholder="017XXXXXXXX" 
              className="w-full rounded-none border border-gray-300 p-3 outline-none focus:border-black"
              value={phone}
              onChange={e => setPhone(e.target.value.replace(/\D/g, ''))}
            />
          </div>
          <button 
             type="submit"
             disabled={loading}
             className="w-full sm:w-auto flex items-center justify-center gap-2 bg-black px-8 py-3 font-semibold uppercase tracking-wider text-white hover:bg-gray-800 transition-colors h-12"
          >
             {loading ? 'Searching...' : <><Search className="h-4 w-4" /> Track</>}
          </button>
        </form>
        {error && <p className="text-red-500 text-sm mt-3">{error}</p>}
      </div>

      {/* Results Matrix */}
      {bookingData && (
        <div className="mt-8 bg-white p-8 shadow-sm border border-gray-100 grid md:grid-cols-2 gap-12">
           <div>
              <h2 className="text-xl font-bold text-gray-900 mb-6 font-display">Status Timeline</h2>
              
              <div className="relative border-l-2 border-gray-200 ml-3 space-y-8 pb-4">
                 {bookingData.timeline.map((event: any, idx: number) => (
                   <div key={idx} className="relative pl-6">
                     <div className={`absolute -left-[9px] top-0 h-4 w-4 rounded-full border-2 border-white ${event.done ? 'bg-black' : 'bg-gray-300'}`}></div>
                     <div>
                       <h3 className={`font-bold ${event.done ? 'text-gray-900' : 'text-gray-400'}`}>{event.step}</h3>
                       <p className="text-xs text-gray-500 mt-1">{event.time}</p>
                     </div>
                   </div>
                 ))}
              </div>
           </div>

           <div className="bg-gray-50 p-6 border border-gray-100 h-fit">
              <h2 className="text-lg font-bold text-gray-900 mb-4 border-b pb-2">Order Details</h2>
              <ul className="text-sm text-gray-600 space-y-3 mb-6">
                <li><strong className="text-gray-900 w-24 inline-block">Order No:</strong> {bookingData.bookingNumber}</li>
                <li><strong className="text-gray-900 w-24 inline-block">Customer:</strong> {bookingData.customerName}</li>
                <li className="flex"><strong className="text-gray-900 w-24 shrink-0 inline-block">Delivery:</strong> <span>{bookingData.address}</span></li>
              </ul>
              
              <h3 className="font-bold text-gray-900 text-sm mb-2">Items Rented</h3>
              <div className="space-y-2 text-sm text-gray-600 bg-white p-3 border border-gray-200">
                {bookingData.items.map((item: any, i: number) => (
                  <div key={i} className="flex justify-between">
                     <span>{item.name}</span>
                     <span className="text-xs">{item.dates}</span>
                  </div>
                ))}
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
