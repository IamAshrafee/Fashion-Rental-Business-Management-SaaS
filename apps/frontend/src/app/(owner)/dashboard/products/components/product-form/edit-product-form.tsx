'use client';

import { useState } from 'react';
import { FormProvider } from 'react-hook-form';
import type { FieldPath } from 'react-hook-form';
import { useEditProduct } from '../../hooks/use-edit-product';
import { useUpdateProduct } from '../../hooks/use-update-product';
import { TabbedEditLayout, EditTabId } from './tabbed-edit-layout';
import { Loader2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useUpdateProductStatus } from '../../hooks/use-product-apis';

// Unified Steps imports
import { BasicInfoStep } from './steps/basic-info';
import { VariantsMediaStep } from './steps/variants';
import { PricingServicesStep } from './steps/pricing-services';
import { SizeDetailsStep } from './steps/size-details';
import type { ProductFormValues } from './schema';

/* ─── Validation mapping for error badges ────────────────────────────── */
const TAB_FIELDS: Record<EditTabId, string[]> = {
  basic: ['name', 'description', 'categoryId', 'subcategoryId', 'events', 'status', 'purchaseDate', 'purchasePrice', 'itemCountry', 'targetRentals'],
  media: ['variants'],
  pricing: [
    'ratePlanType', 'ratePlanConfig', 'pricingComponents',
    'lateFeeEnabled', 'lateFeeGraceHours', 'lateFeeAmountMinor', 'lateFeeCapMinor',
    'shippingMode', 'flatShippingFee',
  ],
  size_details: [
    'sizeMode', 'availableSizes', 'mainDisplaySize', 'freeSizeType', 'measurements', 'parts', 'sizeChartUrl',
    'details', 'faqs'
  ],
};

interface Props {
  productId: string;
}

function findErrorMessage(error: unknown): string | undefined {
  if (Array.isArray(error)) {
    for (const item of error) {
      const message = findErrorMessage(item);
      if (message) return message;
    }
    return undefined;
  }
  if (!error || typeof error !== 'object') return undefined;
  const record = error as Record<string, unknown>;
  if (typeof record.message === 'string') return record.message;
  for (const value of Object.values(record)) {
    const message = findErrorMessage(value);
    if (message) return message;
  }
  return undefined;
}

export function EditProductForm({ productId }: Props) {
  const { form, rawProduct, isLoading, isError, error } = useEditProduct(productId);
  const { mutate: updateProduct, isPending: isSaving } = useUpdateProduct(productId, rawProduct);
  const statusMutation = useUpdateProductStatus();

  const [activeTab, setActiveTab] = useState<EditTabId>('basic');
  const [tabErrors, setTabErrors] = useState<Record<EditTabId, boolean>>({
    basic: false, media: false, pricing: false, size_details: false
  });

  const handleSave = async () => {
    // 1. Manually check if variants have images (since it's a cross-field logic requirement)
    const variants = form.getValues('variants');
    let hasImageError = false;
    variants?.forEach((v, i) => {
      if (!v.images || v.images.length === 0) {
        form.setError(`variants.${i}.images` as FieldPath<ProductFormValues>, {
          type: 'manual',
          message: 'At least one image is required per variant',
        });
        hasImageError = true;
      }
    });

    // 2. Trigger full form validation
    const isValid = await form.trigger();

    if (!isValid || hasImageError) {
      const errors = form.formState.errors;
      // Map errors to their respective tabs
      const newTabErrors: Record<EditTabId, boolean> = {
        basic: false, media: false, pricing: false, size_details: false
      };
      
      let firstErrorTab: EditTabId | null = null;

      for (const [tabId, fields] of Object.entries(TAB_FIELDS)) {
        const tId = tabId as EditTabId;
        const hasErr = fields.some(field => errors[field as keyof typeof errors]);
        if (hasErr) {
          newTabErrors[tId] = true;
          if (!firstErrorTab) firstErrorTab = tId;
        }
      }

      // Explicitly check for manual image errors if trigger() missed it
      if (hasImageError) {
        newTabErrors.media = true;
        if (!firstErrorTab) firstErrorTab = 'media';
      }

      setTabErrors(newTabErrors);

      // Auto-switch to the first tab that has an error
      if (firstErrorTab && firstErrorTab !== activeTab) {
        setActiveTab(firstErrorTab);
      }

      // Find the first error message to show in toast
      const firstError = Object.values(errors)[0];
      let message = 'Please fix the highlighted errors before saving.';
      if (firstError) {
        message = findErrorMessage(firstError) || message;
      } else if (hasImageError) {
        message = 'Each variant needs at least 1 image.';
      }

      toast.error(`Error: ${message}`);
      return; // Stop submission
    }

    // 3. If valid, clear errors and submit
    setTabErrors({ basic: false, media: false, pricing: false, size_details: false });
    const data = form.getValues();
    updateProduct(data);
  };

  const renderTabContent = (tabId: EditTabId) => {
    switch (tabId) {
      case 'basic': return <BasicInfoStep />;
      case 'media': return <VariantsMediaStep />;
      case 'pricing': return <PricingServicesStep />;
      case 'size_details': return <SizeDetailsStep />;
      default: return null;
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
          <p className="text-sm text-muted-foreground">Loading product data...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (isError || !rawProduct) {
    return (
      <Alert variant="destructive" className="m-6">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Failed to load product. {(error as Error)?.message || 'Please try again.'}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <FormProvider {...form}>
      <form onSubmit={(e) => e.preventDefault()} className="relative">
        {rawProduct.status === 'published' && (
          <Alert className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium text-foreground">Unpublish before changing catalog structure</p>
                <p className="text-xs">
                  Existing rentals remain intact. The listing stays in draft until all changes pass the publication check.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                disabled={statusMutation.isPending}
                onClick={() => statusMutation.mutate({ id: productId, status: 'draft' })}
              >
                {statusMutation.isPending ? <Loader2 className="animate-spin" /> : null}
                Unpublish to edit
              </Button>
            </AlertDescription>
          </Alert>
        )}
        {isSaving && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/60 dark:bg-black/40 backdrop-blur-sm rounded-lg">
            <div className="flex flex-col items-center gap-4 p-8 bg-white dark:bg-card rounded-xl shadow-xl border">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <div className="text-center">
                <p className="font-semibold text-lg">Saving Changes</p>
                <p className="text-sm text-muted-foreground">Please wait while we update the product...</p>
              </div>
            </div>
          </div>
        )}
        <TabbedEditLayout 
          onSave={handleSave} 
          isSaving={isSaving}
          saveDisabled={rawProduct.status === 'published'}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          tabErrors={tabErrors}
        >
          {renderTabContent}
        </TabbedEditLayout>
      </form>
    </FormProvider>
  );
}
