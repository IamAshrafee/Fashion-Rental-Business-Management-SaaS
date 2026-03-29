'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { ChevronLeft, FileText, Download, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { BookingStatusBadge } from '../components/bookings-table';
import { OrderActions } from './components/order-actions';
import { BookingItems } from './components/booking-items';
import { PriceBreakdown } from './components/price-breakdown';
import { PaymentHistory } from './components/payment-history';
import { StatusTimeline } from './components/status-timeline';
import { bookingApi } from '@/lib/api/bookings';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format, parseISO } from 'date-fns';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { BookingStatus } from '../types';

export default function BookingDetailPage() {
  const params = useParams();
  const bookingId = params.id as string;

  const { data: booking, isLoading, isError, error } = useQuery({
    queryKey: ['bookings', 'detail', bookingId],
    queryFn: () => bookingApi.getById(bookingId),
    enabled: !!bookingId,
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
      </div>
    );
  }

  if (isError || !booking) {
    return (
      <Alert variant="destructive" className="m-6">
        <AlertDescription>
          Failed to load booking. {(error as Error)?.message || 'Please try again.'}
        </AlertDescription>
      </Alert>
    );
  }

  const customerName = booking.customer.fullName || 'Unknown';
  const displayNumber = booking.bookingNumber || booking.id;

  // Map the API items to the shape BookingItems expects
  const mappedItems = booking.items.map((item) => ({
    id: item.id,
    bookingId: booking.id,
    productId: '',
    productName: item.productName,
    variantName: item.colorName || '',
    sizeName: '',
    imageUrl: item.featuredImageUrl,
    startDate: item.startDate,
    endDate: item.endDate,
    days: item.rentalDays,
    rentalPrice: item.itemTotal,
    cleaningFee: 0,
    backupSizeFee: 0,
    depositAmount: 0,
    lateFee: 0,
    itemTotal: item.itemTotal,
    status: 'pending' as const,
    depositStatus: 'pending' as const,
  }));

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
              {displayNumber}
              <BookingStatusBadge status={booking.status as BookingStatus} />
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

      <OrderActions bookingId={booking.id} status={booking.status as BookingStatus} />

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
                <div className="font-semibold text-lg">{customerName}</div>
                <div className="text-muted-foreground">{booking.customer.phone}</div>
                {booking.customer.email && <div className="text-muted-foreground">{booking.customer.email}</div>}
              </div>
              <div>
                <div className="font-medium">Delivery</div>
                <div className="text-muted-foreground">{booking.deliveryName || 'No address provided'}</div>
              </div>
            </CardContent>
          </Card>

          <div>
            <h2 className="text-lg font-semibold tracking-tight mb-4">Rented Items</h2>
            <BookingItems items={mappedItems} />
          </div>
          
          <div className="grid sm:grid-cols-2 gap-6">
            <PaymentHistory payments={[]} />
            <PriceBreakdown booking={{
              id: booking.id,
              orderNumber: displayNumber,
              createdAt: booking.createdAt,
              customer: { id: booking.customer.id, name: customerName, phone: booking.customer.phone, address: booking.deliveryName || '', totalOrders: 0 },
              items: mappedItems,
              payments: [],
              timeline: [],
              status: booking.status as BookingStatus,
              paymentStatus: (booking.paymentStatus || 'unpaid') as 'unpaid' | 'partially_paid' | 'paid' | 'refunded',
              paymentMethod: '',
              subtotal: booking.grandTotal,
              cleaningFeeTotal: 0,
              backupSizeFeeTotal: 0,
              shippingFee: 0,
              depositTotal: 0,
              lateFeeTotal: 0,
              discount: 0,
              grandTotal: booking.grandTotal,
              amountPaid: 0,
              balance: booking.grandTotal,
            }} />
          </div>

        </div>

        {/* Sidebar Content: Right Column (Takes up 1/3) */}
        <div className="md:col-span-1 space-y-6">
          <StatusTimeline events={[]} />
        </div>
      </div>
    </div>
  );
}
