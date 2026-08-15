import { useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  productApi,
  productOnboardingApi,
  type ProductDetail,
  type UploadedProductImage,
  type UpdateProductInput,
} from '@/lib/api/products';
import { ProductFormValues } from '../components/product-form/schema';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { getApiErrorMessage } from '@/lib/api-error';
import { isPersistedProductId, syncVariantImages } from './sync-variant-images';

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
  originalProduct: Pick<ProductDetail, 'onboarding' | 'status'> | null | undefined,
  checkpoints?: {
    onVariantSaved?: (variantIndex: number, variantId: string) => void;
    onImageUploaded?: (
      variantIndex: number,
      imageIndex: number,
      image: UploadedProductImage,
    ) => void;
  },
) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const onboardingRevision = useRef<number | null>(
    originalProduct?.onboarding?.revision ?? null,
  );

  useEffect(() => {
    onboardingRevision.current = originalProduct?.onboarding?.revision ?? null;
  }, [originalProduct?.onboarding?.revision, productId]);

  return useMutation({
    mutationFn: async (data: ProductFormValues) => {
      const expectedRevision = onboardingRevision.current;
      if (expectedRevision === null) {
        throw new Error(
          'This product is missing its edit workflow record. Restore the product workflow before saving.',
        );
      }

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

      // ── 2. Reconcile variants and rentable SKUs atomically ───
      const formVariants = data.variants;
      toast.loading('Synchronizing variants and rentable SKUs...', { id: 'update-product' });
      const synchronized = await productOnboardingApi.saveSkus(
        productId,
        {
          expectedRevision,
          variants: formVariants.map((variant) => ({
            ...(isPersistedProductId(variant.id) ? { id: variant.id } : {}),
            clientKey: variant.clientKey,
            variantName: variant.name || undefined,
            mainColorId: variant.mainColorId,
            identicalColorIds: variant.identicalColorIds,
            sizes: variant.sizeInstanceIds.map((sizeInstanceId) => ({ sizeInstanceId })),
          })),
        },
        globalThis.crypto?.randomUUID?.() ??
          `edit-product-skus-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      );
      onboardingRevision.current = synchronized.revision;

      // ── 3. Synchronize media against the saved variant identities ──
      for (let i = 0; i < formVariants.length; i++) {
        const fv = formVariants[i];
        const savedVariant = synchronized.product.variants.find(
          (variant) => variant.id === fv.id || variant.onboardingKey === fv.clientKey,
        );
        if (!savedVariant) {
          throw new Error(`Variant ${i + 1} was not returned after SKU synchronization.`);
        }
        const variantId = savedVariant.id;
        checkpoints?.onVariantSaved?.(i, variantId);

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
