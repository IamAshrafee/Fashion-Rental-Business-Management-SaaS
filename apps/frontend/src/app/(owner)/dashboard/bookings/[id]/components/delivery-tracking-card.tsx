import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, Truck, Clock, CheckCircle2, AlertTriangle, ChevronRight, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import type { BookingDetailResponse } from '@/lib/api/bookings';

const STAGE_CONFIG = {
  prepare_parcel: { label: 'Preparing Parcel', icon: Package, color: 'text-amber-600', bg: 'bg-amber-100' },
  awaiting_pickup: { label: 'Awaiting Pickup', icon: Clock, color: 'text-blue-600', bg: 'bg-blue-100' },
  in_transit: { label: 'In Transit', icon: Truck, color: 'text-cyan-600', bg: 'bg-cyan-100' },
  delivered: { label: 'Delivered', icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-100' },
  error: { label: 'Delivery Issue', icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-100' },
};

function getStageConfig(courierStatus: string | null) {
  if (!courierStatus) return null;
  const inTransitGroup = ['picked_up', 'at_hub', 'in_transit', 'at_destination', 'out_for_delivery'];
  const errorGroup = ['pickup_failed', 'partial_delivered', 'returned_to_sender', 'cancelled', 'on_hold', 'error'];
  const awaitingGroup = ['pickup_pending', 'pickup_assigned'];

  if (courierStatus === 'prepare_parcel') return STAGE_CONFIG.prepare_parcel;
  if (courierStatus === 'delivered') return STAGE_CONFIG.delivered;
  if (inTransitGroup.includes(courierStatus)) return STAGE_CONFIG.in_transit;
  if (awaitingGroup.includes(courierStatus)) return STAGE_CONFIG.awaiting_pickup;
  if (errorGroup.includes(courierStatus)) return STAGE_CONFIG.error;
  return STAGE_CONFIG.error;
}

export function DeliveryTrackingCard({ booking }: { booking: BookingDetailResponse }) {
  if (!booking.courierStatus) return null; // Only show if delivery started
  
  const stageConfig = getStageConfig(booking.courierStatus) || STAGE_CONFIG.prepare_parcel;
  const Icon = stageConfig.icon;
  const latestEvent = booking.courierStatusHistory?.length
    ? booking.courierStatusHistory[booking.courierStatusHistory.length - 1]
    : null;

  return (
    <Card className="shadow-none border border-primary/20 overflow-hidden">
      <div className={cn("p-4 border-b flex items-center justify-between", stageConfig.bg)}>
        <div className="flex items-center gap-3">
          <div className={cn("flex h-8 w-8 items-center justify-center rounded-md bg-white/60", stageConfig.color)}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h3 className={cn("font-semibold", stageConfig.color)}>{stageConfig.label}</h3>
            {latestEvent && (
              <p className="text-xs text-foreground/70">{latestEvent.label} · {format(new Date(latestEvent.timestamp), 'MMM d, h:mm a')}</p>
            )}
          </div>
        </div>
        <Button variant="ghost" size="sm" asChild className="h-8 max-md:hidden">
          <Link href="/dashboard/deliveries">
            Manage Deliveries <ChevronRight className="h-4 w-4 ml-1" />
          </Link>
        </Button>
      </div>
      
      <CardContent className="p-4 grid sm:grid-cols-3 gap-6">
        <div>
          <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wider font-semibold">Courier Provider</div>
          <div className="text-sm font-medium capitalize">
            {booking.courierProvider ? booking.courierProvider.replace(/_/g, ' ') : 'System'}
          </div>
          {booking.trackingNumber && (
            <div className="text-xs text-muted-foreground mt-1">
              Tracking: <span className="font-mono bg-muted px-1 py-0.5 rounded text-foreground">{booking.trackingNumber}</span>
            </div>
          )}
        </div>
        
        <div>
          <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wider font-semibold">Pickup Schedule</div>
          {booking.scheduledPickupAt ? (
             <div className="text-sm font-medium">
               {format(new Date(booking.scheduledPickupAt), 'MMM d, ha')}
               {booking.deliveryLeadDays && <span className="text-muted-foreground font-normal ml-1">({booking.deliveryLeadDays}d lead)</span>}
             </div>
          ) : (
            <div className="text-sm text-muted-foreground">—</div>
          )}
          {booking.pickupRequestedAt && (
             <div className="text-xs text-muted-foreground mt-1">
               Requested: {format(new Date(booking.pickupRequestedAt), 'MMM d')}
             </div>
          )}
        </div>

        <div>
          <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wider font-semibold">Status / Issues</div>
          <div className="text-sm">
            <Badge variant="outline" className={cn("capitalize px-1.5 font-medium", stageConfig.color)}>
              {booking.courierStatus.replace(/_/g, ' ')}
            </Badge>
          </div>
          {booking.courierErrorReason && (
            <div className="text-xs text-red-600 font-medium mt-1">
              {booking.courierErrorReason}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
