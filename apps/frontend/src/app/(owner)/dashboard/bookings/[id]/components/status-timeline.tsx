import { BookingTimelineEvent } from '../../types';
import { format, parseISO } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, Navigation, Package, DollarSign, PenTool, XCircle, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

export function StatusTimeline({ events }: { events: BookingTimelineEvent[] }) {
  
  const getIcon = (status: string) => {
    switch(status) {
      case 'pending': return <DollarSign className="h-4 w-4" />;
      case 'confirmed': return <CheckCircle2 className="h-4 w-4" />;
      case 'shipped': return <Navigation className="h-4 w-4" />;
      case 'delivered': return <Package className="h-4 w-4" />;
      case 'returned': return <RotateCcw className="h-4 w-4" />;
      case 'inspected': return <PenTool className="h-4 w-4" />;
      case 'completed': return <CheckCircle2 className="h-4 w-4" />;
      case 'cancelled': return <XCircle className="h-4 w-4" />;
      default: return <div className="h-2 w-2 rounded-full bg-current" />;
    }
  };

  const getColor = (status: string) => {
    switch(status) {
      case 'pending': return 'bg-yellow-500 text-white border-yellow-500';
      case 'confirmed': return 'bg-blue-500 text-white border-blue-500';
      case 'shipped': return 'bg-indigo-500 text-white border-indigo-500';
      case 'delivered': return 'bg-teal-500 text-white border-teal-500';
      case 'overdue': return 'bg-red-500 text-white border-red-500';
      case 'returned': return 'bg-purple-500 text-white border-purple-500';
      case 'inspected': return 'bg-orange-500 text-white border-orange-500';
      case 'completed': return 'bg-green-500 text-white border-green-500';
      case 'cancelled': return 'bg-gray-500 text-white border-gray-500';
      default: return 'bg-muted border-muted-foreground text-foreground';
    }
  };

  return (
    <Card className="shadow-none border h-full">
      <CardHeader className="pb-3 border-b">
        <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Event Timeline
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6 relative">
        <div className="absolute left-7 top-6 bottom-6 w-0.5 bg-border pointer-events-none" />
        
        <div className="space-y-6">
          {events.map((event) => {
            return (
              <div key={event.id} className="relative flex items-start gap-4 z-10">
                <div className={cn("h-8 w-8 rounded-full border-2 flex items-center justify-center shrink-0 capitalize shadow-sm", getColor(event.status))}>
                  {getIcon(event.status)}
                </div>
                <div className="pt-1 w-full">
                  <div className="flex justify-between items-start w-full">
                    <span className="font-semibold text-sm capitalize">{event.status.replace(/_/g, ' ')}</span>
                    <span className="text-xs text-muted-foreground text-right">{format(parseISO(event.timestamp), 'MMM d, h:mm a')}</span>
                  </div>
                  {event.user && (
                    <div className="text-xs text-muted-foreground mt-0.5">
                      By: <span className="font-medium text-foreground">{event.user}</span>
                    </div>
                  )}
                  {event.note && (
                    <div className="text-xs text-muted-foreground bg-muted p-2 rounded-md mt-1 italic border border-dashed">
                      &quot;{event.note}&quot;
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
