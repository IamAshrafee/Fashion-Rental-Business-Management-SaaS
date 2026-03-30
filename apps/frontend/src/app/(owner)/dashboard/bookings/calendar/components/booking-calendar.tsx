'use client';

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
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface BookingCalendarProps {
  bookings: BookingListItem[];
  currentDate: Date;
  onDateChange: (date: Date) => void;
}

export function BookingCalendar({ bookings, currentDate, onDateChange }: BookingCalendarProps) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  
  // Pad the beginning for grid alignment
  const calStart = new Date(monthStart);
  calStart.setDate(calStart.getDate() - calStart.getDay());

  // Pad the end
  const calEnd = new Date(monthEnd);
  calEnd.setDate(calEnd.getDate() + (6 - calEnd.getDay()));

  const calendarDays = eachDayOfInterval({ start: calStart, end: calEnd });

  const getEventsForDay = (day: Date) => {
    const dayStart = startOfDay(day).getTime();
    
    return bookings.filter(b => {
      return b.items.some(item => {
        // IMPORTANT: Clone dates before normalizing to avoid mutating the original
        // parseISO creates a new Date each time, so it's safe
        const itemStart = startOfDay(parseISO(item.startDate)).getTime();
        const itemEnd = startOfDay(parseISO(item.endDate)).getTime();
        return dayStart >= itemStart && dayStart <= itemEnd;
      });
    });
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800';
      case 'confirmed': return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800';
      case 'overdue': return 'bg-red-100 text-red-800 border-red-200 shadow-sm shadow-red-500/20 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800';
      case 'shipped': return 'bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800';
      case 'delivered': return 'bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-900/30 dark:text-teal-300 dark:border-teal-800';
      case 'returned': return 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800';
      default: return 'bg-muted text-muted-foreground border';
    }
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">{format(currentDate, 'MMMM yyyy')}</h2>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="icon" onClick={() => onDateChange(subMonths(currentDate, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={() => onDateChange(new Date())}>
            Today
          </Button>
          <Button variant="outline" size="icon" onClick={() => onDateChange(addMonths(currentDate, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 border-t border-l">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="p-2 border-r border-b text-center font-semibold text-sm bg-muted/40">
            {day}
          </div>
        ))}
        
        {calendarDays.map((date: Date, i: number) => {
          const events = getEventsForDay(date);
          const isCurrentMonth = isSameMonth(date, currentDate);
          
          return (
            <div 
              key={i} 
              className={cn(
                "min-h-[120px] p-1.5 border-r border-b relative",
                !isCurrentMonth && "bg-muted/20 opacity-50"
              )}
            >
              <div className={cn(
                "text-right text-xs p-1 font-medium select-none",
                isSameDay(date, new Date()) && "bg-primary text-primary-foreground rounded-md text-center max-w-[24px] ml-auto"
              )}>
                {format(date, 'd')}
              </div>
              
              <div className="flex flex-col gap-1 mt-1 overflow-y-auto max-h-[90px] no-scrollbar">
                {events.map(event => (
                  <Link href={`/dashboard/bookings/${event.id}`} key={`${event.id}-${i}`}>
                    <div className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded border truncate cursor-pointer transition-colors hover:opacity-80",
                      getStatusColor(event.status)
                    )}>
                      {(event.bookingNumber || event.id).slice(-8)} - {(event.customer.fullName || '').split(' ')[0]}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      
      <div className="flex gap-4 text-xs mt-4 justify-center text-muted-foreground flex-wrap">
        <span className="flex items-center"><div className="w-3 h-3 rounded-sm bg-yellow-100 border border-yellow-200 mr-1.5" /> Pending</span>
        <span className="flex items-center"><div className="w-3 h-3 rounded-sm bg-blue-100 border border-blue-200 mr-1.5" /> Confirmed</span>
        <span className="flex items-center"><div className="w-3 h-3 rounded-sm bg-indigo-100 border border-indigo-200 mr-1.5" /> Shipped</span>
        <span className="flex items-center"><div className="w-3 h-3 rounded-sm bg-teal-100 border border-teal-200 mr-1.5" /> Active</span>
        <span className="flex items-center"><div className="w-3 h-3 rounded-sm bg-red-100 border border-red-200 mr-1.5" /> Overdue</span>
        <span className="flex items-center"><div className="w-3 h-3 rounded-sm bg-purple-100 border border-purple-200 mr-1.5" /> Returned</span>
      </div>
    </div>
  );
}
