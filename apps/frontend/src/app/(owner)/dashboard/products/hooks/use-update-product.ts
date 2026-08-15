import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  productApi,
  type ProductDetail,
  type UpdateProductInput,
} from '@/lib/api/products';
import { ProductFormValues } from '../components/product-form/schema';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { getApiErrorMessage } from '@/lib/api-error';

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

/**
 * Checks if a variant ID looks like a real DB UUID vs a temp client-side ID.
 * UUIDs are 36 chars with dashes; temp IDs from Math.random are shorter.
 */
function isRealId(id?: string): boolean {
  if (!id) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

export function useUpdateProduct(
  productId: string,
  originalProduct: Pick<ProductDetail, 'variants' | 'status'> | null | undefined,
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
      const originalVariantIds = new Set(originalVariants.map((v) => v.id));
      const formVariants = data.variants;
      const formVariantIds = new Set(
        formVariants.filter((v) => v.id && isRealId(v.id)).map((v) => v.id!),
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

        if (fv.id && isRealId(fv.id) && originalVariantIds.has(fv.id)) {
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
        }

        // ── 3. Image diffing for this variant ─────────────────────
        const originalImages = fv.id && isRealId(fv.id)
          ? originalVariants.find((ov) => ov.id === fv.id)?.images ?? []
          : [];
        const formImages = fv.images ?? [];
        const formImageIds = new Set(
          formImages.filter((img) => img.id && isRealId(img.id)).map((img) => img.id),
        );

        // 3a. Delete removed images
        for (const oImg of originalImages) {
          if (!formImageIds.has(oImg.id)) {
            toast.loading(`Removing image...`, { id: 'update-product' });
            await productApi.deleteImage(oImg.id);
          }
        }

        // 3b. Upload new images and build the final persisted order.
        const newImages = formImages.filter((img) => img.file);
        const finalImageIds: string[] = [];
        let featuredImageId: string | undefined;
        let uploadIndex = 0;
        for (const image of formImages) {
          let persistedImageId: string;
          if (image.file) {
            uploadIndex += 1;
            toast.loading(
              `Uploading image ${uploadIndex}/${newImages.length} for variant ${i + 1}...`,
              { id: 'update-product' },
            );
            const uploaded = await productApi.uploadImage(
              variantId,
              image.file,
              image.isFeatured,
            );
            persistedImageId = uploaded.id;
          } else if (isRealId(image.id)) {
            persistedImageId = image.id;
          } else {
            continue;
          }
          finalImageIds.push(persistedImageId);
          if (image.isFeatured) featuredImageId = persistedImageId;
        }
        if (finalImageIds.length > 0) {
          await productApi.reorderImages(
            variantId,
            finalImageIds,
            featuredImageId ?? finalImageIds[0],
          );
        }
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
