'use client';

import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ListFilter, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { BookingCalendar } from './components/booking-calendar';
import { bookingApi } from '@/lib/api/bookings';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function CalendarPage() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['bookings', 'calendar'],
    queryFn: () => bookingApi.list({ limit: 100 }),
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
            description="Visualize pickup and return dates."
          />
        </div>
        
        <Button variant="outline" onClick={() => toast.info('Calendar filters coming soon')}>
          <ListFilter className="h-4 w-4 mr-2" />
          Filter Events
        </Button>
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
          <BookingCalendar bookings={bookings} />
        )}
      </div>
    </div>
  );
}
