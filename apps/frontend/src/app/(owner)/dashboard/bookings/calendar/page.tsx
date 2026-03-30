'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { BookingCalendar } from './components/booking-calendar';
import { bookingApi } from '@/lib/api/bookings';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { startOfMonth, endOfMonth, subMonths, addMonths, format } from 'date-fns';

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());

  // Compute date range for the visible month (including ±1 month for overlap)
  const dateRange = useMemo(() => {
    const from = startOfMonth(subMonths(currentDate, 1));
    const to = endOfMonth(addMonths(currentDate, 1));
    return {
      dateFrom: format(from, 'yyyy-MM-dd'),
      dateTo: format(to, 'yyyy-MM-dd'),
    };
  }, [currentDate]);

  // Fetch bookings filtered by the visible date range
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['bookings', 'calendar', dateRange],
    queryFn: () => bookingApi.list({
      limit: 200,
      dateFrom: dateRange.dateFrom,
      dateTo: dateRange.dateTo,
    }),
  });

  const bookings = data?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild className="-ml-2 h-8 w-8">
            <Link href="/dashboard/bookings">
              <ChevronLeft className="h-5 w-5" />
              <span className="sr-only">Back to bookings list</span>
            </Link>
          </Button>
          <PageHeader
            title="Calendar View"
            description="Visualize pickup and return dates across all active bookings."
          />
        </div>
      </div>

      <div className="bg-card border rounded-md p-6 min-h-[600px]">
        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
          </div>
        ) : isError ? (
          <Alert variant="destructive">
            <AlertDescription>
              Failed to load calendar data. {(error as Error)?.message || 'Please try again.'}
            </AlertDescription>
          </Alert>
        ) : (
          <BookingCalendar
            bookings={bookings}
            currentDate={currentDate}
            onDateChange={setCurrentDate}
          />
        )}
      </div>
    </div>
  );
}
