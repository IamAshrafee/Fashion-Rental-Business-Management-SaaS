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
import { DeliveryTrackingCard } from './components/delivery-tracking-card';
import { InventoryAssignments } from './components/inventory-assignments';
import { BookingWorkflowCard } from './components/booking-workflow-card';
import { bookingApi } from '@/lib/api/bookings';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { format, parseISO, differenceInDays } from 'date-fns';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { toast } from 'sonner';
import type { BookingStatus, BookingTimelineEvent, BookingItem, Payment, Booking, DamageLevel } from '../types';
import { formatMinorMoney } from '@/lib/money';

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
    refetchInterval: 30_000,
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

  const timelineEvents: BookingTimelineEvent[] = booking.operationalTimeline.events.map((event) => ({
    id: event.id,
    status: event.code.toLowerCase(),
    label: event.label,
    timestamp: event.occurredAt,
    user: event.actor?.fullName,
    note: [event.reason, event.amountMinor !== null ? formatMinorMoney(event.amountMinor) : null]
      .filter(Boolean)
      .join(' · ') || undefined,
    type: event.category === 'COURIER'
      ? 'courier'
      : event.category === 'COMMERCIAL'
        ? 'payment'
        : event.category === 'RETURN'
          ? 'return'
          : event.category === 'FULFILLMENT'
            ? 'operation'
            : 'business',
  }));

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
    fulfillmentAdjustment: item.fulfillmentAdjustment,
    requiresExactDamageIssue: (item.fulfillmentRequirements?.length ?? 0) > 0,
    stockUnitIssues: item.stockUnitIssues,
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
    depositSettlement: item.depositSettlement ?? undefined,
  }));

  // ── Map payments ───────────────────────────────────────────────────────
  const mappedPayments: Payment[] = (booking.payments ?? []).map((p) => ({
    id: p.id,
    bookingId: booking.id,
    amount: p.amount,
    rentalAmount: p.rentalAmount,
    depositAmount: p.depositAmount,
    method: p.method,
    status: p.status || 'pending',
    transactionId: p.transactionId,
    recordedBy: p.recorder?.fullName ?? null,
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
      phone: booking.customer.primaryPhone ?? booking.deliveryPhone,
      email: booking.customer.primaryEmail || undefined,
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
            <span>{customerName}</span>
            <span aria-hidden="true">·</span>
            <span>Placed {format(parseISO(booking.createdAt), 'MMM d, yyyy h:mm a')}</span>
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

      <BookingWorkflowCard
        status={booking.status as BookingStatus}
        blockers={booking.operations.blockers}
      />

      <OrderActions
        bookingId={booking.id}
        status={booking.status as BookingStatus}
        returnMethod={booking.returnMethod}
        blockers={booking.operations.blockers}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Main Content: Left Column (Takes up 2/3) */}
        <div className="md:col-span-2 space-y-6">
          {booking.rentalStartDate && booking.rentalEndDate && (
            <Card id="rental-plan" className="scroll-mt-6 shadow-none border">
              <CardHeader className="pb-3 bg-muted/30">
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Rental & Fulfillment Plan
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 pt-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-xs text-muted-foreground">Rental dates</p>
                  <p className="text-sm font-medium">{format(parseISO(booking.rentalStartDate), 'MMM d, yyyy')} → {format(parseISO(booking.rentalEndDate), 'MMM d, yyyy')}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Fulfillment location</p>
                  {booking.operations.fulfillmentLocations.state === 'SINGLE' ? (
                    <>
                      <p className="text-sm font-medium">{booking.operations.fulfillmentLocations.locations[0]?.name}</p>
                      <p className="text-xs text-muted-foreground">{booking.operations.fulfillmentLocations.locations[0]?.code}</p>
                    </>
                  ) : booking.operations.fulfillmentLocations.state === 'MULTIPLE' ? (
                    <>
                      <p className="text-sm font-medium">Multiple fulfillment locations</p>
                      <p className="text-xs text-muted-foreground">
                        {booking.operations.fulfillmentLocations.locations.map((location) => location.name).join(', ')}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm font-medium text-amber-700">Needs fulfillment review</p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Handover</p>
                  <p className="text-sm font-medium">{booking.handoverMethod === 'CUSTOMER_PICKUP' ? 'Customer pickup' : 'Delivery'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Return</p>
                  <p className="text-sm font-medium">{booking.returnMethod === 'CUSTOMER_RETURN' ? 'Customer return' : 'Business pickup'}</p>
                </div>
              </CardContent>
              {!!booking.fulfillmentExtensions?.length && (
                <CardContent className="border-t pt-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Extension history</p>
                  <div className="space-y-2">
                    {booking.fulfillmentExtensions.map((extension) => (
                      <div key={extension.id} className="rounded-md border p-3 text-sm">
                        <p className="font-medium">
                          {format(parseISO(extension.previousEndDate), 'MMM d, yyyy')} → {format(parseISO(extension.rentalEndDate), 'MMM d, yyyy')} · {formatMinorMoney(extension.extensionCharge)}
                        </p>
                        <p className="text-muted-foreground">{extension.reason}</p>
                        <p className="text-xs text-muted-foreground">Approval: {extension.approvalEvidence} · {extension.actor.fullName} · {format(parseISO(extension.createdAt), 'MMM d, yyyy h:mm a')}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          )}
          <section id="rental-items" className="scroll-mt-6">
            <div className="mb-4">
              <h2 className="text-lg font-semibold tracking-tight">Rental items</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                The exact products, dates, rental charges, and deposit position for this booking.
              </p>
            </div>
            <BookingItems items={mappedItems} bookingId={booking.id} bookingStatus={booking.status} />
          </section>

          <Card id="customer-delivery" className="scroll-mt-6 shadow-none border">
            <CardHeader className="pb-3 bg-muted/30">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Customer and delivery details
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
                <div className="text-muted-foreground">{booking.customer.primaryPhone ?? 'No primary phone'}</div>
                {booking.customer.primaryEmail && <div className="text-muted-foreground">{booking.customer.primaryEmail}</div>}
                {booking.customer.tags?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {booking.customer.tags.map((t) => (
                      <span key={t.id} className="inline-flex items-center rounded-full px-2 py-0.5 text-xs bg-secondary text-secondary-foreground">
                        {t.name}
                      </span>
                    ))}
                  </div>
                )}
                <div className="text-xs text-muted-foreground mt-2">
                  {booking.customer.totalBookings} booking{booking.customer.totalBookings !== 1 ? 's' : ''} · {formatMinorMoney(booking.customer.totalSpent ?? 0)} spent
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

          <DeliveryTrackingCard booking={booking} />

          {booking.status !== 'cancelled' && (
            <InventoryAssignments bookingId={booking.id} bookingStatus={booking.status} />
          )}
          
          <section id="financials" className="scroll-mt-6">
            <div className="mb-4">
              <h2 className="text-lg font-semibold tracking-tight">Payments and charges</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Record, verify, and reconcile money separately from the physical rental workflow.
              </p>
            </div>
          <div className="grid gap-6 sm:grid-cols-2">
            <PaymentHistory
              payments={mappedPayments}
              bookingId={booking.id}
              balanceDue={booking.grandTotal - booking.totalPaid}
              depositBalance={Math.max(0, booking.totalDeposit - mappedPayments.filter((payment) => payment.status === 'verified').reduce((sum, payment) => sum + payment.depositAmount, 0))}
            />
            <PriceBreakdown booking={bookingForBreakdown} />
          </div>
          </section>

          <Card id="booking-notes" className="scroll-mt-6 shadow-none border">
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

        <aside id="booking-history" className="scroll-mt-6 md:col-span-1">
          <StatusTimeline events={timelineEvents} truncated={booking.operationalTimeline.truncated} />
        </aside>
      </div>
    </div>
  );
}
