import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { productFormSchema, ProductFormValues } from '../components/product-form/schema';

const STORAGE_KEY = 'fashionRental_newProductDraft';

const defaultValues: Partial<ProductFormValues> = {
  status: 'draft',
  events: [],
  showPurchasePrice: false,
  showCountry: false,
  variants: [
    {
      name: '',
      mainColorId: '',
      identicalColorIds: [],
      images: [],
    },
  ],
  pricingMode: 'one_time',
  minimumDays: 1,
  lateFeeType: 'fixed',
  shippingMode: 'free',
  sizeMode: 'standard',
  measurements: [],
  enableBackupSize: false,
  enableTryOn: false,
  creditTryOnFee: false,
  details: [],
  faqs: [],
};

export function useProductForm() {
  const [isLoaded, setIsLoaded] = useState(false);

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues,
    mode: 'onChange',
  });

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        form.reset({ ...defaultValues, ...parsed });
      } catch (e) {
        console.error('Failed to parse saved product draft', e);
      }
    }
    setIsLoaded(true);
  }, [form]);

  // Auto-save to localStorage on change
  useEffect(() => {
    if (!isLoaded) return;
    const subscription = form.watch((value) => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    });
    return () => subscription.unsubscribe();
  }, [form, isLoaded]);

  const clearDraft = () => {
    localStorage.removeItem(STORAGE_KEY);
    form.reset(defaultValues);
  };

  return { form, isLoaded, clearDraft };
}
