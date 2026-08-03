'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Calendar as CalendarIcon, ClipboardCheck, PackageCheck, Plus } from 'lucide-react';
import { bookingApi } from '@/lib/api/bookings';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { OwnerListError, OwnerTableSkeleton } from '@/components/owner/workspace';
import { BookingsDataTable } from './components/bookings-table';
import { useBookingListQuery } from './hooks/use-booking-list-query';

export default function BookingsPage() {
  const { query, update, clear, isNavigating } = useBookingListQuery();
  const bookings = useQuery({ queryKey: ['bookings', 'list', query], queryFn: () => bookingApi.list(query), placeholderData: (previous) => previous });
  const stats = useQuery({ queryKey: ['bookings', 'stats'], queryFn: bookingApi.getStats });
  return <div className="space-y-6 pb-10">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-2xl font-semibold tracking-tight">Rental bookings</h1><p className="text-sm text-muted-foreground">Review requests, assign inventory, hand out rentals, receive returns, and close each job.</p></div><div className="flex gap-2"><Button variant="outline" asChild><Link href="/dashboard/bookings/calendar"><CalendarIcon className="mr-2 size-4" />Calendar</Link></Button><Button asChild><Link href="/dashboard/bookings/new"><Plus className="mr-2 size-4" />Create booking</Link></Button></div></div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Card><CardHeader className="pb-2"><CardTitle className="flex items-center justify-between text-sm font-medium"><span>Awaiting review</span><ClipboardCheck className="size-4 text-muted-foreground" /></CardTitle></CardHeader><CardContent><button className="text-3xl font-semibold" onClick={() => update({ queue: 'REVIEW' })}>{stats.data?.pendingCount ?? '—'}</button></CardContent></Card>
      <Card><CardHeader className="pb-2"><CardTitle className="flex items-center justify-between text-sm font-medium"><span>Needs item assignment</span><PackageCheck className="size-4 text-muted-foreground" /></CardTitle></CardHeader><CardContent><button className="text-3xl font-semibold" onClick={() => update({ queue: 'ASSIGNMENT' })}>{stats.data?.needsAssignmentCount ?? '—'}</button></CardContent></Card>
      <Card><CardHeader className="pb-2"><CardTitle className="flex items-center justify-between text-sm font-medium"><span>Handoffs today</span><CalendarIcon className="size-4 text-muted-foreground" /></CardTitle></CardHeader><CardContent><button className="text-3xl font-semibold" onClick={() => update({ queue: 'HANDOFF' })}>{stats.data?.todayHandoffs ?? '—'}</button><p className="text-xs text-muted-foreground">{stats.data?.todayReturns ?? 0} returns due</p></CardContent></Card>
      <Card className={(stats.data?.overdueCount ?? 0) ? 'border-destructive/50' : ''}><CardHeader className="pb-2"><CardTitle className="flex items-center justify-between text-sm font-medium"><span>Overdue</span><AlertTriangle className="size-4 text-destructive" /></CardTitle></CardHeader><CardContent><button className="text-3xl font-semibold text-destructive" onClick={() => update({ queue: 'OVERDUE' })}>{stats.data?.overdueCount ?? '—'}</button></CardContent></Card>
    </div>
    {bookings.isLoading ? <OwnerTableSkeleton columns={6} rows={8} /> : bookings.isError || !bookings.data ? <OwnerListError message="Bookings could not be loaded." onRetry={() => void bookings.refetch()} /> : <BookingsDataTable data={bookings.data.data} meta={bookings.data.meta} query={query} isPending={bookings.isFetching || isNavigating} onChange={update} onClear={clear} />}
  </div>;
}
