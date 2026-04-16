import { useEffect, useState, useRef, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { productFormSchema, ProductFormValues } from '../components/product-form/schema';

const STORAGE_KEY = 'fashionRental_newProductDraft';
// Bump this version whenever the form schema changes to auto-invalidate old drafts
const DRAFT_VERSION = 3;
const SAVE_DEBOUNCE_MS = 2000;

const defaultValues: Partial<ProductFormValues> = {
  status: 'draft',
  events: [],
  showPurchasePrice: false,
  showCountry: false,
  variants: [
    {
      name: '',
      mainColorId: '',
      sizeInstanceIds: [],
      identicalColorIds: [],
      images: [],
    },
  ],
  pricingMode: 'one_time',
  minimumDays: 1,
  lateFeeType: 'fixed',
  shippingMode: 'free',
  productTypeId: '',
  sizeSchemaOverrideId: '',
  enableBackupSize: false,
  enableTryOn: false,
  creditTryOnFee: false,
  details: [],
  faqs: [],
};

interface DraftPayload {
  _draftVersion: number;
  _savedAt: string;
  _currentStep: number;
  [key: string]: unknown;
}

export function useProductForm() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [restoredStep, setRestoredStep] = useState(0);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        const parsed: DraftPayload = JSON.parse(saved);
        // Only restore if the draft version matches
        if (parsed._draftVersion === DRAFT_VERSION) {
          const { _draftVersion, _savedAt, _currentStep, ...formData } = parsed;
          form.reset({ ...defaultValues, ...formData });
          setHasDraft(true);
          setLastSavedAt(_savedAt ? new Date(_savedAt) : null);
          setRestoredStep(typeof _currentStep === 'number' ? _currentStep : 0);
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced auto-save to localStorage on change
  useEffect(() => {
    if (!isLoaded) return;
    const subscription = form.watch((value) => {
      // Clear any pending save
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      // Debounce save
      saveTimerRef.current = setTimeout(() => {
        const now = new Date();
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          ...value,
          _draftVersion: DRAFT_VERSION,
          _savedAt: now.toISOString(),
          _currentStep: 0, // Will be overwritten by forceSaveDraft
        }));
        setLastSavedAt(now);
        setHasDraft(true);
      }, SAVE_DEBOUNCE_MS);
    });
    return () => {
      subscription.unsubscribe();
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [form, isLoaded]);

  // Force-save immediately (called by Ctrl+S or "Save & Exit")
  const forceSaveDraft = useCallback((currentStep: number) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    const now = new Date();
    const values = form.getValues();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      ...values,
      _draftVersion: DRAFT_VERSION,
      _savedAt: now.toISOString(),
      _currentStep: currentStep,
    }));
    setLastSavedAt(now);
    setHasDraft(true);
  }, [form]);

  const clearDraft = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    localStorage.removeItem(STORAGE_KEY);
    form.reset(defaultValues);
    setHasDraft(false);
    setLastSavedAt(null);
  }, [form]);

  return { form, isLoaded, clearDraft, hasDraft, lastSavedAt, forceSaveDraft, restoredStep };
}
