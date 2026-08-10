import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { productApi, type ProductDetail } from '@/lib/api/products';
import { productFormSchema, type ProductFormValues } from '../components/product-form/schema';
import { useEffect } from 'react';

export function mapProductToFormValues(product: ProductDetail): ProductFormValues {
  const pricing = product.pricing;
  const pricingComponents = pricing?.components
    .filter((component) => component.config.purpose !== 'DELIVERY')
    .map((component) => ({
      type:
        component.type === 'ADDON' && component.config.purpose === 'BACKUP_SIZE'
          ? 'ADDON_BACKUP'
          : component.type === 'ADDON' && component.config.purpose === 'TRY_ON'
            ? 'ADDON_TRYON'
            : component.type,
      config: component.config,
    })) ?? [];

  return {
    name: product.name,
    description: product.description ?? undefined,
    categoryId: product.categoryId,
    subcategoryId: product.subcategoryId ?? undefined,
    events: product.events.map((association) => association.event.id),
    status: product.status,
    purchaseDate: product.purchaseDate
      ? new Date(product.purchaseDate).toISOString().split('T')[0]
      : undefined,
    purchasePrice: product.purchasePrice ?? undefined,
    showPurchasePrice: product.purchasePricePublic,
    itemCountry: product.itemCountry ?? undefined,
    showCountry: product.itemCountryPublic,
    targetRentals: product.targetRentals ?? undefined,
    productTypeId: product.productTypeId ?? '',
    sizeSchemaOverrideId: product.sizeSchemaOverrideId ?? '',
    variants: product.variants.map((variant) => ({
      id: variant.id,
      clientKey: variant.onboardingKey ?? variant.id,
      name: variant.variantName ?? '',
      mainColorId: variant.mainColorId,
      sizeInstanceIds: variant.sizes.map((size) => size.sizeInstanceId),
      inventoryBySizeId: Object.fromEntries(
        variant.sizes.map((size) => [
          size.sizeInstanceId,
          { trackingMode: size.trackingMode },
        ]),
      ),
      skuIdBySizeInstanceId: Object.fromEntries(
        variant.sizes.map((size) => [size.sizeInstanceId, size.id]),
      ),
      identicalColorIds: variant.identicalColors.map((association) => association.color.id),
      images: variant.images.map((image) => ({
        id: image.id,
        url: image.url,
        isFeatured: image.isFeatured,
        sequence: image.sequence,
      })),
    })),
    ratePlanType: pricing?.ratePlanType,
    ratePlanConfig: pricing?.ratePlanConfig,
    pricingComponents,
    lateFeeEnabled: Boolean(pricing?.lateFeePolicy?.enabled),
    lateFeeGraceHours: typeof pricing?.lateFeePolicy?.graceHours === 'number'
      ? pricing.lateFeePolicy.graceHours
      : undefined,
    lateFeeAmountMinor: typeof pricing?.lateFeePolicy?.amountMinor === 'number'
      ? pricing.lateFeePolicy.amountMinor
      : undefined,
    lateFeeCapMinor: typeof pricing?.lateFeePolicy?.totalCapMinor === 'number'
      ? pricing.lateFeePolicy.totalCapMinor
      : undefined,
    shippingMode: pricing?.shippingMode ?? 'free',
    flatShippingFee: pricing?.shippingFee,
    details: product.detailHeaders.map((header) => ({
      header: header.headerName,
      items: header.entries.map((entry) => ({ key: entry.key, value: entry.value })),
    })),
    faqs: product.faqs.map((faq) => ({ question: faq.question, answer: faq.answer })),
    openingInventorySkipped: true,
    openingInventoryLines: [],
  };
}

const emptyValues: ProductFormValues = {
  name: '',
  description: undefined,
  categoryId: '',
  subcategoryId: undefined,
  events: [],
  status: 'draft',
  purchaseDate: undefined,
  purchasePrice: undefined,
  showPurchasePrice: false,
  itemCountry: undefined,
  showCountry: false,
  targetRentals: undefined,
  productTypeId: '',
  sizeSchemaOverrideId: '',
  variants: [{
    clientKey: Math.random().toString(36).slice(2),
    name: '',
    mainColorId: '',
    sizeInstanceIds: [],
    inventoryBySizeId: {},
    skuIdBySizeInstanceId: {},
    identicalColorIds: [],
    images: [],
  }],
  ratePlanType: undefined,
  ratePlanConfig: undefined,
  pricingComponents: [],
  lateFeeEnabled: false,
  lateFeeGraceHours: undefined,
  lateFeeAmountMinor: undefined,
  lateFeeCapMinor: undefined,
  shippingMode: 'free',
  flatShippingFee: undefined,
  details: [],
  faqs: [],
  openingInventorySkipped: true,
  openingInventoryLines: [],
};

export function useEditProduct(productId: string) {
  const query = useQuery({
    queryKey: ['products', 'detail', productId],
    queryFn: () => productApi.getById(productId),
    enabled: Boolean(productId),
  });
  const initialValues = query.data ? mapProductToFormValues(query.data) : emptyValues;
  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: initialValues,
    mode: 'onChange',
  });

  useEffect(() => {
    if (query.data) {
      form.reset(mapProductToFormValues(query.data));
    }
  }, [form, query.data]);

  return {
    form,
    rawProduct: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
  };
}
