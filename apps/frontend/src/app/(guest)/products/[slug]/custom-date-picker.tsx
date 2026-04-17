'use client';

import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, startOfWeek, endOfWeek, isBefore, startOfDay } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';

interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

interface CustomDateRangePickerProps {
  date: DateRange | undefined;
  setDate: (date: DateRange | undefined) => void;
  className?: string;
  minDate?: Date;
}

export function CustomDateRangePicker({ date, setDate, className, minDate = new Date() }: CustomDateRangePickerProps) {
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(minDate));
  const [isOpen, setIsOpen] = useState(false);

  const daysInMonth = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth));
    const end = endOfWeek(endOfMonth(currentMonth));
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const handleDayClick = (day: Date) => {
    if (isBefore(day, startOfDay(minDate))) return;

    if (!date?.from || (date.from && date.to)) {
      setDate({ from: day, to: undefined });
    } else {
      if (isBefore(day, date.from)) {
        setDate({ from: day, to: undefined });
      } else {
        setDate({ from: date.from, to: day });
        setIsOpen(false);
      }
    }
  };

  const isSelected = (day: Date) => {
    if (!date) return false;
    if (date.from && isSameDay(day, date.from)) return true;
    if (date.to && isSameDay(day, date.to)) return true;
    return false;
  };

  const isInRange = (day: Date) => {
    if (!date?.from || !date?.to) return false;
    return day > date.from && day < date.to;
  };

  const isDisabled = (day: Date) => isBefore(day, startOfDay(minDate));

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "flex w-full items-center justify-between rounded-xl border-2 border-black/5 bg-white p-5 text-left shadow-sm transition-all hover:border-black/20 focus:outline-none focus:border-black",
            className
          )}
        >
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Rental Dates</span>
            <span className={cn("text-base font-medium", !date?.from && 'text-muted-foreground')}>
              {date?.from ? (
                date.to ? (
                  <>
                    {format(date.from, "LLL dd")} — {format(date.to, "LLL dd, y")}
                  </>
                ) : (
                  format(date.from, "LLL dd, y")
                )
              ) : (
                <span>Select pickup & return dates</span>
              )}
            </span>
          </div>
          <CalendarIcon className="h-5 w-5 text-black/50" />
        </button>
      </PopoverTrigger>
      
      <PopoverContent className="w-auto p-6 rounded-3xl shadow-[0_10px_40px_rgba(0,0,0,0.08)] border-black/5" align="start">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <button 
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-muted transition text-muted-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="font-semibold text-sm">{format(currentMonth, 'MMMM yyyy')}</div>
            <button 
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-muted transition text-muted-foreground"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground mb-2">
            <div>Su</div><div>Mo</div><div>Tu</div><div>We</div><div>Th</div><div>Fr</div><div>Sa</div>
          </div>

          <div className="grid grid-cols-7 gap-y-1">
            {daysInMonth.map((day, i) => {
              const selected = isSelected(day);
              const inRange = isInRange(day);
              const disabled = isDisabled(day);
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const isStart = date?.from && isSameDay(day, date.from);
              const isEnd = date?.to && isSameDay(day, date.to);

              return (
                <div key={day.toString()} className="h-9 w-9 relative">
                  {(inRange || isSelected(day)) && (
                     <div className={cn(
                       "absolute inset-0 bg-black/5",
                       isStart && !isEnd && date?.to ? "rounded-l-full" : "",
                       isEnd && !isStart ? "rounded-r-full" : "",
                       isStart && !date?.to ? "rounded-full" : ""
                     )} />
                  )}
                  <button
                    onClick={() => handleDayClick(day)}
                    disabled={disabled}
                    className={cn(
                      "relative flex h-9 w-9 items-center justify-center rounded-full text-sm transition-colors",
                      !isCurrentMonth && "text-muted-foreground/30",
                      disabled && "text-muted-foreground/30 cursor-not-allowed",
                      selected && "bg-black text-white font-bold hover:bg-black",
                      !selected && !disabled && isCurrentMonth && "hover:bg-muted font-medium text-foreground",
                      inRange && !selected && isCurrentMonth && "text-foreground font-medium"
                    )}
                  >
                    {format(day, 'd')}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
