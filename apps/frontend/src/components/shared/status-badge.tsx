import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import type { BookingStatus } from '@closetrent/types';

/**
 * Mapping of booking status → badge variant + colour classes.
 * Uses the semantic status palette from tailwind.config.ts.
 */
const STATUS_CONFIG: Record<
  BookingStatus,
  { label: string; className: string }
> = {
  pending: {
    label: 'Pending',
    className: 'bg-status-pending/15 text-amber-700 border-status-pending/30',
  },
  confirmed: {
    label: 'Confirmed',
    className: 'bg-status-confirmed/15 text-blue-700 border-status-confirmed/30',
  },
  delivered: {
    label: 'Delivered',
    className: 'bg-status-delivered/15 text-emerald-700 border-status-delivered/30',
  },
  overdue: {
    label: 'Overdue',
    className: 'bg-status-overdue/15 text-red-700 border-status-overdue/30',
  },
  returned: {
    label: 'Returned',
    className: 'bg-status-returned/15 text-orange-700 border-status-returned/30',
  },
  inspected: {
    label: 'Inspected',
    className: 'bg-status-inspected/15 text-cyan-700 border-status-inspected/30',
  },
  completed: {
    label: 'Completed',
    className: 'bg-status-completed/15 text-green-700 border-status-completed/30',
  },
  cancelled: {
    label: 'Cancelled',
    className: 'bg-status-cancelled/15 text-gray-700 border-status-cancelled/30',
  },
};

interface StatusBadgeProps {
  status: BookingStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? {
    label: status,
    className: '',
  };

  return (
    <Badge
      variant="outline"
      className={cn(
        'text-xs font-medium capitalize',
        config.className,
        className,
      )}
    >
      {config.label}
    </Badge>
  );
}
