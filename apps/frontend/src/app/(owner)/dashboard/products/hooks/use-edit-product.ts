import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useRef } from 'react';
import { productApi } from '@/lib/api/products';
import { productFormSchema, ProductFormValues } from '../components/product-form/schema';

/**
 * Maps the raw backend product response (deeply nested relations)
 * into the flat ProductFormValues shape used by the form.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapProductToFormValues(product: any): Partial<ProductFormValues> {
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
    maxLateFeeCap: pricing?.maxLateFee ?? undefined,
    shippingMode: pricing?.shippingMode ?? 'free',
    flatShippingFee: pricing?.shippingFee ?? undefined,

    // ── Size ───────────────────────────────────────────────────
    sizeMode: size?.mode ?? 'standard',
    measurements: size?.measurements?.map((m: any) => ({
      label: m.label ?? '',
      value: typeof m.value === 'string' ? parseFloat(m.value) || 0 : (m.value ?? 0),
      unit: m.unit ?? 'inch',
    })) ?? [],
    sizeChartUrl: size?.sizeChartUrl ?? undefined,

    // ── Services ───────────────────────────────────────────────
    securityDeposit: services?.depositAmount ?? undefined,
    cleaningFee: services?.cleaningFee ?? undefined,
    enableBackupSize: services?.backupSizeEnabled ?? false,
    backupSizeFee: services?.backupSizeFee ?? undefined,
    enableTryOn: services?.tryOnEnabled ?? false,
    tryOnFee: services?.tryOnFee ?? undefined,
    tryOnDuration: services?.tryOnDurationHours ?? undefined,
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
  };
}

/**
 * Hook that fetches a product by ID and initializes a react-hook-form
 * instance with the mapped data. The raw product data is also returned
 * for variant/image diffing during update.
 */
export function useEditProduct(productId: string) {
  const hasHydrated = useRef(false);

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

  // Create form with schema validation
  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      status: 'draft',
      pricingMode: 'one_time',
      sizeMode: 'standard',
      events: [],
      variants: [{ name: '', mainColorId: '', identicalColorIds: [], images: [] }],
      measurements: [],
      details: [],
      faqs: [],
    },
    mode: 'onChange',
  });

  // When data arrives, hydrate the form (once)
  useEffect(() => {
    if (rawProduct && !hasHydrated.current) {
      const mapped = mapProductToFormValues(rawProduct);
      form.reset(mapped as ProductFormValues);
      hasHydrated.current = true;
    }
  }, [rawProduct, form]);

  return {
    form,
    rawProduct,
    isLoading,
    isError,
    error,
    isHydrated: hasHydrated.current,
  };
}
