'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Package,
  Palette,
  DollarSign,
  Ruler,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Save,
  Clock,
} from 'lucide-react';

/* ─── Step Definitions ─────────────────────────────────────────────────── */
export const WIZARD_STEPS = [
  { label: 'Product Info', icon: Package, shortLabel: 'Info' },
  { label: 'Variants & Media', icon: Palette, shortLabel: 'Media' },
  { label: 'Pricing & Fees', icon: DollarSign, shortLabel: 'Pricing' },
  { label: 'Size & Details', icon: Ruler, shortLabel: 'Size' },
  { label: 'Review', icon: CheckCircle2, shortLabel: 'Review' },
] as const;

export type WizardStep = (typeof WIZARD_STEPS)[number];

/* ─── Props ────────────────────────────────────────────────────────────── */
interface Props {
  currentStep: number;
  totalSteps: number;
  onNext: () => void;
  onPrev: () => void;
  onStepClick: (index: number) => void;
  children: ReactNode;
  isNextDisabled?: boolean;
  isSubmitting?: boolean;
  stepErrors?: Record<number, number>; // stepIndex → error count
  lastSavedAt?: Date | null;
  onForceSave?: () => void;
}

/* ─── Time Formatter ───────────────────────────────────────────────────── */
function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 10) return 'Just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

