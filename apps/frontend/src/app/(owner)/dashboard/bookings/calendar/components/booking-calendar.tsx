'use client';

import { useState } from 'react';
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
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import Link from 'next/link';

export function BookingCalendar({ bookings }: { bookings: BookingListItem[] }) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  
  // Pad the beginning for grid alignment
  const startDate = new Date(monthStart);
  startDate.setDate(startDate.getDate() - startDate.getDay());

  // Pad the end
  const endDate = new Date(monthEnd);
  endDate.setDate(endDate.getDate() + (6 - endDate.getDay()));

  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

  const getEventsForDay = (day: Date) => {
    return bookings.filter(b => {
      // For simplicity, checking if booking start OR end date is exactly this day
      // Or if the rental spans this day (for items)
      return b.items.some(item => {
        const itemStart = parseISO(item.startDate);
        const itemEnd = parseISO(item.endDate);
        // Is day between start and end inclusive?
        const checkTime = day.getTime();
        return checkTime >= new Date(itemStart.setHours(0,0,0,0)).getTime() && 
               checkTime <= new Date(itemEnd.setHours(0,0,0,0)).getTime();
      });
    });
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'confirmed': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'overdue': return 'bg-red-100 text-red-800 border-red-200 shadow-sm shadow-red-500/20';
      case 'shipped': return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'delivered': return 'bg-teal-100 text-teal-800 border-teal-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">{format(currentDate, 'MMMM yyyy')}</h2>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="icon" onClick={() => setCurrentDate(subMonths(currentDate, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={() => setCurrentDate(new Date())}>
            Today
          </Button>
          <Button variant="outline" size="icon" onClick={() => setCurrentDate(addMonths(currentDate, 1))}>
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
                  <Link href={`/dashboard/bookings/${event.id}`} key={event.id}>
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
      </div>
    </div>
  );
}
