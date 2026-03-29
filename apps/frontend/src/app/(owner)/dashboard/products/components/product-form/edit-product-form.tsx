'use client';

import { FormProvider } from 'react-hook-form';
import { useEditProduct } from '../../hooks/use-edit-product';
import { useUpdateProduct } from '../../hooks/use-update-product';
import { TabbedEditLayout } from './tabbed-edit-layout';
import { Loader2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';

// Steps imports
import { BasicInfoStep } from './steps/basic-info';
import { VariantsStep } from './steps/variants';
import { ImagesStep } from './steps/images';
import { PricingStep } from './steps/pricing';
import { SizeStep } from './steps/size';
import { ServicesStep } from './steps/services';
import { DetailsFAQStep } from './steps/details-faq';

interface Props {
  productId: string;
}

export function EditProductForm({ productId }: Props) {
  const { form, rawProduct, isLoading, isError, error } = useEditProduct(productId);
  const { mutate: updateProduct, isPending: isSaving } = useUpdateProduct(productId, rawProduct);

  const handleSave = () => {
    form.handleSubmit(
      (data) => {
        updateProduct(data);
      },
      (errors) => {
        console.log('Validation Errors', errors);
        // Find the first error message to show
        const firstError = Object.values(errors)[0];
        const message = Array.isArray(firstError)
          ? (firstError[0] as any)?.message || 'Validation error'
          : (firstError as any)?.message || 'Validation error';
        
        toast.error(`Please fix errors: ${message}`);
      },
    )();
  };

  const renderTabContent = (activeTab: string) => {
    switch (activeTab) {
      case 'basic': return <BasicInfoStep />;
      case 'variants': return <VariantsStep />;
      case 'images': return <ImagesStep />;
      case 'pricing': return <PricingStep />;
      case 'size': return <SizeStep />;
      case 'services': return <ServicesStep />;
      case 'details': return <DetailsFAQStep />;
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
        {isSaving && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/60 backdrop-blur-sm rounded-lg">
            <div className="flex flex-col items-center gap-4 p-8 bg-white rounded-xl shadow-xl border">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <div className="text-center">
                <p className="font-semibold text-lg">Saving Changes</p>
                <p className="text-sm text-muted-foreground">Please wait while we update the product...</p>
              </div>
            </div>
          </div>
        )}
        <TabbedEditLayout onSave={handleSave} isSaving={isSaving}>
          {renderTabContent}
        </TabbedEditLayout>
      </form>
    </FormProvider>
  );
}
