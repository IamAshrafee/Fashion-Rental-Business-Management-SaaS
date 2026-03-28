import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export const WIZARD_STEPS = [
  'Basic Info',
  'Variants',
  'Images',
  'Pricing',
  'Size',
  'Services',
  'Details',
  'Review',
] as const;

export type WizardStep = (typeof WIZARD_STEPS)[number];

interface Props {
  currentStep: number;
  totalSteps: number;
  onNext: () => void;
  onPrev: () => void;
  onStepClick: (index: number) => void;
  children: ReactNode;
  isNextDisabled?: boolean;
}

export function WizardLayout({
  currentStep,
  totalSteps,
  onNext,
  onPrev,
  onStepClick,
  children,
  isNextDisabled,
}: Props) {
  const isLast = currentStep === totalSteps - 1;
  const isFirst = currentStep === 0;

  return (
    <div className="flex flex-col space-y-8">
      {/* Step Indicator Sidebar or Top bar */}
      <div className="relative">
        <div className="absolute top-1/2 left-0 w-full h-0.5 bg-muted -translate-y-1/2 z-0 hidden sm:block">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${(currentStep / (totalSteps - 1)) * 100}%` }}
          />
        </div>

        <ul className="relative z-10 flex justify-between gap-2 overflow-x-auto pb-4 sm:pb-0 px-2 sm:px-0">
          {WIZARD_STEPS.map((step, index) => {
            const isActive = index === currentStep;
            const isCompleted = index < currentStep;

            return (
              <li key={step} className="flex relative items-center gap-2">
                <button
                  type="button"
                  onClick={() => onStepClick(index)}
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ring-2 ring-background shrink-0',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : isCompleted
                      ? 'bg-primary/20 text-primary hover:bg-primary/30'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  )}
                >
                  {index + 1}
                </button>
                <span
                  className={cn(
                    'hidden sm:block text-sm font-medium whitespace-nowrap',
                    isActive
                      ? 'text-foreground'
                      : isCompleted
                      ? 'text-foreground/80'
                      : 'text-muted-foreground'
                  )}
                >
                  {step}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Content */}
      <div className="min-h-[500px] bg-card border rounded-lg p-6 shadow-sm">
        {children}
      </div>

      {/* Actions */}
      <div className="flex justify-between items-center pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onPrev}
          disabled={isFirst}
        >
          Previous
        </Button>
        <Button
          type="button"
          onClick={onNext}
          disabled={isNextDisabled}
        >
          {isLast ? 'Publish Product' : 'Next Step'}
        </Button>
      </div>
    </div>
  );
}
