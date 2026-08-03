'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CalendarDays, Package, RotateCcw, Search } from 'lucide-react';
import type { PaginationMeta } from '@closetrent/types';
import type { BookingListItem, BookingListQuery } from '@/lib/api/bookings';
import type { BookingStatus } from '../types';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { OwnerListEmpty, OwnerListPagination } from '@/components/owner/workspace';

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  const styles: Record<BookingStatus, string> = {
    pending: 'border-amber-200 bg-amber-50 text-amber-800',
    confirmed: 'border-blue-200 bg-blue-50 text-blue-800',
    delivered: 'border-teal-200 bg-teal-50 text-teal-800',
    overdue: 'border-red-200 bg-red-50 font-semibold text-red-800',
    returned: 'border-purple-200 bg-purple-50 text-purple-800',
    inspected: 'border-orange-200 bg-orange-50 text-orange-800',
    completed: 'border-green-200 bg-green-50 text-green-800',
    cancelled: 'border-gray-200 bg-gray-50 text-gray-700',
  };
  return <Badge variant="outline" className={cn('shadow-none', styles[status])}>{status.charAt(0).toUpperCase() + status.slice(1)}</Badge>;
}

const queues: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'REVIEW', label: 'Review' },
  { value: 'ASSIGNMENT', label: 'Assign items' },
  { value: 'HANDOFF', label: 'Prepare / handoff' },
  { value: 'ACTIVE', label: 'Out with customer' },
  { value: 'RETURN_INSPECTION', label: 'Return / inspect' },
  { value: 'OVERDUE', label: 'Overdue' },
  { value: 'CLOSED', label: 'Closed' },
];

const nextAction: Record<BookingListItem['operations']['nextAction'], string> = {
  REVIEW: 'Review booking',
  ASSIGN_ITEMS: 'Assign physical items',
  PREPARE_HANDOFF: 'Prepare handoff',
  RECEIVE_RETURN: 'Receive return',
  INSPECT: 'Inspect returned items',
  SETTLE: 'Settle and complete',
  NONE: 'View booking',
};

const money = (amount: number) => new Intl.NumberFormat('en-BD', { style: 'currency', currency: 'BDT', maximumFractionDigits: 2 }).format(amount / 100);
const shortDate = (value: string | null) => value ? new Intl.DateTimeFormat('en-BD', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value)) : '—';

interface BookingsDataTableProps {
  data: BookingListItem[];
  meta: PaginationMeta;
  query: BookingListQuery;
  isPending: boolean;
  onChange: (values: { [Key in keyof BookingListQuery]?: BookingListQuery[Key] | null }, resetPage?: boolean) => void;
  onClear: () => void;
}

