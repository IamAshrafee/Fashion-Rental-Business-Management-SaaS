'use client';

import { Button } from '@/components/ui/button';
import { BookingStatus } from '../../types';
import { Package, Truck, CheckCircle, RotateCcw, XCircle, Search, ClipboardCheck } from 'lucide-react';

// Mock dialog triggers (we will build real ones later)
export function OrderActions({ status }: { status: BookingStatus }) {
  // Example mappings
  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === 'pending' && (
        <>
          <Button className="bg-blue-600 hover:bg-blue-700">
            <CheckCircle className="mr-2 h-4 w-4" />
            Confirm Booking
          </Button>
          <Button variant="outline" className="text-destructive hover:bg-destructive/10">
            <XCircle className="mr-2 h-4 w-4" />
            Cancel Booking
          </Button>
        </>
      )}

      {status === 'confirmed' && (
        <>
          <Button>
            <Package className="mr-2 h-4 w-4" />
            Ship Order
          </Button>
          <Button variant="outline" className="text-destructive hover:bg-destructive/10">
            Cancel Order
          </Button>
        </>
      )}

      {status === 'shipped' && (
        <Button className="bg-teal-600 hover:bg-teal-700">
          <Truck className="mr-2 h-4 w-4" />
          Mark as Delivered
        </Button>
      )}

      {(status === 'delivered' || status === 'overdue') && (
        <Button className="bg-purple-600 hover:bg-purple-700">
          <RotateCcw className="mr-2 h-4 w-4" />
          Mark as Returned
        </Button>
      )}

      {status === 'returned' && (
        <Button className="bg-orange-600 hover:bg-orange-700">
          <Search className="mr-2 h-4 w-4" />
          Start Full Inspection
        </Button>
      )}

      {status === 'inspected' && (
        <Button className="bg-green-600 hover:bg-green-700">
          <ClipboardCheck className="mr-2 h-4 w-4" />
          Complete Order
        </Button>
      )}

      {/* For modals, we will integrate them fully in the next phase */}
    </div>
  );
}
