import Link from 'next/link';
import { Check, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { BookingStatus } from '../../types';
import {
  BOOKING_WORKFLOW_STAGES,
  getBookingWorkflowState,
} from '../../components/booking-workflow';

export function BookingWorkflowCard({ status }: { status: BookingStatus }) {
  const state = getBookingWorkflowState(status);

  return (
    <Card className="border-primary/20 bg-primary/5 shadow-none">
      <CardHeader className="gap-2 pb-3">
        <CardTitle className="text-base">{state.title}</CardTitle>
        <CardDescription>{state.description}</CardDescription>
      </CardHeader>
      {!state.cancelled && (
        <CardContent className="space-y-4 pt-0">
          <ol className="grid gap-2 sm:grid-cols-3 xl:grid-cols-6" aria-label="Rental workflow">
            {BOOKING_WORKFLOW_STAGES.map((stage, index) => {
              const complete = index < state.currentStage;
              const current = index === state.currentStage;
              return (
                <li key={stage} className={cn(
                  'flex min-w-0 items-center gap-2 rounded-md border px-2.5 py-2 text-xs',
                  current && 'border-primary bg-background font-semibold text-foreground',
                  complete && 'border-primary/30 bg-background/60 text-foreground',
                  !current && !complete && 'border-transparent bg-muted/50 text-muted-foreground',
                )}>
                  <span className={cn(
                    'flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px]',
                    current && 'border-primary bg-primary text-primary-foreground',
                    complete && 'border-primary/30 bg-background text-primary',
                  )}>
                    {complete ? <Check className="size-3" /> : index + 1}
                  </span>
                  <span className="truncate">{stage}</span>
                </li>
              );
            })}
          </ol>
          {state.actionHref && state.actionLabel && (
            <Button variant="outline" size="sm" asChild>
              <Link href={state.actionHref}>
                {state.actionLabel}
                <ChevronRight data-icon="inline-end" />
              </Link>
            </Button>
          )}
        </CardContent>
      )}
    </Card>
  );
}
