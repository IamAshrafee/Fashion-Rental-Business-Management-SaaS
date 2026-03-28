import { PageHeader } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Plus, Calendar as CalendarIcon, Download } from 'lucide-react';
import Link from 'next/link';
import { BookingsDataTable } from './components/bookings-table';
import { MOCK_BOOKINGS } from './mocks';

export const metadata = {
  title: 'Bookings | ClosetRent',
  description: 'Manage rentals, orders, and fulfillments.',
};

export default function BookingsPage() {
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

      <div className="bg-card text-card-foreground">
        <BookingsDataTable data={MOCK_BOOKINGS} />
      </div>
    </div>
  );
}
