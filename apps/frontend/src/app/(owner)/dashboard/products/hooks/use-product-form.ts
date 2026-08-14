import { useCallback, useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { productFormSchema, type ProductFormValues } from '../components/product-form/schema';
import type { UploadedProductImage } from '@/lib/api/products';

const STORAGE_KEY = 'fashionRental_newProductDraft';
const DRAFT_VERSION = 6;
const SAVE_DEBOUNCE_MS = 2000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const defaultValues: Partial<ProductFormValues> = {
  status: 'draft',
  events: [],
  countryOfOriginPublic: false,
  referenceRetailValuePublic: false,
  variants: [
    {
      clientKey: Math.random().toString(36).slice(2),
      name: '',
      mainColorId: '',
      sizeInstanceIds: [],
      skuIdBySizeInstanceId: {},
      identicalColorIds: [],
      images: [],
    },
  ],
  ratePlanType: undefined,
  ratePlanConfig: undefined,
  pricingComponents: [],
  lateFeeEnabled: false,
  shippingMode: 'free',
  productTypeId: '',
  sizeSchemaOverrideId: '',
  details: [],
  faqs: [],
};

interface DraftPayload {
  _draftVersion: number;
  _savedAt: string;
  _currentStep: number;
  _creationKey: string;
  _productId?: string;
  [key: string]: unknown;
}

function createKey(): string {
  return globalThis.crypto?.randomUUID?.() ?? `product-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function serializableValues(values: ProductFormValues): ProductFormValues {
  return {
    ...values,
    variants: values.variants.map((variant) => ({
      ...variant,
      images: (variant.images ?? [])
        .filter((image) => UUID_PATTERN.test(image.id) && !image.file)
        .map(({ file: _file, ...image }) => image),
    })),
  };
}

export function useProductForm() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [restoredStep, setRestoredStep] = useState(0);
  const [productId, setProductId] = useState<string | null>(null);
  const [creationKey, setCreationKey] = useState(createKey);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const productIdRef = useRef<string | null>(null);
  const creationKeyRef = useRef(creationKey);
  const currentStepRef = useRef(0);

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues,
    mode: 'onChange',
  });

  const persistDraft = useCallback((currentStep: number) => {
    const now = new Date();
    currentStepRef.current = currentStep;
    const values = serializableValues(form.getValues());
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      ...values,
      _draftVersion: DRAFT_VERSION,
      _savedAt: now.toISOString(),
      _currentStep: currentStep,
      _creationKey: creationKeyRef.current,
      ...(productIdRef.current ? { _productId: productIdRef.current } : {}),
    }));
    setLastSavedAt(now);
    setHasDraft(true);
  }, [form]);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed: DraftPayload = JSON.parse(saved);
        if (parsed._draftVersion === DRAFT_VERSION) {
          const {
            _draftVersion,
            _savedAt,
            _currentStep,
            _creationKey,
            _productId,
            ...formData
          } = parsed;
          form.reset({ ...defaultValues, ...formData });
          const restoredCreationKey = _creationKey || createKey();
          creationKeyRef.current = restoredCreationKey;
          productIdRef.current = _productId ?? null;
          currentStepRef.current = typeof _currentStep === 'number' ? _currentStep : 0;
          setCreationKey(restoredCreationKey);
          setProductId(_productId ?? null);
          setHasDraft(true);
          setLastSavedAt(_savedAt ? new Date(_savedAt) : null);
          setRestoredStep(currentStepRef.current);
        } else {
          localStorage.removeItem(STORAGE_KEY);
        }
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    setIsLoaded(true);
  }, [form]);

  useEffect(() => {
    if (!isLoaded) return;
    const subscription = form.watch(() => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(
        () => persistDraft(currentStepRef.current),
        SAVE_DEBOUNCE_MS,
      );
    });
    return () => {
      subscription.unsubscribe();
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [form, isLoaded, persistDraft]);

  const forceSaveDraft = useCallback((currentStep: number) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    persistDraft(currentStep);
  }, [persistDraft]);

  const checkpointProduct = useCallback((id: string) => {
    productIdRef.current = id;
    setProductId(id);
    persistDraft(currentStepRef.current);
  }, [persistDraft]);

  const checkpointVariant = useCallback((variantIndex: number, id: string) => {
    form.setValue(`variants.${variantIndex}.id`, id, { shouldDirty: false });
    persistDraft(currentStepRef.current);
  }, [form, persistDraft]);

  const checkpointImage = useCallback((
    variantIndex: number,
    imageIndex: number,
    uploaded: UploadedProductImage,
  ) => {
    form.setValue(`variants.${variantIndex}.images.${imageIndex}.id`, uploaded.id, { shouldDirty: false });
    form.setValue(`variants.${variantIndex}.images.${imageIndex}.url`, uploaded.thumbnailUrl || uploaded.url, { shouldDirty: false });
    form.setValue(`variants.${variantIndex}.images.${imageIndex}.file`, undefined, { shouldDirty: false });
    persistDraft(currentStepRef.current);
  }, [form, persistDraft]);

  const clearDraft = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    localStorage.removeItem(STORAGE_KEY);
    const nextCreationKey = createKey();
    creationKeyRef.current = nextCreationKey;
    productIdRef.current = null;
    currentStepRef.current = 0;
    setCreationKey(nextCreationKey);
    setProductId(null);
    form.reset(defaultValues);
    setHasDraft(false);
    setLastSavedAt(null);
    setRestoredStep(0);
  }, [form]);

  return {
    form,
    isLoaded,
    clearDraft,
    hasDraft,
    lastSavedAt,
    forceSaveDraft,
    restoredStep,
    productId,
    creationKey,
    checkpointProduct,
    checkpointVariant,
    checkpointImage,
  };
}
