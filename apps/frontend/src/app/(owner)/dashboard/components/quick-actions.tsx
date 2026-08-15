'use client';

import { Button } from '@/components/ui/button';
import { PlusCircle, CalendarPlus, ListOrdered } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/providers/auth-provider';
import { hasTenantPermission } from '@/lib/permissions';

export function DashboardQuickActions() {
  const { user } = useAuth();
  const canManageProducts = hasTenantPermission(user, 'manage_products');
  const canManageBookings = hasTenantPermission(user, 'manage_bookings');
  if (!canManageProducts && !canManageBookings) return null;

  return (
    <div className="flex flex-wrap items-center gap-3">
      {canManageProducts && (
        <Button asChild className="gap-2 shrink-0">
          <Link href="/dashboard/products/new"><PlusCircle className="h-4 w-4" />Add Product</Link>
        </Button>
      )}
      {canManageBookings && (
        <>
          <Button asChild variant="outline" className="gap-2 bg-background shrink-0">
            <Link href="/dashboard/bookings/new"><CalendarPlus className="h-4 w-4 text-muted-foreground" />Create Booking</Link>
          </Button>
          <Button asChild variant="outline" className="gap-2 bg-background shrink-0">
            <Link href="/dashboard/bookings"><ListOrdered className="h-4 w-4 text-muted-foreground" />View All Orders</Link>
          </Button>
        </>
      )}
    </div>
  );
}
