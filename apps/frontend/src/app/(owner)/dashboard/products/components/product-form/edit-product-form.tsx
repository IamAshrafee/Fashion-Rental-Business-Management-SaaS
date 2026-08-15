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
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { usePublishProduct, useUpdateProductStatus } from '../../hooks/use-product-apis';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

// Unified Steps imports
import { BasicInfoStep } from './steps/basic-info';
import { VariantsMediaStep } from './steps/variants';
import { PricingServicesStep } from './steps/pricing-services';
import { SizeDetailsStep } from './steps/size-details';
import type { ProductFormValues } from './schema';
import type { UploadedProductImage } from '@/lib/api/products';

const REQUIRED_PUBLISH_SECTIONS = ['BASICS', 'SKUS', 'CONTENT', 'PRICING'] as const;

/* ─── Validation mapping for error badges ────────────────────────────── */
const TAB_FIELDS: Record<EditTabId, string[]> = {
  basic: [
    'name',
    'description',
    'categoryId',
    'subcategoryId',
    'events',
    'countryOfOrigin',
    'referenceRetailValue',
  ],
  media: ['variants'],
  pricing: [
    'ratePlanType',
    'ratePlanConfig',
    'pricingComponents',
    'lateFeeEnabled',
    'lateFeeGraceHours',
    'lateFeeAmountMinor',
    'lateFeeCapMinor',
    'shippingMode',
    'flatShippingFee',
  ],
  size_details: [
    'sizeMode',
    'availableSizes',
    'mainDisplaySize',
    'freeSizeType',
    'measurements',
    'parts',
    'sizeChartUrl',
    'details',
    'faqs',
  ],
  publication: [],
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
  const checkpointImage = (
    variantIndex: number,
    imageIndex: number,
    uploaded: UploadedProductImage,
  ) => {
    form.setValue(`variants.${variantIndex}.images.${imageIndex}.id`, uploaded.id);
    form.setValue(
      `variants.${variantIndex}.images.${imageIndex}.url`,
      uploaded.thumbnailUrl || uploaded.url,
    );
    form.setValue(`variants.${variantIndex}.images.${imageIndex}.file`, undefined);
  };
  const { mutate: updateProduct, isPending: isSaving } = useUpdateProduct(
    productId,
    rawProduct,
    {
      onVariantSaved: (variantIndex, variantId) =>
        form.setValue(`variants.${variantIndex}.id`, variantId),
      onImageUploaded: checkpointImage,
    },
  );
  const statusMutation = useUpdateProductStatus();
  const publishMutation = usePublishProduct();

  const [activeTab, setActiveTab] = useState<EditTabId>('basic');
  const [tabErrors, setTabErrors] = useState<Record<EditTabId, boolean>>({
    basic: false,
    media: false,
    pricing: false,
    size_details: false,
    publication: false,
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
        basic: false,
        media: false,
        pricing: false,
        size_details: false,
        publication: false,
      };

      let firstErrorTab: EditTabId | null = null;

      for (const [tabId, fields] of Object.entries(TAB_FIELDS)) {
        const tId = tabId as EditTabId;
        const hasErr = fields.some((field) => errors[field as keyof typeof errors]);
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
    setTabErrors({
      basic: false,
      media: false,
      pricing: false,
      size_details: false,
      publication: false,
    });
    const data = form.getValues();
    updateProduct(data);
  };

  const renderTabContent = (tabId: EditTabId) => {
    if (!rawProduct) return null;
    switch (tabId) {
      case 'basic':
        return <BasicInfoStep />;
      case 'media':
        return <VariantsMediaStep />;
      case 'pricing':
        return <PricingServicesStep />;
      case 'size_details':
        return <SizeDetailsStep />;
      case 'publication':
        return (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-3 text-base">
                  Publication state
                  <Badge variant={rawProduct.status === 'published' ? 'default' : 'secondary'}>
                    {rawProduct.status}
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Catalog publication is separate from physical inventory. A published product may
                  have zero stock and will then appear unavailable.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {rawProduct.readiness.ready ? (
                  <Alert>
                    <AlertCircle className="size-4" />
                    <AlertDescription>
                      The catalog configuration is ready to publish.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Alert variant="destructive">
                    <AlertCircle className="size-4" />
                    <AlertDescription>
                      <p className="font-medium">
                        Resolve these catalog blockers before publishing:
                      </p>
                      <ul className="mt-2 list-disc pl-5">
                        {rawProduct.readiness.blockers.map((blocker, index) => (
                          <li key={`${blocker.section}-${blocker.field}-${index}`}>
                            {blocker.message}
                          </li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}
                <div className="flex flex-wrap gap-2">
                  {rawProduct.status === 'draft' ? (
                    <Button
                      type="button"
                      disabled={
                        !rawProduct.readiness.ready
                        || !rawProduct.onboarding
                        || !REQUIRED_PUBLISH_SECTIONS.every((section) =>
                          rawProduct.onboarding?.completedSections.includes(section),
                        )
                        || publishMutation.isPending
                      }
                      onClick={() => {
                        if (rawProduct.onboarding) {
                          publishMutation.mutate({
                            id: productId,
                            revision: rawProduct.onboarding.revision,
                          });
                        }
                      }}
                    >
                      {publishMutation.isPending ? <Loader2 className="animate-spin" /> : null}
                      Publish product
                    </Button>
                  ) : rawProduct.status === 'published' ? (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={statusMutation.isPending}
                      onClick={() => statusMutation.mutate({ id: productId, status: 'draft' })}
                    >
                      Unpublish to draft
                    </Button>
                  ) : null}
                  {rawProduct.status !== 'archived' ? (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          type="button"
                          variant="destructive"
                          disabled={statusMutation.isPending}
                        >
                          Archive product
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Archive this product?</AlertDialogTitle>
                          <AlertDialogDescription>
                            The product will be removed from the storefront and normal catalog
                            workflows. Existing bookings, physical items, financial records, and
                            operational history will remain intact. You can restore it later as a
                            draft.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Keep product</AlertDialogCancel>
                          <AlertDialogAction asChild>
                            <Button
                              type="button"
                              variant="destructive"
                              onClick={() =>
                                statusMutation.mutate({ id: productId, status: 'archived' })
                              }
                            >
                              Archive product
                            </Button>
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={statusMutation.isPending}
                      onClick={() => statusMutation.mutate({ id: productId, status: 'draft' })}
                    >
                      Restore as draft
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Save listing edits before changing publication state. Existing bookings, physical
                  items, and operational history are retained.
                </p>
              </CardContent>
            </Card>
          </div>
        );
      default:
        return null;
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
        {rawProduct.status !== 'draft' && (
          <Alert className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium text-foreground">
                  {rawProduct.status === 'published'
                    ? 'Unpublish before changing catalog structure'
                    : 'Restore this archived product before editing'}
                </p>
                <p className="text-xs">
                  Existing rentals remain intact. Catalog changes can only be saved while the
                  listing is a draft.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                disabled={statusMutation.isPending}
                onClick={() => statusMutation.mutate({ id: productId, status: 'draft' })}
              >
                {statusMutation.isPending ? <Loader2 className="animate-spin" /> : null}
                {rawProduct.status === 'published' ? 'Unpublish to edit' : 'Restore to edit'}
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
                <p className="text-sm text-muted-foreground">
                  Please wait while we update the product...
                </p>
              </div>
            </div>
          </div>
        )}
        <TabbedEditLayout
          onSave={handleSave}
          isSaving={isSaving}
          saveDisabled={rawProduct.status !== 'draft'}
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
