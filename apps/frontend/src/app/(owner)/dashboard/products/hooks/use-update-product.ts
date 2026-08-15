import { useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  productApi,
  productOnboardingApi,
  type ProductDetail,
  type UploadedProductImage,
} from '@/lib/api/products';
import { ProductFormValues } from '../components/product-form/schema';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { getApiErrorMessage } from '@/lib/api-error';
import { isPersistedProductId, syncVariantImages } from './sync-variant-images';
import { buildPricingPayload } from '../components/product-form/pricing-payload';

export function useUpdateProduct(
  productId: string,
  originalProduct:
    | Pick<ProductDetail, 'onboarding' | 'status' | 'storefrontItemMode'>
    | null
    | undefined,
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

      // ── 1. Save catalog basics through the revisioned workflow ──
      toast.loading('Updating product info...', { id: 'update-product' });
      const basics = await productOnboardingApi.saveBasics(
        productId,
        {
          expectedRevision,
          name: data.name,
          categoryId: data.categoryId,
          subcategoryId: data.subcategoryId || undefined,
          productTypeId: data.productTypeId,
          sizeSchemaOverrideId: data.sizeSchemaOverrideId || undefined,
          eventIds: data.events,
          countryOfOrigin: data.countryOfOrigin?.trim() || undefined,
          countryOfOriginPublic: data.countryOfOriginPublic,
          referenceRetailValue: data.referenceRetailValue,
          referenceRetailValuePublic: data.referenceRetailValuePublic,
          storefrontItemMode: originalProduct?.storefrontItemMode ?? 'INTERNAL_ONLY',
        },
        globalThis.crypto?.randomUUID?.() ??
          `edit-product-basics-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      );
      onboardingRevision.current = basics.revision;

      // ── 2. Reconcile variants and rentable SKUs atomically ───
      const formVariants = data.variants;
      toast.loading('Synchronizing variants and rentable SKUs...', { id: 'update-product' });
      const synchronized = await productOnboardingApi.saveSkus(
        productId,
        {
          expectedRevision: onboardingRevision.current,
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

      // ── 4. Save customer-facing content atomically ───────────
      toast.loading('Updating product details and FAQs...', { id: 'update-product' });
      const content = await productOnboardingApi.saveContent(
        productId,
        {
          expectedRevision: onboardingRevision.current,
          description: data.description?.trim() || undefined,
          faqs: data.faqs,
          details: data.details?.map((detail, sequence) => ({
            headerName: detail.header,
            sequence,
            entries: detail.items,
          })),
        },
        globalThis.crypto?.randomUUID?.() ??
          `edit-product-content-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      );
      onboardingRevision.current = content.revision;

      // ── 5. Save the active pricing version atomically ─────────
      toast.loading('Updating pricing and fees...', { id: 'update-product' });
      const pricing = await productOnboardingApi.savePricing(
        productId,
        {
          expectedRevision: onboardingRevision.current,
          pricing: buildPricingPayload(data),
        },
        globalThis.crypto?.randomUUID?.() ??
          `edit-product-pricing-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      );
      onboardingRevision.current = pricing.revision;

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
