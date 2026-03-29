'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Plus, Calendar as CalendarIcon, Download, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { BookingsDataTable } from './components/bookings-table';
import { bookingApi, type BookingListQuery } from '@/lib/api/bookings';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function BookingsPage() {
  const [query, setQuery] = useState<BookingListQuery>({ page: 1, limit: 50 });

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['bookings', 'list', query],
    queryFn: () => bookingApi.list(query),
  });

  const bookings = data?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          title="Bookings"
          description="Manage rentals, fulfillments, and track order statuses."
        />
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/dashboard/bookings/calendar">
              <CalendarIcon className="h-4 w-4 mr-2" />
              Calendar
            </Link>
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button asChild>
            <Link href="/dashboard/bookings/new">
              <Plus className="h-4 w-4 mr-2" />
              Create Order
            </Link>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
        </div>
      ) : isError ? (
        <Alert variant="destructive">
          <AlertDescription>
            Failed to load bookings. {(error as Error)?.message || 'Please try again.'}
          </AlertDescription>
        </Alert>
      ) : (
        <div className="bg-card text-card-foreground">
          <BookingsDataTable data={bookings} />
        </div>
      )}
    </div>
  );
}
