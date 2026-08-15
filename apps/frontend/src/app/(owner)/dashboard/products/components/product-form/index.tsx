'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { FormProvider, type FieldPath } from 'react-hook-form';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, LogOut, RotateCcw } from 'lucide-react';
import { useProductForm } from '../../hooks/use-product-form';
import { mapProductToFormValues } from '../../hooks/use-edit-product';
import { buildPricingPayload } from './pricing-payload';
import type { ProductFormValues } from './schema';
import { WizardLayout, WIZARD_STEPS } from './wizard-layout';
import { BasicInfoStep } from './steps/basic-info';
import { SizeStep } from './steps/size';
import { VariantsMediaStep } from './steps/variants';
import { ContentMediaStep } from './steps/content-media';
import { PricingServicesStep } from './steps/pricing-services';
import { ReviewStep } from './steps/review';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { getApiErrorMessage } from '@/lib/api-error';
import { productOnboardingApi, type ProductOnboarding } from '@/lib/api/products';
import { syncVariantImages } from '../../hooks/sync-variant-images';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const STEP_FIELDS: Record<number, FieldPath<ProductFormValues>[]> = {
  0: ['name', 'categoryId', 'productTypeId', 'sizeSchemaOverrideId'],
  1: ['variants'],
  2: ['details', 'faqs'],
  3: ['ratePlanType', 'ratePlanConfig', 'pricingComponents', 'shippingMode', 'flatShippingFee'],
  4: [],
};

