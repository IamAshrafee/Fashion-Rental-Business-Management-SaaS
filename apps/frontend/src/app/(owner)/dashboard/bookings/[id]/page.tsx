import { Button } from '@/components/ui/button';
import { ChevronLeft, FileText, Download } from 'lucide-react';
import Link from 'next/link';
import { BookingStatusBadge } from '../components/bookings-table';
import { OrderActions } from './components/order-actions';
import { BookingItems } from './components/booking-items';
import { PriceBreakdown } from './components/price-breakdown';
import { PaymentHistory } from './components/payment-history';
import { StatusTimeline } from './components/status-timeline';
import { MOCK_BOOKINGS } from '../mocks';
import { notFound } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format, parseISO } from 'date-fns';

export async function generateMetadata({ params: _params }: { params: { id: string } }) {
  return {
    title: `Booking | ClosetRent`,
  };
}

export default function BookingDetailPage({ params }: { params: { id: string } }) {
  const booking = MOCK_BOOKINGS.find(b => b.id === params.id) || MOCK_BOOKINGS[0];
  
  if (!booking) {
    notFound();
  }

  return (
    <div className="space-y-6">
      {/* Header Area */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild className="-ml-2 h-8 w-8">
              <Link href="/dashboard/bookings">
                <ChevronLeft className="h-5 w-5" />
                <span className="sr-only">Back to bookings</span>
              </Link>
            </Button>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
              {booking.orderNumber}
              <BookingStatusBadge status={booking.status} />
            </h1>
          </div>
          <p className="text-muted-foreground ml-10 flex items-center gap-3">
            <span>Placed on {format(parseISO(booking.createdAt), 'MMM d, yyyy h:mm a')}</span>
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline">
            <FileText className="h-4 w-4 mr-2" />
            Invoice
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      <OrderActions status={booking.status} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Main Content: Left Column (Takes up 2/3) */}
        <div className="md:col-span-2 space-y-6">
          <Card className="shadow-none border">
            <CardHeader className="pb-3 bg-muted/30">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Customer Information
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 grid sm:grid-cols-2 gap-4">
              <div>
                <div className="font-semibold text-lg">{booking.customer.name}</div>
                <div className="text-muted-foreground">{booking.customer.phone}</div>
                {booking.customer.email && <div className="text-muted-foreground">{booking.customer.email}</div>}
              </div>
              <div>
                <div className="font-medium">Delivery Address</div>
                <div className="text-muted-foreground">{booking.customer.address}</div>
                <div className="mt-2 text-xs bg-muted inline-block px-2 py-1 rounded text-muted-foreground">
                  History: {booking.customer.totalOrders} total orders
                </div>
              </div>
            </CardContent>
          </Card>

          {booking.notes && (
             <Card className="shadow-none border bg-blue-50/50 border-blue-100">
               <CardContent className="p-4 pt-4 text-sm text-blue-900">
                 <strong className="block mb-1 text-blue-950 font-semibold">Order Notes:</strong>
                 {booking.notes}
               </CardContent>
             </Card>
          )}

          <div>
            <h2 className="text-lg font-semibold tracking-tight mb-4">Rented Items</h2>
            <BookingItems items={booking.items} />
          </div>
          
          <div className="grid sm:grid-cols-2 gap-6">
            <PaymentHistory payments={booking.payments} />
            <PriceBreakdown booking={booking} />
          </div>

        </div>

        {/* Sidebar Content: Right Column (Takes up 1/3) */}
        <div className="md:col-span-1 space-y-6">
          <StatusTimeline events={booking.timeline} />
          
          {booking.courierName && (
            <Card className="shadow-none border">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Fulfillment Logistics
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-2">
                <div className="text-sm">
                  <span className="text-muted-foreground">Courier: </span>
                  <span className="font-medium">{booking.courierName}</span>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">Tracking ID: </span>
                  <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-xs">{booking.trackingNumber}</span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
