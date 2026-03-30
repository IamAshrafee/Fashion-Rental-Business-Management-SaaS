'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Loader2, Copy, Check, PlusCircle, AlertTriangle, Clock } from 'lucide-react';
import Link from 'next/link';
import { BookingStatusBadge } from '../components/bookings-table';
import { OrderActions } from './components/order-actions';
import { BookingItems } from './components/booking-items';
import { PriceBreakdown } from './components/price-breakdown';
import { PaymentHistory } from './components/payment-history';
import { StatusTimeline } from './components/status-timeline';
import { bookingApi } from '@/lib/api/bookings';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { format, parseISO, differenceInDays } from 'date-fns';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { toast } from 'sonner';
import type { BookingStatus, BookingTimelineEvent, BookingItem, Payment, Booking, DamageLevel } from '../types';

// ── Copy-to-clipboard hook ───────────────────────────────────────────────────
function useCopyToClipboard() {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copy = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  };

  return { copiedField, copy };
}

export default function BookingDetailPage() {
  const params = useParams();
  const bookingId = params.id as string;
  const queryClient = useQueryClient();
  const { copiedField, copy } = useCopyToClipboard();

  // Add Note state (Fix #4)
  const [noteText, setNoteText] = useState('');
  const [showNoteInput, setShowNoteInput] = useState(false);

  const { data: booking, isLoading, isError, error } = useQuery({
    queryKey: ['bookings', 'detail', bookingId],
    queryFn: () => bookingApi.getById(bookingId),
    enabled: !!bookingId,
  });

  // Fix #4: Add Note mutation
  const addNoteMutation = useMutation({
    mutationFn: () => bookingApi.addNote(bookingId, noteText.trim()),
    onSuccess: () => {
      toast.success('Note added');
      setNoteText('');
      setShowNoteInput(false);
      queryClient.invalidateQueries({ queryKey: ['bookings', 'detail', bookingId] });
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to add note'),
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

  // Fix #1: Use cancelledAt instead of updatedAt for cancelled events
  if (booking.status === 'cancelled') {
    addTimelineEvent('cancelled', booking.cancelledAt || booking.updatedAt, booking.cancellationReason || undefined);
  }

  // Fix #3: Synthetic overdue timeline event
  if (booking.status === 'overdue') {
    addTimelineEvent('overdue', booking.updatedAt, 'Rental period has exceeded the return date');
  }

  // ── Map items — types are now aligned with backend, minimal mapping needed ──
  const mappedItems: BookingItem[] = booking.items.map((item) => ({
    id: item.id,
    bookingId: booking.id,
    productId: item.productId,
    productName: item.productName,
    variantName: item.variantName || item.colorName || '',
    sizeInfo: item.sizeInfo || null,
    featuredImageUrl: item.featuredImageUrl,
    startDate: item.startDate,
    endDate: item.endDate,
    rentalDays: item.rentalDays,
    baseRental: item.baseRental,
    extendedCost: item.extendedCost,
    cleaningFee: item.cleaningFee,
    backupSizeFee: item.backupSizeFee,
    depositAmount: item.depositAmount,
    lateFee: item.lateFee,
    itemTotal: item.itemTotal,
    depositStatus: (item.depositStatus || 'pending') as BookingItem['depositStatus'],
    damageReport: item.damageReport ? {
      id: item.damageReport.id,
      bookingItemId: item.id,
      damageLevel: item.damageReport.damageLevel as DamageLevel,
      description: item.damageReport.description,
      estimatedRepairCost: item.damageReport.estimatedRepairCost ?? null,
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
    method: p.method,
    status: p.status || 'pending',
    transactionId: p.transactionId,
    recordedBy: p.recordedBy,
    notes: p.notes,
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
    bookingNumber: displayNumber,
    createdAt: booking.createdAt,
    customer: {
      id: booking.customer.id,
      fullName: customerName,
      phone: booking.customer.phone,
      email: booking.customer.email || undefined,
      totalBookings: booking.customer.totalBookings ?? 0,
    },
    items: mappedItems,
    payments: mappedPayments,
    timeline: timelineEvents,
    status: booking.status as BookingStatus,
    paymentStatus: (booking.paymentStatus || 'unpaid') as Booking['paymentStatus'],
    paymentMethod: booking.paymentMethod || '',
    subtotal: booking.subtotal,
    totalFees: booking.totalFees,
    shippingFee: booking.shippingFee,
    totalDeposit: booking.totalDeposit,
    grandTotal: booking.grandTotal,
    totalPaid: booking.totalPaid,
    balance: booking.grandTotal - booking.totalPaid,
    notes: booking.customerNotes || booking.internalNotes || undefined,
    courierProvider: booking.courierProvider || undefined,
    trackingNumber: booking.trackingNumber || undefined,
  };

  // Fix #9: Compute urgency info
  const isOverdue = booking.status === 'overdue';
  const isDelivered = booking.status === 'delivered';
  const latestEndDate = mappedItems.length > 0
    ? mappedItems.reduce((latest, item) => {
        const d = new Date(item.endDate);
        return d > latest ? d : latest;
      }, new Date(0))
    : null;
  const daysUntilReturn = latestEndDate ? differenceInDays(latestEndDate, new Date()) : null;


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
            {/* Fix #6: Copy booking number */}
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
              {displayNumber}
              <button
                type="button"
                onClick={() => copy(displayNumber, 'bookingNumber')}
                className="inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-muted transition-colors"
                title="Copy booking number"
              >
                {copiedField === 'bookingNumber' ? (
                  <Check className="h-3.5 w-3.5 text-green-600" />
                ) : (
                  <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </button>
              <BookingStatusBadge status={booking.status as BookingStatus} />
            </h1>
          </div>
          <p className="text-muted-foreground ml-10 flex items-center gap-3">
            <span>Placed on {format(parseISO(booking.createdAt), 'MMM d, yyyy h:mm a')}</span>
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Invoice & Export will be added once PDF generation is implemented */}
        </div>
      </div>

      {/* Fix #9: Urgency banner for overdue or near-due bookings */}
      {isOverdue && (
        <Alert variant="destructive" className="border-red-300 bg-red-50 dark:bg-red-950/30">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Overdue Booking</AlertTitle>
          <AlertDescription>
            This rental has exceeded its return date. Please contact the customer to arrange return.
          </AlertDescription>
        </Alert>
      )}
      {isDelivered && daysUntilReturn !== null && daysUntilReturn <= 2 && daysUntilReturn >= 0 && (
        <Alert className="border-amber-300 bg-amber-50 dark:bg-amber-950/30">
          <Clock className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-800 dark:text-amber-400">Return Due Soon</AlertTitle>
          <AlertDescription className="text-amber-700 dark:text-amber-400">
            {daysUntilReturn === 0
              ? 'Return is due today.'
              : `Return is due in ${daysUntilReturn} day${daysUntilReturn !== 1 ? 's' : ''}.`}
          </AlertDescription>
        </Alert>
      )}

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
                {/* Fix #5: Customer name links to customer detail */}
                <Link
                  href={`/dashboard/customers/${booking.customerId}`}
                  className="font-semibold text-lg text-primary hover:underline"
                >
                  {customerName}
                </Link>
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
                <div className="text-xs text-muted-foreground mt-2">
                  {booking.customer.totalBookings} booking{booking.customer.totalBookings !== 1 ? 's' : ''} · ৳{booking.customer.totalSpent?.toLocaleString() ?? 0} spent
                </div>
              </div>
              <div>
                {/* Fix #7: Show deliveryName + deliveryPhone */}
                <div className="font-medium mb-1">Delivery Contact</div>
                <div className="text-sm">
                  <span className="font-medium">{booking.deliveryName}</span>
                  <span className="text-muted-foreground"> · {booking.deliveryPhone}</span>
                </div>
                {booking.deliveryAltPhone && (
                  <div className="text-muted-foreground text-sm">Alt: {booking.deliveryAltPhone}</div>
                )}

                <div className="font-medium mb-1 mt-3">Delivery Address</div>
                <div className="text-muted-foreground text-sm whitespace-pre-line">{fullAddress || 'No address provided'}</div>

                {/* Fix #6: Copy tracking number if exists */}
                {booking.trackingNumber && (
                  <div className="mt-3 flex items-center gap-2">
                    <div className="text-sm">
                      <span className="text-muted-foreground">Tracking: </span>
                      <span className="font-mono font-medium">{booking.trackingNumber}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => copy(booking.trackingNumber!, 'tracking')}
                      className="inline-flex items-center justify-center h-6 w-6 rounded hover:bg-muted transition-colors"
                      title="Copy tracking number"
                    >
                      {copiedField === 'tracking' ? (
                        <Check className="h-3 w-3 text-green-600" />
                      ) : (
                        <Copy className="h-3 w-3 text-muted-foreground" />
                      )}
                    </button>
                  </div>
                )}
                {booking.courierProvider && (
                  <div className="text-xs text-muted-foreground mt-1">
                    Courier: <span className="capitalize">{booking.courierProvider.replace(/_/g, ' ')}</span>
                  </div>
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

          {/* Fix #4: Notes section — always visible with Add Note button */}
          <Card className="shadow-none border">
            <CardHeader className="pb-3 bg-muted/30 flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Notes
              </CardTitle>
              {!showNoteInput && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8"
                  onClick={() => setShowNoteInput(true)}
                >
                  <PlusCircle className="mr-2 h-4 w-4" /> Add Note
                </Button>
              )}
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              {/* Existing notes */}
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
              {!booking.customerNotes && !booking.internalNotes && !showNoteInput && (
                <p className="text-sm text-muted-foreground text-center py-2">No notes yet.</p>
              )}

              {/* Add Note form */}
              {showNoteInput && (
                <div className="space-y-2 border border-dashed rounded-md p-3">
                  <Textarea
                    placeholder="Add an internal note..."
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    rows={3}
                    className="resize-none"
                    autoFocus
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { setShowNoteInput(false); setNoteText(''); }}
                      disabled={addNoteMutation.isPending}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => addNoteMutation.mutate()}
                      disabled={addNoteMutation.isPending || !noteText.trim()}
                    >
                      {addNoteMutation.isPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                      Save Note
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Fix #11: Sidebar — Timeline + Quick Info */}
        <div className="md:col-span-1 space-y-6">
          <StatusTimeline events={timelineEvents} />

          {/* Quick info card */}
          <Card className="shadow-none border">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Quick Info
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <BookingStatusBadge status={booking.status as BookingStatus} />
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Grand Total</span>
                <span className="font-semibold">৳{booking.grandTotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Paid</span>
                <span className="font-medium text-green-600">৳{booking.totalPaid.toLocaleString()}</span>
              </div>
              {booking.grandTotal - booking.totalPaid > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Balance Due</span>
                  <span className="font-semibold text-red-600">৳{(booking.grandTotal - booking.totalPaid).toLocaleString()}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Items</span>
                <span className="font-medium">{mappedItems.length}</span>
              </div>
              {latestEndDate && !['completed', 'cancelled'].includes(booking.status) && (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Return By</span>
                    <span className="font-medium">{format(latestEndDate, 'MMM d, yyyy')}</span>
                  </div>
                  {daysUntilReturn !== null && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Days Remaining</span>
                      <span className={`font-semibold ${daysUntilReturn < 0 ? 'text-red-600' : daysUntilReturn <= 2 ? 'text-amber-600' : 'text-green-600'}`}>
                        {daysUntilReturn < 0 ? `${Math.abs(daysUntilReturn)} days overdue` : `${daysUntilReturn} days`}
                      </span>
                    </div>
                  )}
                </>
              )}
              {booking.cancellationReason && (
                <>
                  <Separator />
                  <div>
                    <span className="text-muted-foreground text-xs block mb-1">Cancellation Reason</span>
                    <span className="text-sm italic">&quot;{booking.cancellationReason}&quot;</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