function commandKey() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `product-command-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}

export function ProductFormWizard() {
  const {
    form,
    isLoaded,
    clearDraft,
    hasDraft,
    lastSavedAt: localSavedAt,
    forceSaveDraft,
    restoredStep,
    productId,
    creationKey,
    checkpointProduct,
    checkpointImage,
  } = useProductForm();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const requestedProductId = searchParams.get('productId');
  const activeProductId = requestedProductId ?? productId;
  const [onboarding, setOnboarding] = useState<ProductOnboarding | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [stepErrors, setStepErrors] = useState<Record<number, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const commandKeys = useRef<Record<number, string>>({});
  const hydratedProductId = useRef<string | null>(null);
  const hasRestoredLocalStep = useRef(false);

  const onboardingQuery = useQuery({
    queryKey: ['product-onboarding', activeProductId],
    queryFn: () => productOnboardingApi.get(activeProductId!),
    enabled: isLoaded && Boolean(activeProductId),
    retry: false,
  });

  const synchronizeServerIdentity = useCallback(
    (workflow: ProductOnboarding) => {
      const values = form.getValues('variants');
      for (const [index, localVariant] of values.entries()) {
        const serverVariant = workflow.product.variants.find(
          (variant) =>
            variant.onboardingKey === localVariant.clientKey || variant.id === localVariant.id,
        );
        if (!serverVariant) continue;
        form.setValue(`variants.${index}.id`, serverVariant.id, { shouldDirty: false });
        form.setValue(
          `variants.${index}.skuIdBySizeInstanceId`,
          Object.fromEntries(serverVariant.sizes.map((size) => [size.sizeInstanceId, size.id])),
          { shouldDirty: false },
        );
      }
    },
    [form],
  );

  useEffect(() => {
    const workflow = onboardingQuery.data;
    if (!workflow) return;
    setOnboarding(workflow);
    if (hydratedProductId.current !== workflow.productId) {
      if (requestedProductId || !hasDraft) {
        form.reset(mapProductToFormValues(workflow.product));
      }
      checkpointProduct(workflow.productId);
      hydratedProductId.current = workflow.productId;
      const sectionIndex = WIZARD_STEPS.findIndex(
        (step) => step.section === workflow.currentSection,
      );
      setCurrentStep(Math.max(0, sectionIndex));
    }
    synchronizeServerIdentity(workflow);
  }, [
    checkpointProduct,
    form,
    hasDraft,
    onboardingQuery.data,
    requestedProductId,
    synchronizeServerIdentity,
  ]);

  useEffect(() => {
    if (
      isLoaded &&
      !activeProductId &&
      !hasRestoredLocalStep.current &&
      restoredStep > 0 &&
      restoredStep < WIZARD_STEPS.length
    ) {
      setCurrentStep(restoredStep);
      hasRestoredLocalStep.current = true;
    }
  }, [activeProductId, isLoaded, restoredStep]);

  const computeStepErrors = useCallback(() => {
    const errors = form.formState.errors;
    const next: Record<number, number> = {};
    for (const [stepValue, fields] of Object.entries(STEP_FIELDS)) {
      const count = fields.reduce((total, field) => {
        const error = errors[field as keyof typeof errors];
        if (!error) return total;
        return total + (Array.isArray(error) ? error.filter(Boolean).length || 1 : 1);
      }, 0);
      if (count) next[Number(stepValue)] = count;
    }
    setStepErrors(next);
    return next;
  }, [form.formState.errors]);

  useEffect(() => {
    computeStepErrors();
  }, [computeStepErrors, form.formState.errors]);

  const validateCurrentStep = useCallback(async () => {
    if (currentStep === 1) {
      let missingImages = false;
      form.getValues('variants').forEach((variant, index) => {
        if (!variant.images.length) {
          form.setError(`variants.${index}.images` as FieldPath<ProductFormValues>, {
            type: 'manual',
            message: 'Add at least one storefront image.',
          });
          missingImages = true;
        }
      });
      if (missingImages) {
        toast({
          title: 'Storefront images required',
          description: 'Every variant needs at least one image before content can be completed.',
          variant: 'destructive',
        });
        return false;
      }
    }
    const fields = STEP_FIELDS[currentStep];
    const valid = fields.length === 0 ? true : await form.trigger(fields);
    if (!valid) {
      const count = computeStepErrors()[currentStep] ?? 1;
      toast({
        title: `${count} field${count === 1 ? '' : 's'} need attention`,
        description: 'Correct the highlighted information before continuing.',
        variant: 'destructive',
      });
      setTimeout(() => {
        document
          .querySelector('[data-invalid="true"], [aria-invalid="true"]')
          ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
    return valid;
  }, [computeStepErrors, currentStep, form, toast]);

  const syncProductImages = useCallback(async () => {
    const variants = form.getValues('variants');
    for (const [variantIndex, variant] of variants.entries()) {
      if (!variant.id || !UUID_PATTERN.test(variant.id)) {
        throw new Error('Save the SKU section before uploading variant images.');
      }
      await syncVariantImages({
        variantId: variant.id,
        images: variant.images,
        onUploaded: (imageIndex, uploaded) =>
          checkpointImage(variantIndex, imageIndex, uploaded),
      });
    }
  }, [checkpointImage, form]);

  const saveCurrentSection = useCallback(async (): Promise<ProductOnboarding> => {
    const values = form.getValues();
    const key = commandKeys.current[currentStep] ?? commandKey();
    commandKeys.current[currentStep] = key;
    let saved: ProductOnboarding;

    if (currentStep === 0) {
      const basics = {
        name: values.name,
        categoryId: values.categoryId,
        subcategoryId: values.subcategoryId || undefined,
        productTypeId: values.productTypeId,
        sizeSchemaOverrideId: values.sizeSchemaOverrideId || undefined,
        eventIds: values.events,
        countryOfOrigin: values.countryOfOrigin || undefined,
        countryOfOriginPublic: values.countryOfOriginPublic,
        referenceRetailValue: values.referenceRetailValue,
        referenceRetailValuePublic: values.referenceRetailValuePublic,
      };
      saved = onboarding
        ? await productOnboardingApi.saveBasics(
            onboarding.productId,
            { ...basics, expectedRevision: onboarding.revision },
            key,
          )
        : await productOnboardingApi.start(basics, creationKey);
      if (!onboarding) checkpointProduct(saved.productId);
    } else {
      if (!onboarding) throw new Error('Save product basics before continuing.');
      if (currentStep === 1) {
        saved = await productOnboardingApi.saveSkus(
          onboarding.productId,
          {
            expectedRevision: onboarding.revision,
            variants: values.variants.map((variant) => ({
              ...(variant.id && UUID_PATTERN.test(variant.id) ? { id: variant.id } : {}),
              clientKey: variant.clientKey,
              variantName: variant.name || undefined,
              mainColorId: variant.mainColorId,
              identicalColorIds: variant.identicalColorIds,
              sizes: variant.sizeInstanceIds.map((sizeInstanceId) => ({
                sizeInstanceId,
              })),
            })),
          },
          key,
        );
        synchronizeServerIdentity(saved);
        await syncProductImages();
      } else if (currentStep === 2) {
        saved = await productOnboardingApi.saveContent(
          onboarding.productId,
          {
            expectedRevision: onboarding.revision,
            description: values.description,
            faqs: values.faqs,
            details: values.details?.map((detail, sequence) => ({
              headerName: detail.header,
              sequence,
              entries: detail.items,
            })),
          },
          key,
        );
      } else if (currentStep === 3) {
        saved = await productOnboardingApi.savePricing(
          onboarding.productId,
          { expectedRevision: onboarding.revision, pricing: buildPricingPayload(values) },
          key,
        );
      } else {
        saved = await productOnboardingApi.publish(onboarding.productId, onboarding.revision, key);
      }
    }

    delete commandKeys.current[currentStep];
    setOnboarding(saved);
    synchronizeServerIdentity(saved);
    queryClient.setQueryData(['product-onboarding', saved.productId], saved);
    return saved;
  }, [
    checkpointProduct,
    creationKey,
    currentStep,
    form,
    onboarding,
    queryClient,
    synchronizeServerIdentity,
    syncProductImages,
  ]);

  const handleNext = useCallback(async () => {
    if (!(await validateCurrentStep())) return;
    setIsSubmitting(true);
    try {
      const saved = await saveCurrentSection();
      if (currentStep === WIZARD_STEPS.length - 1) {
        clearDraft();
        await queryClient.invalidateQueries({ queryKey: ['products'] });
        toast({
          title: 'Product published',
          description: 'The rental listing is live and ready for date-based bookings.',
        });
        router.push(`/dashboard/products/${saved.productId}/setup-complete?status=published`);
        return;
      }
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      forceSaveDraft(nextStep);
      toast({ title: 'Section saved', description: 'Your server draft is up to date.' });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      toast({
        title: 'Could not save this section',
        description: getApiErrorMessage(
          error,
          'Your input is still here. Correct the issue and retry.',
        ),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [
    clearDraft,
    currentStep,
    forceSaveDraft,
    queryClient,
    router,
    saveCurrentSection,
    toast,
    validateCurrentStep,
  ]);

  const handlePrev = useCallback(() => {
    if (currentStep === 0) return;
    const previous = currentStep - 1;
    setCurrentStep(previous);
    forceSaveDraft(previous);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentStep, forceSaveDraft]);

  const handleStepClick = useCallback(
    (index: number) => {
      if (index > currentStep) {
        toast({
          title: 'Save this section first',
          description: 'Forward sections unlock after the current section is saved.',
        });
        return;
      }
      setCurrentStep(index);
      forceSaveDraft(index);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [currentStep, forceSaveDraft, toast],
  );

  const handleForceSave = useCallback(async () => {
    if (currentStep === WIZARD_STEPS.length - 1) {
      forceSaveDraft(currentStep);
      toast({
        title: 'Everything is saved',
        description: 'Publish when you are ready to make the product visible.',
      });
      return;
    }
    if (!(await validateCurrentStep())) return;
    setIsSubmitting(true);
    try {
      await saveCurrentSection();
      forceSaveDraft(currentStep);
      toast({
        title: 'Server draft saved',
        description: 'This section can be resumed from another device.',
      });
    } catch (error) {
      toast({
        title: 'Could not save draft',
        description: getApiErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [currentStep, forceSaveDraft, saveCurrentSection, toast, validateCurrentStep]);

  const handleSaveAndExit = useCallback(async () => {
    if (currentStep === WIZARD_STEPS.length - 1) {
      forceSaveDraft(currentStep);
      router.push('/dashboard/products');
      return;
    }
    if (!(await validateCurrentStep())) return;
    setIsSubmitting(true);
    try {
      const saved = await saveCurrentSection();
      forceSaveDraft(currentStep);
      toast({
        title: 'Server draft saved',
        description: 'Continue setup from the product catalogue whenever you are ready.',
      });
      router.push('/dashboard/products');
      queryClient.setQueryData(['product-onboarding', saved.productId], saved);
    } catch (error) {
      toast({
        title: 'Could not save draft',
        description: getApiErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [
    currentStep,
    forceSaveDraft,
    queryClient,
    router,
    saveCurrentSection,
    toast,
    validateCurrentStep,
  ]);

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      if (event.key.toLowerCase() === 's') {
        event.preventDefault();
        void handleForceSave();
      }
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [handleForceSave]);

  if (!isLoaded || onboardingQuery.isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
      </div>
    );
  }

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-8">
            <BasicInfoStep />
            <Separator />
            <SizeStep />
          </div>
        );
      case 1:
        return <VariantsMediaStep showConfiguration showMedia />;
      case 2:
        return <ContentMediaStep />;
      case 3:
        return <PricingServicesStep />;
      case 4:
        return <ReviewStep onGoToStep={(step) => setCurrentStep(step)} />;
      default:
        return null;
    }
  };

  const lastSavedAt = onboarding ? new Date(onboarding.lastSavedAt) : localSavedAt;

  return (
    <FormProvider {...form}>
      <form onSubmit={(event) => event.preventDefault()} className="relative">
        {isSubmitting && (
          <div className="absolute inset-0 z-50 flex items-center justify-center rounded-lg bg-background/70 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3 rounded-xl border bg-card p-8 shadow-xl">
              <Loader2 className="h-9 w-9 animate-spin text-primary" />
              <p className="font-semibold">Saving authoritative product data…</p>
            </div>
          </div>
        )}

        {(hasDraft || onboarding) && currentStep === 0 && (
          <div className="mb-4 flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-amber-900">Resumable product setup</p>
              <p className="text-xs text-amber-700">
                {onboarding
                  ? `Server revision ${onboarding.revision}`
                  : 'Unsaved browser recovery draft'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {!onboarding && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    clearDraft();
                    setCurrentStep(0);
                  }}
                >
                  <RotateCcw className="h-4 w-4" /> Start fresh
                </Button>
              )}
              {onboarding && (
                <Button type="button" variant="outline" size="sm" asChild>
                  <Link href={`/dashboard/products/${onboarding.productId}`}>View product</Link>
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void handleSaveAndExit()}
              >
                <LogOut className="h-4 w-4" /> Save & exit
              </Button>
            </div>
          </div>
        )}

        <WizardLayout
          currentStep={currentStep}
          totalSteps={WIZARD_STEPS.length}
          onNext={() => void handleNext()}
          onPrev={handlePrev}
          onStepClick={handleStepClick}
          isSubmitting={isSubmitting}
          stepErrors={stepErrors}
          lastSavedAt={lastSavedAt}
          onForceSave={() => void handleForceSave()}
        >
          {renderStep()}
        </WizardLayout>
      </form>
    </FormProvider>
  );
}
