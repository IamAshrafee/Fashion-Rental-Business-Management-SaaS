import { PageHeader } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ListFilter } from 'lucide-react';
import Link from 'next/link';
import { BookingCalendar } from './components/booking-calendar';
import { MOCK_BOOKINGS } from '../mocks';

export const metadata = {
  title: 'Booking Calendar | ClosetRent',
};

export default function CalendarPage() {
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
        
        <Button variant="outline">
          <ListFilter className="h-4 w-4 mr-2" />
          Filter Events
        </Button>
      </div>

      <div className="bg-card border rounded-md p-6 min-h-[600px]">
        <BookingCalendar bookings={MOCK_BOOKINGS} />
      </div>
    </div>
  );
}
