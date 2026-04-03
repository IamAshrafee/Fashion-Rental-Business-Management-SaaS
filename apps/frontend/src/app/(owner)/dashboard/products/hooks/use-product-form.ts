import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { productFormSchema, ProductFormValues } from '../components/product-form/schema';

const STORAGE_KEY = 'fashionRental_newProductDraft';
// Bump this version whenever the form schema changes to auto-invalidate old drafts
const DRAFT_VERSION = 2;

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
  availableSizes: [],
  measurements: [],
  parts: [],
  enableBackupSize: false,
  enableTryOn: false,
  creditTryOnFee: false,
  details: [],
  faqs: [],
};

export function useProductForm() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);

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
        // Only restore if the draft version matches
        if (parsed._draftVersion === DRAFT_VERSION) {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { _draftVersion, ...formData } = parsed;
          form.reset({ ...defaultValues, ...formData });
          setHasDraft(true);
        } else {
          // Stale draft — discard it
          console.warn('Discarding stale product draft (version mismatch)');
          localStorage.removeItem(STORAGE_KEY);
        }
      } catch (e) {
        console.error('Failed to parse saved product draft', e);
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    setIsLoaded(true);
  }, [form]);

  // Auto-save to localStorage on change
  useEffect(() => {
    if (!isLoaded) return;
    const subscription = form.watch((value) => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...value, _draftVersion: DRAFT_VERSION }));
      setHasDraft(true);
    });
    return () => subscription.unsubscribe();
  }, [form, isLoaded]);

  const clearDraft = () => {
    localStorage.removeItem(STORAGE_KEY);
    form.reset(defaultValues);
    setHasDraft(false);
  };

  return { form, isLoaded, clearDraft, hasDraft };
}
