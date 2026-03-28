'use client';

import { useState } from 'react';
import { FormProvider } from 'react-hook-form';
import { useProductForm } from '../../hooks/use-product-form';
import { WizardLayout, WIZARD_STEPS } from './wizard-layout';

// Steps imports (mocked for now)
import { BasicInfoStep } from './steps/basic-info';
import { VariantsStep } from './steps/variants';
import { ImagesStep } from './steps/images';
import { PricingStep } from './steps/pricing';
import { SizeStep } from './steps/size';
import { ServicesStep } from './steps/services';
import { DetailsFAQStep } from './steps/details-faq';
import { ReviewStep } from './steps/review';
import { Loader2 } from 'lucide-react';

export function ProductFormWizard() {
  const { form, isLoaded, clearDraft } = useProductForm();
  const [currentStep, setCurrentStep] = useState(0);

  if (!isLoaded) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
      </div>
    );
  }

  const handleNext = async () => {
    // Validate current step before proceeding
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let fieldsToValidate: any[] = []; // temporarily any as TS doesn't easily infer paths with our nested form schema mapping
    
    switch (currentStep) {
      case 0: // Basic Info
        fieldsToValidate = ['name', 'categoryId', 'status', 'targetRentals'];
        break;
      case 1: // Variants
        fieldsToValidate = ['variants'];
        break;
      case 2: // Images
        fieldsToValidate = ['variants']; // we validate the images inside variants
        break;
      case 3: // Pricing
        fieldsToValidate = [
          'pricingMode', 'rentalPrice', 'includedDays', 'pricePerDay',
          'retailPrice', 'rentalPercentage', 'minPrice', 'maxDiscount'
        ];
        break;
      case 4: // Size
        fieldsToValidate = ['sizeMode', 'measurements'];
        break;
      case 5: // Services
        fieldsToValidate = ['securityDeposit', 'cleaningFee'];
        break;
      case 6: // Details & FAQ
        fieldsToValidate = ['details', 'faqs'];
        break;
      case 7: // Review
        // final submit
        form.handleSubmit(onSubmit)();
        return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const isValid = await form.trigger(fieldsToValidate as any);
    if (isValid && currentStep < WIZARD_STEPS.length - 1) {
      setCurrentStep(s => s + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) setCurrentStep(s => s - 1);
  };

  const handleStepClick = async (index: number) => {
    // Optional: allow jumping to earlier steps without validation
    if (index < currentStep) {
      setCurrentStep(index);
    } else {
      // Must validate to jump forward
      // Simplified: Just use Next button to go forward
    }
  };

  const onSubmit = async (data: unknown) => {
    console.log('Final Submit Data', data);
    // TODO: Connect to actual backend API via useCreateProduct
    // clearDraft();
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0: return <BasicInfoStep />;
      case 1: return <VariantsStep />;
      case 2: return <ImagesStep />;
      case 3: return <PricingStep />;
      case 4: return <SizeStep />;
      case 5: return <ServicesStep />;
      case 6: return <DetailsFAQStep />;
      case 7: return <ReviewStep />;
      default: return null;
    }
  };

  return (
    <FormProvider {...form}>
      <form onSubmit={(e) => e.preventDefault()}>
        <WizardLayout
          currentStep={currentStep}
          totalSteps={WIZARD_STEPS.length}
          onNext={handleNext}
          onPrev={handlePrev}
          onStepClick={handleStepClick}
        >
          {renderStep()}
        </WizardLayout>
      </form>
    </FormProvider>
  );
}
