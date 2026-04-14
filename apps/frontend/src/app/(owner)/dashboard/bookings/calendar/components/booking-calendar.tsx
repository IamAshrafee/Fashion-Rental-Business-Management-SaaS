'use client';

import { useMemo, useState } from 'react';
import type { BookingListItem } from '@/lib/api/bookings';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  parseISO,
  startOfDay,
} from 'date-fns';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import Link from 'next/link';

// ─── Types ────────────────────────────────────────────────────────────────────

interface BookingCalendarProps {
  bookings: BookingListItem[];
  currentDate: Date;
  onDateChange: (date: Date) => void;
  isFetching?: boolean;
}

interface DayEvent {
  booking: BookingListItem;
  isStart: boolean;
  isEnd: boolean;
}

// ─── Status Colors ────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800',
  confirmed: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',

  delivered: 'bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-900/30 dark:text-teal-300 dark:border-teal-800',
  overdue: 'bg-red-100 text-red-800 border-red-200 shadow-sm shadow-red-500/20 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800',
  returned: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800',
  inspected: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800',
  completed: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800',
  cancelled: 'bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-900/30 dark:text-gray-400 dark:border-gray-700',
};

const LEGEND_ITEMS = [
  { status: 'pending', label: 'Pending', color: 'bg-yellow-100 border-yellow-200' },
  { status: 'confirmed', label: 'Confirmed', color: 'bg-blue-100 border-blue-200' },

  { status: 'delivered', label: 'Delivered', color: 'bg-teal-100 border-teal-200' },
  { status: 'overdue', label: 'Overdue', color: 'bg-red-100 border-red-200' },
  { status: 'returned', label: 'Returned', color: 'bg-purple-100 border-purple-200' },
  { status: 'completed', label: 'Completed', color: 'bg-green-100 border-green-200' },
];

const MAX_VISIBLE_EVENTS = 3;

// ─── Component ────────────────────────────────────────────────────────────────