export function BookingsDataTable({ data, meta, query, isPending, onChange, onClear }: BookingsDataTableProps) {
  const [search, setSearch] = useState(query.search ?? '');
  const debouncedSearch = useDebouncedValue(search, 350);
  useEffect(() => setSearch(query.search ?? ''), [query.search]);
  useEffect(() => { if (debouncedSearch !== (query.search ?? '')) onChange({ search: debouncedSearch || null }); }, [debouncedSearch, onChange, query.search]);
  const hasFilters = Boolean(query.search || query.queue || query.paymentStatus || query.itemDateFrom || query.itemDateTo || query.sort !== 'createdAt' || query.order !== 'desc');

  return <div className="space-y-4">
    <Card><CardContent className="space-y-4 p-4">
      <div className="grid gap-3 lg:grid-cols-[minmax(16rem,1fr)_repeat(2,minmax(10rem,auto))]">
        <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Booking number, customer, or phone" className="pl-9" /></div>
        <Select value={query.paymentStatus ?? 'all'} onValueChange={(value) => onChange({ paymentStatus: value === 'all' ? null : value })}><SelectTrigger><SelectValue placeholder="All payments" /></SelectTrigger><SelectContent><SelectItem value="all">All payments</SelectItem><SelectItem value="unpaid">Unpaid</SelectItem><SelectItem value="partial">Partially paid</SelectItem><SelectItem value="paid">Paid</SelectItem></SelectContent></Select>
        <Select value={`${query.sort ?? 'createdAt'}-${query.order ?? 'desc'}`} onValueChange={(value) => { const [sort, order] = value.split('-') as [NonNullable<BookingListQuery['sort']>, NonNullable<BookingListQuery['order']>]; onChange({ sort, order }); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="createdAt-desc">Newest booking</SelectItem><SelectItem value="createdAt-asc">Oldest booking</SelectItem><SelectItem value="grandTotal-desc">Highest value</SelectItem><SelectItem value="grandTotal-asc">Lowest value</SelectItem></SelectContent></Select>
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div className="space-y-1"><label htmlFor="rental-from" className="text-xs font-medium text-muted-foreground">Rental window from</label><Input id="rental-from" type="date" value={query.itemDateFrom ?? ''} onChange={(event) => onChange({ itemDateFrom: event.target.value || null })} /></div>
        <div className="space-y-1"><label htmlFor="rental-to" className="text-xs font-medium text-muted-foreground">Rental window to</label><Input id="rental-to" type="date" value={query.itemDateTo ?? ''} onChange={(event) => onChange({ itemDateTo: event.target.value || null })} /></div>
        {hasFilters ? <Button variant="ghost" onClick={onClear}><RotateCcw className="mr-2 size-4" />Clear filters</Button> : <span />}
      </div>
    </CardContent></Card>
    <Tabs value={query.queue ?? 'all'} onValueChange={(value) => onChange({ queue: value === 'all' ? null : value as BookingListQuery['queue'] })}><div className="overflow-x-auto"><TabsList className="h-auto w-max justify-start">{queues.map((queue) => <TabsTrigger key={queue.value} value={queue.value}>{queue.label}{(query.queue ?? 'all') === queue.value ? <span className="ml-1 text-xs text-muted-foreground">{meta.total}</span> : null}</TabsTrigger>)}</TabsList></div></Tabs>
    {!data.length ? <OwnerListEmpty title={hasFilters ? 'No bookings match this queue' : 'No bookings yet'} description={hasFilters ? 'Try a different operational queue, payment state, or rental window.' : 'Create the first manual booking or wait for a storefront request.'} icon={<Package />} action={hasFilters ? <Button variant="outline" onClick={onClear}>Clear filters</Button> : <Button asChild><Link href="/dashboard/bookings/new">Create booking</Link></Button>} /> : <Card className="overflow-hidden"><CardContent className="p-0">
      <div className="hidden overflow-x-auto md:block"><Table><TableHeader><TableRow><TableHead>Booking / customer</TableHead><TableHead>Rental window</TableHead><TableHead>Status</TableHead><TableHead>Inventory fulfillment</TableHead><TableHead className="text-right">Total</TableHead><TableHead className="text-right">Next action</TableHead></TableRow></TableHeader><TableBody>{data.map((booking) => <TableRow key={booking.id} className={cn(booking.status === 'overdue' && 'bg-red-50/30')}><TableCell><Link href={`/dashboard/bookings/${booking.id}`} className="font-medium hover:underline">{booking.bookingNumber}</Link><p className="text-sm">{booking.customer.fullName}</p><p className="text-xs text-muted-foreground">{booking.customer.phone} · {booking.operations.totalQuantity} piece{booking.operations.totalQuantity === 1 ? '' : 's'}</p></TableCell><TableCell><p className="text-sm">{shortDate(booking.operations.rentalStartDate)}</p><p className="text-xs text-muted-foreground">to {shortDate(booking.operations.rentalEndDate)}</p></TableCell><TableCell><div className="space-y-1"><BookingStatusBadge status={booking.status as BookingStatus} /><p className="text-xs capitalize text-muted-foreground">{booking.paymentStatus.replace('_', ' ')}</p></div></TableCell><TableCell><div className="space-y-1 text-sm">{booking.operations.inventoryShortages ? <Badge variant="destructive">{booking.operations.inventoryShortages} shortage</Badge> : booking.operations.serializedRequired ? <><p>{booking.operations.serializedAssigned} / {booking.operations.serializedRequired} physical items assigned</p>{booking.operations.needsAssignment ? <Badge variant="secondary">Assignment needed</Badge> : <p className="text-xs text-muted-foreground">Inventory reserved</p>}</> : <p>Pooled stock reserved</p>}</div></TableCell><TableCell className="text-right font-medium">{money(booking.grandTotal)}</TableCell><TableCell className="text-right"><Button size="sm" variant={booking.operations.nextAction === 'NONE' ? 'outline' : 'default'} asChild><Link href={`/dashboard/bookings/${booking.id}`}>{nextAction[booking.operations.nextAction]}</Link></Button></TableCell></TableRow>)}</TableBody></Table></div>
      <div className="grid gap-3 p-3 md:hidden">{data.map((booking) => <div key={booking.id} className="space-y-3 rounded-lg border p-4"><div className="flex items-start justify-between gap-3"><div><Link href={`/dashboard/bookings/${booking.id}`} className="font-medium">{booking.bookingNumber}</Link><p className="text-sm">{booking.customer.fullName}</p></div><BookingStatusBadge status={booking.status as BookingStatus} /></div><div className="flex items-center gap-2 text-sm text-muted-foreground"><CalendarDays className="size-4" />{shortDate(booking.operations.rentalStartDate)} – {shortDate(booking.operations.rentalEndDate)}</div><div className="flex items-center justify-between"><span className="font-medium">{money(booking.grandTotal)}</span>{booking.operations.needsAssignment ? <Badge variant="secondary">Assign items</Badge> : null}</div><Button className="w-full" variant="outline" asChild><Link href={`/dashboard/bookings/${booking.id}`}>{nextAction[booking.operations.nextAction]}</Link></Button></div>)}</div>
      <OwnerListPagination page={meta.page} totalPages={meta.totalPages} total={meta.total} pageSize={meta.limit} isPending={isPending} onPageChange={(page) => onChange({ page }, false)} />
    </CardContent></Card>}
  </div>;
}
