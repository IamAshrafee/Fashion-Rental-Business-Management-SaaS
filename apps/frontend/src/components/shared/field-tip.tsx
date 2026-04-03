'use client';

import { Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface FieldTipProps {
  /** The tooltip help text */
  tip: string;
  /** Optional className for the icon wrapper */
  className?: string;
}

/**
 * A small (ℹ) icon that shows a tooltip on hover.
 * Place it next to a FormLabel for contextual help.
 *
 * Usage:
 * ```tsx
 * <FormLabel>
 *   Rental Price <FieldTip tip="The price customers pay for a single rental period." />
 * </FormLabel>
 * ```
 */
export function FieldTip({ tip, className }: FieldTipProps) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            tabIndex={-1}
            className={cn(
              'inline-flex items-center justify-center h-4 w-4 rounded-full text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted transition-colors ml-1 align-middle cursor-help',
              className
            )}
            onClick={(e) => e.preventDefault()} // don't submit form
          >
            <Info className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          align="center"
          className="max-w-[260px] text-xs leading-relaxed font-normal"
        >
          {tip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
