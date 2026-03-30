'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
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
import type { BookingStatus, BookingTimelineEvent, BookingItem, Payment, Booking, DamageLevel } from '../types';

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

  const customerName = booking.customer?.fullName || 'Unknown';
  const displayNumber = booking.bookingNumber || booking.id;

  // ── Build timeline events from booking timestamps ──────────────────────
  const timelineEvents: BookingTimelineEvent[] = [];
  let eventCounter = 0;

  const addTimelineEvent = (status: string, timestamp: string | null, note?: string) => {
    if (!timestamp) return;
    timelineEvents.push({
      id: String(++eventCounter),
      status: status as BookingStatus,
      timestamp,
      note,
    });
  };

  addTimelineEvent('pending', booking.createdAt, 'Booking created');
  addTimelineEvent('confirmed', booking.confirmedAt);
  addTimelineEvent('shipped', booking.shippedAt,
    booking.courierProvider
      ? `Via ${booking.courierProvider}${booking.trackingNumber ? ` — #${booking.trackingNumber}` : ''}`
      : undefined
  );
  addTimelineEvent('delivered', booking.deliveredAt);
  addTimelineEvent('returned', booking.returnedAt);
  addTimelineEvent('completed', booking.completedAt);
  if (booking.status === 'cancelled') {
    // For cancelled, use updatedAt as the cancel time since there's no cancelledAt field
    addTimelineEvent('cancelled', booking.updatedAt, booking.cancellationReason || undefined);
  }

  // ── Map items to the BookingItem shape ──────────────────────────────────
  const mappedItems: BookingItem[] = booking.items.map((item) => ({
    id: item.id,
    bookingId: booking.id,
    productId: item.productId,
    productName: item.productName,
    variantName: item.variantName || item.colorName || '',
    sizeName: item.sizeInfo || '',
    imageUrl: item.featuredImageUrl,
    startDate: item.startDate,
    endDate: item.endDate,
    days: item.rentalDays,
    rentalPrice: item.baseRental + item.extendedCost,
    cleaningFee: item.cleaningFee,
    backupSizeFee: item.backupSizeFee,
    depositAmount: item.depositAmount,
    lateFee: item.lateFee,
    itemTotal: item.itemTotal,
    status: 'pending' as const, // BookingItem-level status isn't tracked in DB; use booking status
    depositStatus: (item.depositStatus || 'pending') as BookingItem['depositStatus'],
    damageReport: item.damageReport ? {
      id: item.damageReport.id,
      bookingItemId: item.id,
      damageLevel: item.damageReport.damageLevel as DamageLevel,
      description: item.damageReport.description,
      estimatedRepairCost: item.damageReport.estimatedRepairCost ?? 0,
      deductionAmount: item.damageReport.deductionAmount,
      additionalCharge: item.damageReport.additionalCharge,
      photos: item.damageReport.photos,
      reportedBy: item.damageReport.reportedBy,
      createdAt: item.damageReport.createdAt,
    } : undefined,
  }));

  // ── Map payments ───────────────────────────────────────────────────────
  const mappedPayments: Payment[] = (booking.payments ?? []).map((p) => ({
    id: p.id,
    bookingId: booking.id,
    amount: p.amount,
    method: p.method as Payment['method'],
    status: (p.status || 'pending') as Payment['status'],
    transactionId: p.transactionId || undefined,
    recordedBy: p.recordedBy || undefined,
    notes: p.notes || undefined,
    createdAt: p.createdAt,
  }));

  // ── Build full delivery address string ─────────────────────────────────
  const addressParts = [
    booking.deliveryAddressLine1,
    booking.deliveryAddressLine2,
  ].filter(Boolean);

  const extraParts: string[] = [];
  if (booking.deliveryExtra) {
    if (booking.deliveryExtra.area) extraParts.push(booking.deliveryExtra.area);
    if (booking.deliveryExtra.thana) extraParts.push(booking.deliveryExtra.thana);
    if (booking.deliveryExtra.district) extraParts.push(booking.deliveryExtra.district);
  }
  if (booking.deliveryCity) extraParts.push(booking.deliveryCity);
  if (booking.deliveryState) extraParts.push(booking.deliveryState);
  if (booking.deliveryPostalCode) extraParts.push(booking.deliveryPostalCode);

  const fullAddress = [...addressParts, extraParts.join(', ')].filter(Boolean).join('\n');

  // ── Build the Booking object for PriceBreakdown ────────────────────────
  const bookingForBreakdown: Booking = {
    id: booking.id,
    orderNumber: displayNumber,
    createdAt: booking.createdAt,
    customer: {
      id: booking.customer.id,
      name: customerName,
      phone: booking.customer.phone,
      address: fullAddress,
      email: booking.customer.email || undefined,
      totalOrders: booking.customer.totalBookings ?? 0,
    },
    items: mappedItems,
    payments: mappedPayments,
    timeline: timelineEvents,
    status: booking.status as BookingStatus,
    paymentStatus: (booking.paymentStatus || 'unpaid') as Booking['paymentStatus'],
    paymentMethod: booking.paymentMethod || '',
    subtotal: booking.subtotal,
    cleaningFeeTotal: booking.items.reduce((s, i) => s + i.cleaningFee, 0),
    backupSizeFeeTotal: booking.items.reduce((s, i) => s + i.backupSizeFee, 0),
    shippingFee: booking.shippingFee,
    depositTotal: booking.totalDeposit,
    lateFeeTotal: booking.items.reduce((s, i) => s + i.lateFee, 0),
    discount: 0,
    grandTotal: booking.grandTotal,
    amountPaid: booking.totalPaid,
    balance: booking.grandTotal - booking.totalPaid,
    notes: booking.customerNotes || booking.internalNotes || undefined,
    courierName: booking.courierProvider || undefined,
    trackingNumber: booking.trackingNumber || undefined,
  };

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
          <Button variant="outline" onClick={() => toast.info('Invoice generation coming soon')}>
            <FileText className="h-4 w-4 mr-2" />
            Invoice
          </Button>
          <Button variant="outline" onClick={() => toast.info('Export coming soon')}>
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
                {booking.customer.altPhone && (
                  <div className="text-muted-foreground text-sm">Alt: {booking.customer.altPhone}</div>
                )}
                {booking.customer.email && <div className="text-muted-foreground">{booking.customer.email}</div>}
                {booking.customer.tags?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {booking.customer.tags.map((t) => (
                      <span key={t.id} className="inline-flex items-center rounded-full px-2 py-0.5 text-xs bg-secondary text-secondary-foreground">
                        {t.tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <div className="font-medium mb-1">Delivery Address</div>
                <div className="text-muted-foreground text-sm whitespace-pre-line">{fullAddress || 'No address provided'}</div>
                {booking.deliveryAltPhone && (
                  <div className="text-muted-foreground text-sm mt-1">Alt phone: {booking.deliveryAltPhone}</div>
                )}
              </div>
            </CardContent>
          </Card>

          <div>
            <h2 className="text-lg font-semibold tracking-tight mb-4">Rented Items</h2>
            <BookingItems items={mappedItems} bookingId={booking.id} bookingStatus={booking.status} />
          </div>
          
          <div className="grid sm:grid-cols-2 gap-6">
            <PaymentHistory payments={mappedPayments} bookingId={booking.id} balanceDue={booking.grandTotal - booking.totalPaid} />
            <PriceBreakdown booking={bookingForBreakdown} />
          </div>

          {/* Notes section */}
          {(booking.customerNotes || booking.internalNotes) && (
            <Card className="shadow-none border">
              <CardHeader className="pb-3 bg-muted/30">
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Notes
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                {booking.customerNotes && (
                  <div>
                    <div className="text-xs font-medium text-muted-foreground mb-1">Customer Notes</div>
                    <div className="text-sm bg-muted/40 p-3 rounded-md">{booking.customerNotes}</div>
                  </div>
                )}
                {booking.internalNotes && (
                  <div>
                    <div className="text-xs font-medium text-muted-foreground mb-1">Internal Notes</div>
                    <div className="text-sm bg-muted/40 p-3 rounded-md whitespace-pre-line">{booking.internalNotes}</div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar Content: Right Column (Takes up 1/3) */}
        <div className="md:col-span-1 space-y-6">
          <StatusTimeline events={timelineEvents} />
        </div>
      </div>
    </div>
  );
}
