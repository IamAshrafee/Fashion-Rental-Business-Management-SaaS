import { PageHeader } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { ManualBookingForm } from './components/manual-booking-form';

export const metadata = {
  title: 'Create Booking | ClosetRent',
};

export default function NewBookingPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-start">
        <Button variant="ghost" size="icon" asChild className="-ml-2 h-8 w-8">
          <Link href="/dashboard/bookings">
            <ChevronLeft className="h-5 w-5" />
            <span className="sr-only">Back to bookings</span>
          </Link>
        </Button>
        <PageHeader
          title="Create Booking"
          description="Manually record an in-store or phone order."
        />
      </div>

      <ManualBookingForm />
    </div>
  );
}