/* ─── Component ────────────────────────────────────────────────────────── */
export function WizardLayout({
  currentStep,
  totalSteps,
  onNext,
  onPrev,
  onStepClick,
  children,
  isNextDisabled,
  isSubmitting,
  stepErrors = {},
  lastSavedAt,
  onForceSave,
}: Props) {
  const isLast = currentStep === totalSteps - 1;
  const isFirst = currentStep === 0;
  const progressPercent = Math.round((currentStep / (totalSteps - 1)) * 100);
  const totalErrors = Object.values(stepErrors).reduce((sum, n) => sum + n, 0);

  return (
    <div className="flex flex-col">
      {/* ── Progress Bar (thin, top) ──────────────────────────────── */}
      <div className="w-full h-1 bg-muted rounded-full overflow-hidden mb-6">
        <div
          className="h-full bg-primary transition-all duration-500 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* ── Step Indicator — Desktop ──────────────────────────────── */}
      <nav className="hidden sm:block mb-8" aria-label="Wizard steps">
        <ol className="flex items-center justify-between gap-1">
          {WIZARD_STEPS.map((step, index) => {
            const Icon = step.icon;
            const isActive = index === currentStep;
            const isCompleted = index < currentStep;
            const errorCount = stepErrors[index] ?? 0;
            const hasErrors = errorCount > 0;

            return (
              <li key={step.label} className="flex-1 relative">
                {/* Connector line */}
                {index > 0 && (
                  <div className="absolute top-5 -left-1/2 w-full h-0.5 -z-10">
                    <div className={cn('h-full transition-colors', index <= currentStep ? 'bg-primary' : 'bg-muted')} />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => onStepClick(index)}
                  className={cn(
                    'flex flex-col items-center gap-1.5 w-full group outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded-lg p-2 transition-colors',
                    isActive && 'text-primary',
                    isCompleted && !hasErrors && 'text-primary/80',
                    !isActive && !isCompleted && 'text-muted-foreground',
                  )}
                >
                  {/* Circle */}
                  <div className="relative">
                    <div
                      className={cn(
                        'flex h-10 w-10 items-center justify-center rounded-full transition-all ring-2 ring-background',
                        isActive
                          ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25'
                          : isCompleted && !hasErrors
                          ? 'bg-primary/15 text-primary'
                          : hasErrors
                          ? 'bg-destructive/15 text-destructive ring-destructive/20'
                          : 'bg-muted text-muted-foreground group-hover:bg-muted/80',
                      )}
                    >
                      {isCompleted && !hasErrors ? (
                        <CheckCircle2 className="h-5 w-5" />
                      ) : (
                        <Icon className="h-5 w-5" />
                      )}
                    </div>
                    {/* Error badge */}
                    {hasErrors && (
                      <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold shadow-sm">
                        {errorCount}
                      </span>
                    )}
                  </div>
                  {/* Label */}
                  <span className={cn(
                    'text-xs font-medium whitespace-nowrap transition-colors',
                    isActive ? 'text-foreground' : 'text-muted-foreground',
                    hasErrors && 'text-destructive',
                  )}>
                    {step.label}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      {/* ── Step Indicator — Mobile ───────────────────────────────── */}
      <div className="sm:hidden mb-6">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onPrev}
            disabled={isFirst}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground disabled:opacity-30 min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="text-center">
            <div className="flex items-center justify-center gap-2">
              {(() => { const Icon = WIZARD_STEPS[currentStep].icon; return <Icon className="h-4 w-4 text-primary" />; })()}
              <span className="font-medium text-sm">{WIZARD_STEPS[currentStep].label}</span>
              {(stepErrors[currentStep] ?? 0) > 0 && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold">
                  {stepErrors[currentStep]}
                </span>
              )}
            </div>
            <span className="text-xs text-muted-foreground mt-0.5 block">
              Step {currentStep + 1} of {totalSteps}
            </span>
          </div>
          <button
            type="button"
            onClick={onNext}
            disabled={isLast || isNextDisabled}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground disabled:opacity-30 min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
        {/* Mobile step dots */}
        <div className="flex items-center justify-center gap-1.5 mt-3">
          {WIZARD_STEPS.map((_, idx) => {
            const hasErr = (stepErrors[idx] ?? 0) > 0;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => onStepClick(idx)}
                className={cn(
                  'h-2 rounded-full transition-all min-w-[8px]',
                  idx === currentStep ? 'w-6 bg-primary' : 'w-2',
                  idx < currentStep && !hasErr && 'bg-primary/40',
                  idx > currentStep && !hasErr && 'bg-muted',
                  hasErr && 'bg-destructive',
                )}
              />
            );
          })}
        </div>
      </div>

      {/* ── Content ───────────────────────────────────────────────── */}
      <div className="min-h-[450px] bg-card border rounded-lg p-4 sm:p-6 shadow-sm">
        {children}
      </div>

      {/* ── Sticky Footer Bar ─────────────────────────────────────── */}
      <div className="sticky bottom-0 z-20 mt-6 -mx-1 px-1">
        <div className="flex items-center justify-between bg-background/95 backdrop-blur-sm border rounded-lg p-3 sm:p-4 shadow-lg">
          {/* Left: Draft info */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground min-w-0">
            {lastSavedAt ? (
              <button
                type="button"
                onClick={onForceSave}
                className="flex items-center gap-1.5 hover:text-foreground transition-colors min-h-[36px] px-2 rounded"
                title="Click to save now (Ctrl+S)"
              >
                <Clock className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden sm:inline truncate">Saved {formatTimeAgo(lastSavedAt)}</span>
                <span className="sm:hidden">Saved</span>
              </button>
            ) : (
              onForceSave && (
                <button
                  type="button"
                  onClick={onForceSave}
                  className="flex items-center gap-1.5 hover:text-foreground transition-colors min-h-[36px] px-2 rounded"
                >
                  <Save className="h-3.5 w-3.5 shrink-0" />
                  <span className="hidden sm:inline">Save draft</span>
                </button>
              )
            )}
            {totalErrors > 0 && (
              <span className="flex items-center gap-1 text-destructive font-medium ml-2">
                <AlertCircle className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{totalErrors} error{totalErrors > 1 ? 's' : ''}</span>
              </span>
            )}
          </div>

          {/* Right: Nav buttons */}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onPrev}
              disabled={isFirst}
              className="min-h-[44px] min-w-[44px] sm:min-w-[100px]"
            >
              <ChevronLeft className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Previous</span>
            </Button>
            <Button
              type="button"
              onClick={onNext}
              disabled={isNextDisabled || isSubmitting}
              className={cn(
                'min-h-[44px] min-w-[44px] sm:min-w-[140px]',
                isLast && 'bg-emerald-600 hover:bg-emerald-700 text-white',
              )}
            >
              {isLast ? (
                <>
                  <CheckCircle2 className="h-4 w-4 sm:mr-1" />
                  <span className="hidden sm:inline">Publish Product</span>
                  <span className="sm:hidden">Publish</span>
                </>
              ) : (
                <>
                  <span className="hidden sm:inline">Next Step</span>
                  <span className="sm:hidden">Next</span>
                  <ChevronRight className="h-4 w-4 sm:ml-1" />
                </>
              )}
            </Button>
          </div>
        </div>
        {/* Keyboard hint */}
        <div className="hidden sm:flex items-center justify-center gap-4 text-[10px] text-muted-foreground/60 mt-1.5">
          <span><kbd className="px-1 py-0.5 rounded border text-[9px]">Ctrl</kbd>+<kbd className="px-1 py-0.5 rounded border text-[9px]">←→</kbd> Navigate</span>
          <span><kbd className="px-1 py-0.5 rounded border text-[9px]">Ctrl</kbd>+<kbd className="px-1 py-0.5 rounded border text-[9px]">Enter</kbd> Submit</span>
          <span><kbd className="px-1 py-0.5 rounded border text-[9px]">Ctrl</kbd>+<kbd className="px-1 py-0.5 rounded border text-[9px]">S</kbd> Save draft</span>
        </div>
      </div>
    </div>
  );
}
