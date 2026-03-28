'use client';

import { useState, useCallback } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { productFormSchema, ProductFormValues } from './schema';
import { TabbedEditLayout } from './tabbed-edit-layout';
import { Loader2 } from 'lucide-react';
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
  initialData?: Partial<ProductFormValues>;
  productId: string;
}

export function EditProductForm({ initialData, productId }: Props) {
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: initialData || {
      // Provide some fallback if needed
      status: 'draft',
      pricingMode: 'one_time',
      sizeMode: 'standard',
    },
    mode: 'onChange',
  });

  const onSubmit = useCallback(async (data: ProductFormValues) => {
    setIsSaving(true);
    try {
      // Simulate API call
      console.log('Update Data', productId, data);
      await new Promise((resolve) => setTimeout(resolve, 800));
      toast.success('Product updated successfully!');
    } catch (error) {
      console.error(error);
      toast.error('Failed to update product');
    } finally {
      setIsSaving(false);
    }
  }, [productId]);

  const handleSave = () => {
    form.handleSubmit(onSubmit, (errors) => {
      console.log('Validation Errors', errors);
      toast.error('Please fix validation errors before saving.');
    })();
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

  return (
    <FormProvider {...form}>
      <form onSubmit={(e) => e.preventDefault()} className="relative">
        <TabbedEditLayout onSave={handleSave} isSaving={isSaving}>
          {renderTabContent}
        </TabbedEditLayout>
      </form>
    </FormProvider>
  );
}
