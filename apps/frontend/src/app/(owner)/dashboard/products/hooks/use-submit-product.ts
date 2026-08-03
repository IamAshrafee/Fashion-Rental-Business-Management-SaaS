import { useMutation, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { productApi, type UploadedProductImage } from '@/lib/api/products';
import type { ProductFormValues } from '../components/product-form/schema';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface SubmitProductOptions {
  clearDraft: () => void;
  productId: string | null;
  creationKey: string;
  checkpointProduct: (id: string) => void;
  checkpointVariant: (variantIndex: number, id: string) => void;
  checkpointImage: (
    variantIndex: number,
    imageIndex: number,
    uploaded: UploadedProductImage,
  ) => void;
}

function buildProductPayload(data: ProductFormValues) {
  return {
    name: data.name,
    description: data.description,
    categoryId: data.categoryId,
    subcategoryId: data.subcategoryId,
    eventIds: data.events,
    purchaseDate: data.purchaseDate || undefined,
    purchasePrice: data.purchasePrice,
    purchasePricePublic: data.showPurchasePrice,
    itemCountry: data.itemCountry,
    itemCountryPublic: data.showCountry,
    targetRentals: data.targetRentals,
    productTypeId: data.productTypeId,
    sizeSchemaOverrideId: data.sizeSchemaOverrideId,
    faqs: data.faqs?.map((faq) => ({ question: faq.question, answer: faq.answer })),
    details: data.details?.map((detail, index) => ({
      headerName: detail.header,
      sequence: index,
      entries: detail.items.map((item) => ({ key: item.key, value: item.value })),
    })),
  };
}

function buildPricingPayload(data: ProductFormValues) {
  const components: Array<{
    type: string;
    config: Record<string, unknown>;
    chargeTiming: string;
    refundable: boolean;
  }> = (data.pricingComponents || []).map((component) => ({
    type: component.type === 'ADDON_BACKUP' || component.type === 'ADDON_TRYON'
      ? 'ADDON'
      : component.type,
    config: {
      ...component.config,
      ...(component.type === 'ADDON_BACKUP'
        ? { purpose: 'BACKUP_SIZE', addonId: 'BACKUP_SIZE' }
        : component.type === 'ADDON_TRYON'
          ? { purpose: 'TRY_ON', addonId: 'TRY_ON' }
          : {}),
    },
    chargeTiming: 'AT_BOOKING',
    refundable: component.type === 'DEPOSIT',
  }));

  if (data.shippingMode === 'flat' && (data.flatShippingFee ?? 0) > 0) {
    components.push({
      type: 'FEE',
      config: {
        label: 'Delivery fee',
        purpose: 'DELIVERY',
        pricing: { mode: 'FLAT', amountMinor: data.flatShippingFee ?? 0 },
      },
      chargeTiming: 'AT_BOOKING',
      refundable: false,
    });
  }

  return {
    ratePlan: { type: data.ratePlanType, config: data.ratePlanConfig },
    components,
    lateFeePolicy: data.lateFeeEnabled
      ? {
          enabled: true,
          graceHours: data.lateFeeGraceHours || 24,
          mode: 'PER_DAY' as const,
          amountMinor: data.lateFeeAmountMinor || 0,
          totalCapMinor: data.lateFeeCapMinor || undefined,
        }
      : { enabled: false, graceHours: 0, mode: 'PER_DAY' as const },
  };
}

function errorMessage(error: unknown): string {
  if (isAxiosError<{ message?: string }>(error)) {
    return error.response?.data?.message || error.message;
  }
  return error instanceof Error ? error.message : 'Failed to save product';
}

export function useSubmitProduct(options: SubmitProductOptions) {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: async (data: ProductFormValues) => {
      const productPayload = buildProductPayload(data);
      let productId = options.productId;

      toast.loading(productId ? 'Updating saved draft…' : 'Creating product draft…', {
        id: 'submit-product',
      });
      if (productId) {
        await productApi.updateProduct(productId, productPayload);
      } else {
        const created = await productApi.createProduct(productPayload, options.creationKey);
        productId = created.id;
        options.checkpointProduct(productId);
      }

      if (data.ratePlanType && data.ratePlanConfig) {
        toast.loading('Saving authoritative pricing…', { id: 'submit-product' });
        await productApi.savePricing(productId, buildPricingPayload(data));
      }

      for (let variantIndex = 0; variantIndex < data.variants.length; variantIndex += 1) {
        const variant = data.variants[variantIndex];
        const variantPayload = {
          variantName: variant.name,
          mainColorId: variant.mainColorId,
          sizes: (variant.sizeInstanceIds || []).map((sizeInstanceId) => ({
            sizeInstanceId,
            trackingMode: variant.inventoryBySizeId?.[sizeInstanceId]?.trackingMode ?? 'POOLED' as const,
          })),
          identicalColorIds: variant.identicalColorIds,
        };
        let variantId = variant.id && UUID_PATTERN.test(variant.id) ? variant.id : null;

        toast.loading(`Saving variant ${variantIndex + 1} of ${data.variants.length}…`, {
          id: 'submit-product',
        });
        if (variantId) {
          await productApi.updateVariant(productId, variantId, variantPayload);
        } else {
          const createdVariant = await productApi.addVariant(productId, variantPayload);
          variantId = createdVariant.id;
          options.checkpointVariant(variantIndex, variantId);
        }

        const images = variant.images ?? [];
        for (let imageIndex = 0; imageIndex < images.length; imageIndex += 1) {
          const image = images[imageIndex];
          if (!image.file) continue;
          toast.loading(
            `Uploading image ${imageIndex + 1} of ${images.length} for variant ${variantIndex + 1}…`,
            { id: 'submit-product' },
          );
          const uploaded = await productApi.uploadImage(variantId, image.file, image.isFeatured);
          options.checkpointImage(variantIndex, imageIndex, uploaded);
        }
      }

      if (data.status !== 'draft') {
        toast.loading(data.status === 'published' ? 'Validating and publishing…' : 'Archiving product…', {
          id: 'submit-product',
        });
        await productApi.updateStatus(productId, data.status);
      }

      return productId;
    },
    onSuccess: (productId) => {
      toast.success('Product saved successfully', { id: 'submit-product' });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      options.clearDraft();
      router.push(`/dashboard/products/${productId}`);
    },
    onError: (error) => {
      toast.error(`${errorMessage(error)} Your server draft and completed steps were preserved.`, {
        id: 'submit-product',
      });
    },
  });
}
