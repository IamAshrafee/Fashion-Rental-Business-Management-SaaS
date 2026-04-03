import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { productApi } from '@/lib/api/products';
import { productFormSchema, ProductFormValues } from '../components/product-form/schema';

/**
 * Maps the raw backend product response (deeply nested relations)
 * into the flat ProductFormValues shape used by the form.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapProductToFormValues(product: any): ProductFormValues {
  const pricing = product.pricing;
  const services = product.services;
  const size = product.productSize;

  return {
    // ── Basic Info ──────────────────────────────────────────────
    name: product.name ?? '',
    description: product.description ?? '',
    categoryId: product.categoryId ?? '',
    subcategoryId: product.subcategoryId ?? undefined,
    events: product.events?.map((pe: any) => pe.event?.id ?? pe.eventId).filter(Boolean) ?? [],
    status: product.status ?? 'draft',
    purchaseDate: product.purchaseDate
      ? new Date(product.purchaseDate).toISOString().split('T')[0]
      : undefined,
    purchasePrice: product.purchasePrice ?? undefined,
    showPurchasePrice: product.purchasePricePublic ?? false,
    itemCountry: product.itemCountry ?? undefined,
    showCountry: product.itemCountryPublic ?? false,
    targetRentals: product.targetRentals ?? undefined,

    // ── Variants ───────────────────────────────────────────────
    variants: product.variants?.map((v: any) => ({
      id: v.id,
      name: v.variantName ?? '',
      mainColorId: v.mainColor?.id ?? v.mainColorId ?? '',
      identicalColorIds:
        v.identicalColors?.map((vc: any) => vc.color?.id ?? vc.colorId).filter(Boolean) ?? [],
      images:
        v.images?.map((img: any) => ({
          id: img.id,
          url: img.url,
          isFeatured: img.isFeatured ?? false,
          sequence: img.sequence ?? 0,
          // No `file` — these are already uploaded
        })) ?? [],
    })) ?? [{ name: '', mainColorId: '', identicalColorIds: [], images: [] }],

    // ── Pricing ────────────────────────────────────────────────
    pricingMode: pricing?.mode ?? 'one_time',
    rentalPrice: pricing?.rentalPrice ?? undefined,
    includedDays: pricing?.includedDays ?? undefined,
    pricePerDay: pricing?.pricePerDay ?? undefined,
    minimumDays: pricing?.minimumDays ?? 1,
    retailPrice: pricing?.retailPrice ?? undefined,
    rentalPercentage: pricing?.rentalPercentage != null
      ? Number(pricing.rentalPercentage)
      : undefined,
    minPrice: pricing?.minInternalPrice ?? undefined,
    maxDiscount: pricing?.maxDiscountPrice ?? undefined,
    extendedRentalRate: pricing?.extendedRentalRate ?? undefined,
    lateFeeType: pricing?.lateFeeType ?? 'fixed',
    lateFeePerDay: pricing?.lateFeeAmount ?? undefined,
    lateFeePercentage: pricing?.lateFeePercentage != null
      ? Number(pricing.lateFeePercentage)
      : undefined,
    maxLateFeeCap: pricing?.maxLateFee ?? undefined,
    shippingMode: pricing?.shippingMode ?? 'free',
    flatShippingFee: pricing?.shippingFee ?? undefined,

    // ── Size ───────────────────────────────────────────────────
    sizeMode: size?.mode ?? 'standard',
    availableSizes: size?.availableSizes ?? [],
    mainDisplaySize: size?.mainDisplaySize ?? undefined,
    freeSizeType: size?.freeSizeType ?? undefined,
    measurements: size?.measurements
      ?.filter((m: any) => !m.partId) // top-level measurements only
      ?.map((m: any) => ({
        label: m.label ?? '',
        value: typeof m.value === 'string' ? parseFloat(m.value) || 0 : (m.value ?? 0),
        unit: m.unit ?? 'inch',
      })) ?? [],
    parts: size?.parts?.map((p: any) => ({
      partName: p.partName ?? '',
      measurements: p.measurements?.map((m: any) => ({
        label: m.label ?? '',
        value: typeof m.value === 'string' ? parseFloat(m.value) || 0 : (m.value ?? 0),
        unit: m.unit ?? 'inch',
      })) ?? [],
    })) ?? [],
    sizeChartUrl: size?.sizeChartUrl ?? undefined,

    // ── Services ───────────────────────────────────────────────
    securityDeposit: services?.depositAmount ?? undefined,
    cleaningFee: services?.cleaningFee ?? undefined,
    enableBackupSize: services?.backupSizeEnabled ?? false,
    backupSizeFee: services?.backupSizeFee ?? undefined,
    enableTryOn: services?.tryOnEnabled ?? false,
    tryOnFee: services?.tryOnFee ?? undefined,
    // Convert hours → days for the form
    tryOnDuration: services?.tryOnDurationHours != null
      ? Math.round(services.tryOnDurationHours / 24)
      : undefined,
    creditTryOnFee: services?.tryOnCreditToRental ?? false,

    // ── Details & FAQ ──────────────────────────────────────────
    details: product.detailHeaders?.map((h: any) => ({
      header: h.headerName ?? '',
      items: h.entries?.map((e: any) => ({
        key: e.key ?? '',
        value: e.value ?? '',
      })) ?? [],
    })) ?? [],
    faqs: product.faqs?.map((f: any) => ({
      question: f.question ?? '',
      answer: f.answer ?? '',
    })) ?? [],
  } as ProductFormValues;
}

/**
 * Hook that fetches a product by ID and initializes a react-hook-form
 * instance with the mapped data.
 *
 * FIX: We no longer use useEffect + form.reset() after initial mount.
 * Instead, we pass `defaultValues` directly with the real mapped data only
 * when the product is available. The form is not created until rawProduct
 * is truthy (callers guard on isLoading / rawProduct before rendering the
 * FormProvider — see EditProductForm). This ensures Radix Select triggers
 * always mount with the correct saved values without stale-state issues.
 */
export function useEditProduct(productId: string) {
  // Fetch the full product from the API
  const {
    data: rawProduct,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['products', 'detail', productId],
    queryFn: () => productApi.getById(productId),
    enabled: !!productId,
  });

  // Map to form values only when data is present, otherwise use safe empty defaults.
  // The EditProductForm parent guards render until rawProduct is truthy, so the
  // form will always be initialized with real data — never empty fallbacks.
  const initialValues = rawProduct
    ? mapProductToFormValues(rawProduct)
    : {
        status: 'draft' as const,
        pricingMode: 'one_time' as const,
        sizeMode: 'standard' as const,
        events: [] as string[],
        variants: [{ name: '', mainColorId: '', identicalColorIds: [] as string[], images: [] }],
        availableSizes: [] as string[],
        measurements: [],
        parts: [],
        details: [],
        faqs: [],
      };

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: initialValues,
    mode: 'onChange',
  });

  return {
    form,
    rawProduct,
    isLoading,
    isError,
    error,
  };
}
