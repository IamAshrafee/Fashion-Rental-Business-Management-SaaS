import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  productApi,
  type ProductDetail,
  type UploadedProductImage,
  type UpdateProductInput,
} from '@/lib/api/products';
import { ProductFormValues } from '../components/product-form/schema';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { getApiErrorMessage } from '@/lib/api-error';
import {
  isPersistedProductId,
  syncVariantImages,
} from './sync-variant-images';

/**
 * Builds the flat Update DTO from form values (excluding pricing)
 */
function buildUpdatePayload(data: ProductFormValues): UpdateProductInput {
  return {
    name: data.name,
    description: data.description?.trim() || null,
    categoryId: data.categoryId,
    subcategoryId: data.subcategoryId || null,
    eventIds: data.events,
    countryOfOrigin: data.countryOfOrigin?.trim() || null,
    countryOfOriginPublic: data.countryOfOriginPublic,
    referenceRetailValue: data.referenceRetailValue ?? null,
    referenceRetailValuePublic: data.referenceRetailValuePublic,
    productTypeId: data.productTypeId,
    sizeSchemaOverrideId: data.sizeSchemaOverrideId || null,

    faqs: data.faqs?.map((faq) => ({
      question: faq.question,
      answer: faq.answer,
    })),

    details: data.details?.map((detail, idx) => ({
      headerName: detail.header,
      sequence: idx,
      entries: detail.items.map((item) => ({
        key: item.key,
        value: item.value,
      })),
    })),
  };
}

export function useUpdateProduct(
  productId: string,
  originalProduct: Pick<ProductDetail, 'variants' | 'status'> | null | undefined,
  checkpoints?: {
    onVariantCreated?: (variantIndex: number, variantId: string) => void;
    onImageUploaded?: (
      variantIndex: number,
      imageIndex: number,
      image: UploadedProductImage,
    ) => void;
  },
) {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: async (data: ProductFormValues) => {
      // ── 1. Update core product fields ─────────────────────────
      toast.loading('Updating product info...', { id: 'update-product' });
      const payload = buildUpdatePayload(data);
      await productApi.updateProduct(productId, payload);

      // ── 1b. Update Pricing Engine profiles ────────────────────
      if (data.ratePlanType && data.ratePlanConfig) {
        toast.loading('Updating pricing...', { id: 'update-product' });

        const components: Array<{
          type: string;
          config: Record<string, unknown>;
          chargeTiming: string;
          refundable: boolean;
        }> = (data.pricingComponents || []).map((comp) => ({
          type: comp.type === 'ADDON_BACKUP' || comp.type === 'ADDON_TRYON' ? 'ADDON' : comp.type,
          config: {
            ...comp.config,
            ...(comp.type === 'ADDON_BACKUP'
              ? { purpose: 'BACKUP_SIZE', addonId: 'BACKUP_SIZE' }
              : comp.type === 'ADDON_TRYON'
                ? { purpose: 'TRY_ON', addonId: 'TRY_ON' }
                : {}),
          },
          chargeTiming: 'AT_BOOKING',
          refundable: comp.type === 'DEPOSIT',
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

        const lateFeePolicy = data.lateFeeEnabled
          ? {
              enabled: true,
              graceHours: data.lateFeeGraceHours || 24,
              mode: 'PER_DAY' as const,
              amountMinor: data.lateFeeAmountMinor || 0,
              totalCapMinor: data.lateFeeCapMinor || undefined,
            }
          : { enabled: false, graceHours: 0, mode: 'PER_DAY' as const };

        await productApi.savePricing(productId, {
          ratePlan: {
            type: data.ratePlanType,
            config: data.ratePlanConfig,
          },
          components,
          lateFeePolicy,
        });
      }

      // ── 2. Variant diffing ────────────────────────────────────
      const originalVariants = originalProduct?.variants ?? [];
      const formVariants = data.variants;
      const formVariantIds = new Set(
        formVariants.filter((v) => isPersistedProductId(v.id)).map((v) => v.id),
      );

      // 2a. Delete removed variants
      for (const ov of originalVariants) {
        if (!formVariantIds.has(ov.id)) {
          toast.loading(`Removing variant...`, { id: 'update-product' });
          await productApi.deleteVariant(productId, ov.id);
        }
      }

      // 2b. Update existing + create new variants, and handle images
      for (let i = 0; i < formVariants.length; i++) {
        const fv = formVariants[i];
        let variantId: string;

        if (isPersistedProductId(fv.id)) {
          // Existing variant — update
          toast.loading(`Updating variant ${i + 1}/${formVariants.length}...`, { id: 'update-product' });
          await productApi.updateVariant(productId, fv.id, {
            variantName: fv.name,
            mainColorId: fv.mainColorId,
            sizes: (fv.sizeInstanceIds || []).map((sizeInstanceId) => ({
              sizeInstanceId,
            })),
            identicalColorIds: fv.identicalColorIds,
          });
          variantId = fv.id;
        } else {
          // New variant — create
          toast.loading(`Creating variant ${i + 1}/${formVariants.length}...`, { id: 'update-product' });
          const created = await productApi.addVariant(productId, {
            variantName: fv.name,
            mainColorId: fv.mainColorId,
            sizes: (fv.sizeInstanceIds || []).map((sizeInstanceId) => ({
              sizeInstanceId,
            })),
            identicalColorIds: fv.identicalColorIds,
          });
          variantId = created.id;
          checkpoints?.onVariantCreated?.(i, variantId);
        }

        // ── 3. Image diffing for this variant ─────────────────────
        const formImages = fv.images ?? [];
        await syncVariantImages({
          variantId,
          images: formImages,
          onUploadStart: (uploadedCount, totalUploads) =>
            toast.loading(
              `Uploading image ${uploadedCount}/${totalUploads} for variant ${i + 1}...`,
              { id: 'update-product' },
            ),
          onUploaded: (imageIndex, image) =>
            checkpoints?.onImageUploaded?.(i, imageIndex, image),
        });
      }

      if (data.status !== originalProduct?.status) {
        await productApi.updateStatus(productId, data.status);
      }

      return productId;
    },
    onSuccess: () => {
      toast.success('Product updated successfully!', { id: 'update-product' });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['owner-products'] });
      router.push(`/dashboard/products/${productId}`);
    },
    onError: (error: unknown) => {
      console.error('Update error:', error);
      toast.error(
        getApiErrorMessage(error, 'Failed to update product'),
        { id: 'update-product' },
      );
    },
  });
}