export function BookingCalendar({ bookings, currentDate, onDateChange, isFetching }: BookingCalendarProps) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);

  // Pad calendar grid to full weeks
  const calStart = new Date(monthStart);
  calStart.setDate(calStart.getDate() - calStart.getDay());

  const calEnd = new Date(monthEnd);
  calEnd.setDate(calEnd.getDate() + (6 - calEnd.getDay()));

  const calendarDays = eachDayOfInterval({ start: calStart, end: calEnd });

  // Fix #8: Disable Today when already on current month
  const isCurrentMonth = isSameMonth(currentDate, new Date());

  // Fix #6: Pre-compute date → events map for O(1) lookups
  const dayEventsMap = useMemo(() => {
    const map = new Map<string, DayEvent[]>();

    for (const booking of bookings) {
      // Fix #2: Track seen booking IDs per day to deduplicate
      const seenDaysForBooking = new Set<string>();

      for (const item of booking.items) {
        const itemStart = startOfDay(parseISO(item.startDate));
        const itemEnd = startOfDay(parseISO(item.endDate));

        // Walk each day in the item's rental range
        const cursor = new Date(itemStart);
        while (cursor <= itemEnd) {
          const key = format(cursor, 'yyyy-MM-dd');

          // Only add once per booking per day (dedup across items)
          if (!seenDaysForBooking.has(key)) {
            seenDaysForBooking.add(key);

            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push({
              booking,
              isStart: cursor.getTime() === itemStart.getTime(),
              isEnd: cursor.getTime() === itemEnd.getTime(),
            });
          }

          cursor.setDate(cursor.getDate() + 1);
        }
      }
    }

    return map;
  }, [bookings]);

  // ─── Desktop calendar grid ─────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-bold">{format(currentDate, 'MMMM yyyy')}</h2>
          {isFetching && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="icon" onClick={() => onDateChange(subMonths(currentDate, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            onClick={() => onDateChange(new Date())}
            disabled={isCurrentMonth}
          >
            Today
          </Button>
          <Button variant="outline" size="icon" onClick={() => onDateChange(addMonths(currentDate, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Fix #7: Desktop = grid, Mobile = list */}
      {/* Desktop Calendar Grid */}
      <div className="hidden sm:block">
        <div className="grid grid-cols-7 border-t border-l">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="p-2 border-r border-b text-center font-semibold text-sm bg-muted/40">
              {day}
            </div>
          ))}
          
          {calendarDays.map((date: Date, i: number) => {
            const key = format(date, 'yyyy-MM-dd');
            const events = dayEventsMap.get(key) || [];
            const isInMonth = isSameMonth(date, currentDate);
            const isToday = isSameDay(date, new Date());
            const visibleEvents = events.slice(0, MAX_VISIBLE_EVENTS);
            const overflowCount = events.length - MAX_VISIBLE_EVENTS;

            return (
              <div 
                key={i} 
                className={cn(
                  "min-h-[120px] p-1.5 border-r border-b relative",
                  !isInMonth && "bg-muted/20 opacity-40"
                )}
              >
                {/* Day number */}
                <div className={cn(
                  "text-right text-xs p-1 font-medium select-none",
                  isToday && "bg-primary text-primary-foreground rounded-md text-center max-w-[24px] ml-auto"
                )}>
                  {format(date, 'd')}
                </div>
                
                {/* Event chips */}
                <div className="flex flex-col gap-0.5 mt-1">
                  {visibleEvents.map((event, idx) => (
                    <Link href={`/dashboard/bookings/${event.booking.id}`} key={`${event.booking.id}-${idx}`}>
                      <div className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded border truncate cursor-pointer transition-colors hover:opacity-80 flex items-center gap-0.5",
                        STATUS_COLORS[event.booking.status] || 'bg-muted text-muted-foreground border'
                      )}>
                        {/* Fix #3: Start/end indicators */}
                        {event.isStart && <span className="opacity-60">▶</span>}
                        {event.isEnd && !event.isStart && <span className="opacity-60">◀</span>}
                        <span className="truncate">
                          {(event.booking.bookingNumber || event.booking.id).slice(-6)} · {(event.booking.customer.fullName || '').split(' ')[0]}
                        </span>
                      </div>
                    </Link>
                  ))}

                  {/* Fix #9: "+N more" overflow with day detail popover */}
                  {overflowCount > 0 && (
                    <DayDetailPopover
                      date={date}
                      events={events}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Fix #7: Mobile list view */}
      <div className="sm:hidden space-y-2">
        {calendarDays
          .filter(date => isSameMonth(date, currentDate))
          .filter(date => {
            const key = format(date, 'yyyy-MM-dd');
            return (dayEventsMap.get(key) || []).length > 0;
          })
          .map((date, i) => {
            const key = format(date, 'yyyy-MM-dd');
            const events = dayEventsMap.get(key) || [];
            const isToday = isSameDay(date, new Date());

            return (
              <div key={i} className={cn(
                "border rounded-lg p-3",
                isToday && "border-primary/50 bg-primary/5"
              )}>
                <div className="flex items-center justify-between mb-2">
                  <span className={cn(
                    "text-sm font-semibold",
                    isToday && "text-primary"
                  )}>
                    {format(date, 'EEE, MMM d')}
                    {isToday && <span className="ml-2 text-xs font-normal text-primary/70">Today</span>}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {events.length} booking{events.length > 1 ? 's' : ''}
                  </span>
                </div>
                <div className="space-y-1">
                  {events.map((event, idx) => (
                    <Link href={`/dashboard/bookings/${event.booking.id}`} key={`${event.booking.id}-${idx}`}>
                      <div className={cn(
                        "text-xs px-2 py-1.5 rounded border flex items-center justify-between transition-colors hover:opacity-80",
                        STATUS_COLORS[event.booking.status] || 'bg-muted text-muted-foreground border'
                      )}>
                        <span className="flex items-center gap-1.5">
                          {event.isStart && <span className="opacity-60">▶</span>}
                          {event.isEnd && !event.isStart && <span className="opacity-60">◀</span>}
                          <span className="font-medium">{event.booking.bookingNumber || event.booking.id.slice(-8)}</span>
                          <span className="text-[10px] opacity-70">·</span>
                          <span>{event.booking.customer.fullName}</span>
                        </span>
                        <span className="capitalize text-[10px]">{event.booking.status}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}

        {/* Empty state for mobile */}
        {calendarDays
          .filter(date => isSameMonth(date, currentDate))
          .every(date => {
            const key = format(date, 'yyyy-MM-dd');
            return (dayEventsMap.get(key) || []).length === 0;
          }) && (
          <div className="text-center py-12 text-muted-foreground">
            <p>No bookings this month.</p>
          </div>
        )}
      </div>

      {/* Fix #5: Corrected legend */}
      <div className="flex gap-3 text-xs mt-4 justify-center text-muted-foreground flex-wrap">
        {LEGEND_ITEMS.map(item => (
          <span key={item.status} className="flex items-center">
            <div className={cn("w-3 h-3 rounded-sm border mr-1.5", item.color)} />
            {item.label}
          </span>
        ))}
        <span className="flex items-center ml-2 border-l pl-3">
          <span className="opacity-60 mr-1">▶</span> Pickup
        </span>
        <span className="flex items-center">
          <span className="opacity-60 mr-1">◀</span> Return
        </span>
      </div>
    </div>
  );
}

// ─── Day Detail Popover ──────────────────────────────────────────────────────

function DayDetailPopover({ date, events }: { date: Date; events: DayEvent[] }) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="text-[10px] text-muted-foreground hover:text-foreground font-medium px-1.5 py-0.5 rounded hover:bg-muted/50 transition-colors text-left">
          +{events.length - MAX_VISIBLE_EVENTS} more
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="start">
        <p className="text-sm font-semibold mb-2">{format(date, 'EEEE, MMM d')}</p>
        <div className="space-y-1 max-h-[240px] overflow-y-auto">
          {events.map((event, idx) => (
            <Link
              href={`/dashboard/bookings/${event.booking.id}`}
              key={`detail-${event.booking.id}-${idx}`}
              onClick={() => setOpen(false)}
            >
              <div className={cn(
                "text-xs px-2 py-1.5 rounded border flex items-center justify-between transition-colors hover:opacity-80",
                STATUS_COLORS[event.booking.status] || 'bg-muted text-muted-foreground border'
              )}>
                <span className="flex items-center gap-1.5 truncate">
                  {event.isStart && <span className="opacity-60">▶</span>}
                  {event.isEnd && !event.isStart && <span className="opacity-60">◀</span>}
                  <span className="font-medium">{event.booking.bookingNumber || event.booking.id.slice(-8)}</span>
                  <span className="opacity-70 truncate">{event.booking.customer.fullName}</span>
                </span>
                <span className="capitalize text-[10px] ml-2 shrink-0">{event.booking.status}</span>
              </div>
            </Link>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
