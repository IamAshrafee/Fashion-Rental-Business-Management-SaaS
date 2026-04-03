'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { FormProvider } from 'react-hook-form';
import { useProductForm } from '../../hooks/use-product-form';
import { useSubmitProduct } from '../../hooks/use-submit-product';
import { WizardLayout, WIZARD_STEPS } from './wizard-layout';
import { useRouter } from 'next/navigation';

// Step imports
import { BasicInfoStep } from './steps/basic-info';
import { VariantsMediaStep } from './steps/variants';
import { PricingServicesStep } from './steps/pricing-services';
import { SizeDetailsStep } from './steps/size-details';
import { ReviewStep } from './steps/review';
import { Loader2, RotateCcw, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

/* ─── Validation field groups for each step ────────────────────────────── */
const STEP_FIELDS: Record<number, string[]> = {
  0: ['name', 'categoryId', 'status'],
  1: ['variants'],
  2: [
    'pricingMode', 'rentalPrice', 'includedDays', 'pricePerDay',
    'retailPrice', 'rentalPercentage', 'minPrice', 'maxDiscount',
    'securityDeposit', 'cleaningFee',
  ],
  3: ['sizeMode', 'measurements', 'details', 'faqs'],
  4: [], // Review — full validation on submit
};

/* ─── Main Component ───────────────────────────────────────────────────── */
export function ProductFormWizard() {
  const { form, isLoaded, clearDraft, hasDraft, lastSavedAt, forceSaveDraft, restoredStep } = useProductForm();
  const [currentStep, setCurrentStep] = useState(0);
  const [stepErrors, setStepErrors] = useState<Record<number, number>>({});
  const { mutate: submitProduct, isPending: isSubmitting } = useSubmitProduct(clearDraft);
  const router = useRouter();
  const { toast } = useToast();
  const hasRestoredRef = useRef(false);

  // Restore step from draft on initial load
  useEffect(() => {
    if (isLoaded && !hasRestoredRef.current && restoredStep > 0 && restoredStep < WIZARD_STEPS.length) {
      setCurrentStep(restoredStep);
      hasRestoredRef.current = true;
    }
  }, [isLoaded, restoredStep]);

  /* ── Compute errors per step ──────────────────────────────────────── */
  const computeStepErrors = useCallback(() => {
    const errors = form.formState.errors;
    const errorMap: Record<number, number> = {};
    
    const countFieldErrors = (fields: string[]): number => {
      let count = 0;
      for (const field of fields) {
        const err = errors[field as keyof typeof errors];
        if (err) {
          if (Array.isArray(err)) {
            // Array fields like variants, measurements
            count += err.filter(Boolean).length || 1;
          } else {
            count += 1;
          }
        }
      }
      return count;
    };

    for (const [stepStr, fields] of Object.entries(STEP_FIELDS)) {
      const step = Number(stepStr);
      const count = countFieldErrors(fields);
      if (count > 0) errorMap[step] = count;
    }

    setStepErrors(errorMap);
    return errorMap;
  }, [form.formState.errors]);

  // Re-compute errors when form errors change
  useEffect(() => {
    computeStepErrors();
  }, [form.formState.errors, computeStepErrors]);

  /* ── Step validation + navigation ─────────────────────────────────── */
  const validateCurrentStep = useCallback(async (): Promise<boolean> => {
    // Step 1 (Variants & Media) — also check images manually
    if (currentStep === 1) {
      const variants = form.getValues('variants');
      let hasImageError = false;
      variants.forEach((v, i) => {
        if (!v.images || v.images.length === 0) {
          form.setError(`variants.${i}.images` as any, {
            type: 'manual',
            message: 'At least one image is required per variant',
          });
          hasImageError = true;
        }
      });
      if (hasImageError) {
        toast({
          title: 'Missing images',
          description: 'Each variant needs at least 1 image. Expand the images section to upload.',
          variant: 'destructive',
        });
        return false;
      }
    }

    const fields = STEP_FIELDS[currentStep] || [];
    if (fields.length === 0) return true;
    
    const isValid = await form.trigger(fields as any);
    if (!isValid) {
      const errMap = computeStepErrors();
      const errCount = errMap[currentStep] || 0;
      toast({
        title: `${errCount} field${errCount > 1 ? 's' : ''} need${errCount === 1 ? 's' : ''} attention`,
        description: 'Fix the highlighted errors to continue.',
        variant: 'destructive',
      });
      // Scroll to first error
      setTimeout(() => {
        const firstErrorEl = document.querySelector('[data-invalid="true"], [aria-invalid="true"]');
        firstErrorEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
    return isValid;
  }, [currentStep, form, toast, computeStepErrors]);

  const handleNext = useCallback(async () => {
    if (currentStep === WIZARD_STEPS.length - 1) {
      // Final submit
      const allValid = await form.trigger();
      if (!allValid) {
        computeStepErrors();
        toast({
          title: 'Form has errors',
          description: 'Please fix all errors before publishing.',
          variant: 'destructive',
        });
        return;
      }
      form.handleSubmit(onSubmit)();
      return;
    }

    const valid = await validateCurrentStep();
    if (valid) {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      // Save current step position for draft resume
      forceSaveDraft(nextStep);
      // Scroll to top of content area
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentStep, form, validateCurrentStep, forceSaveDraft, computeStepErrors, toast]);

  const handlePrev = useCallback(() => {
    if (currentStep > 0) {
      const prevStep = currentStep - 1;
      setCurrentStep(prevStep);
      forceSaveDraft(prevStep);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentStep, forceSaveDraft]);

  const handleStepClick = useCallback((index: number) => {
    // Allow free navigation in any direction
    if (index !== currentStep) {
      setCurrentStep(index);
      forceSaveDraft(index);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentStep, forceSaveDraft]);

  const onSubmit = useCallback(async (data: unknown) => {
    submitProduct(data as any);
  }, [submitProduct]);

  const handleForceSave = useCallback(() => {
    forceSaveDraft(currentStep);
    toast({
      title: 'Draft saved',
      description: 'Your progress has been saved.',
    });
  }, [forceSaveDraft, currentStep, toast]);

  const handleSaveAndExit = useCallback(() => {
    forceSaveDraft(currentStep);
    toast({
      title: 'Draft saved',
      description: 'You can resume editing anytime.',
    });
    router.push('/dashboard/products');
  }, [forceSaveDraft, currentStep, toast, router]);

  /* ── Keyboard shortcuts ───────────────────────────────────────────── */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input/textarea
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          handleNext();
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          handlePrev();
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (currentStep === WIZARD_STEPS.length - 1) {
            handleNext(); // triggers submit
          }
        } else if (e.key === 's' || e.key === 'S') {
          e.preventDefault();
          handleForceSave();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNext, handlePrev, handleForceSave, currentStep]);

  /* ── Loading state ────────────────────────────────────────────────── */
  if (!isLoaded) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
      </div>
    );
  }

  /* ── Step renderer ────────────────────────────────────────────────── */
  const renderStep = () => {
    switch (currentStep) {
      case 0: return <BasicInfoStep />;
      case 1: return <VariantsMediaStep />;
      case 2: return <PricingServicesStep />;
      case 3: return <SizeDetailsStep />;
      case 4: return <ReviewStep onGoToStep={(step) => { setCurrentStep(step); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />;
      default: return null;
    }
  };

  return (
    <FormProvider {...form}>
      <form onSubmit={(e) => e.preventDefault()} className="relative">
        {/* Submitting overlay */}
        {isSubmitting && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/60 dark:bg-black/40 backdrop-blur-sm rounded-lg">
            <div className="flex flex-col items-center gap-4 p-8 bg-white dark:bg-card rounded-xl shadow-xl border">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <div className="text-center">
                <p className="font-semibold text-lg">Processing Product</p>
                <p className="text-sm text-muted-foreground">Uploading images & saving data...</p>
              </div>
            </div>
          </div>
        )}

        {/* Draft restoration banner */}
        {hasDraft && currentStep === 0 && (
          <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800/50 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300">You have a saved draft</p>
              {lastSavedAt && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                  Last saved: {lastSavedAt.toLocaleString()}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-amber-700 border-amber-300 hover:bg-amber-100 dark:text-amber-300 dark:border-amber-700 min-h-[36px]"
                onClick={() => {
                  clearDraft();
                  setCurrentStep(0);
                }}
              >
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                Start Fresh
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-[36px]"
                onClick={handleSaveAndExit}
              >
                <LogOut className="mr-1.5 h-3.5 w-3.5" />
                Save & Exit
              </Button>
            </div>
          </div>
        )}

        <WizardLayout
          currentStep={currentStep}
          totalSteps={WIZARD_STEPS.length}
          onNext={handleNext}
          onPrev={handlePrev}
          onStepClick={handleStepClick}
          isSubmitting={isSubmitting}
          stepErrors={stepErrors}
          lastSavedAt={lastSavedAt}
          onForceSave={handleForceSave}
        >
          {renderStep()}
        </WizardLayout>
      </form>
    </FormProvider>
  );
}
