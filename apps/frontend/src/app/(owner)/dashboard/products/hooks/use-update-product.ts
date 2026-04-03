import { useMutation, useQueryClient } from '@tanstack/react-query';
import { productApi } from '@/lib/api/products';
import { ProductFormValues } from '../components/product-form/schema';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

interface OriginalVariant {
  id: string;
  images?: Array<{ id: string }>;
}

/**
 * Builds the flat Update DTO from form values (same structure as useSubmitProduct
 * but used for PATCH instead of POST).
 */
function buildUpdatePayload(data: ProductFormValues) {
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

    pricing: {
      mode: data.pricingMode,
      rentalPrice: data.rentalPrice,
      includedDays: data.includedDays,
      pricePerDay: data.pricePerDay,
      retailPrice: data.retailPrice,
      rentalPercentage: data.rentalPercentage,
      minInternalPrice: data.minPrice,
      maxDiscountPrice: data.maxDiscount,
      extendedRentalRate: data.extendedRentalRate,
      lateFeeType: data.lateFeeType,
      lateFeeAmount: data.lateFeeType === 'fixed' ? data.lateFeePerDay : undefined,
      lateFeePercentage: data.lateFeeType === 'percentage' ? data.lateFeePercentage : undefined,
      maxLateFee: data.maxLateFeeCap,
      shippingMode: data.shippingMode,
      shippingFee: data.flatShippingFee,
    },

    size: {
      mode: data.sizeMode,
      availableSizes: data.sizeMode === 'standard' ? data.availableSizes : undefined,
      mainDisplaySize: data.sizeMode === 'standard' ? data.mainDisplaySize : undefined,
      freeSizeType: data.sizeMode === 'free' ? data.freeSizeType : undefined,
      measurements: (data.sizeMode === 'measurement' || data.sizeMode === 'standard') ? data.measurements?.map((m) => ({
        label: m.label,
        value: String(m.value),
        unit: m.unit,
      })) : undefined,
      parts: data.sizeMode === 'multi_part' ? data.parts?.map((p) => ({
        partName: p.partName,
        measurements: p.measurements?.map((m) => ({
          label: m.label,
          value: String(m.value),
          unit: m.unit,
        })) ?? [],
      })) : undefined,
      sizeChartUrl: data.sizeChartUrl,
    },

    services: {
      depositAmount: data.securityDeposit,
      cleaningFee: data.cleaningFee,
      backupSizeEnabled: data.enableBackupSize,
      backupSizeFee: data.backupSizeFee,
      tryOnEnabled: data.enableTryOn,
      tryOnFee: data.tryOnFee,
      // Convert days → hours for backend
      tryOnDurationHours: data.tryOnDuration != null ? data.tryOnDuration * 24 : undefined,
      tryOnCreditToRental: data.creditTryOnFee,
    },

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  originalProduct: any | null | undefined,
) {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: async (data: ProductFormValues) => {
      // ── 1. Update core product fields ─────────────────────────
      toast.loading('Updating product info...', { id: 'update-product' });
      const payload = buildUpdatePayload(data);
      await productApi.updateProduct(productId, payload);

      // ── 2. Variant diffing ────────────────────────────────────
      const originalVariants: OriginalVariant[] = originalProduct?.variants ?? [];
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
            identicalColorIds: fv.identicalColorIds,
          });
          variantId = fv.id;
        } else {
          // New variant — create
          toast.loading(`Creating variant ${i + 1}/${formVariants.length}...`, { id: 'update-product' });
          const created = await productApi.addVariant(productId, {
            variantName: fv.name,
            mainColorId: fv.mainColorId,
            identicalColorIds: fv.identicalColorIds,
          });
          variantId = created.id;
        }

        // ── 3. Image diffing for this variant ─────────────────────
        const originalImages = fv.id && isRealId(fv.id)
          ? originalVariants.find((ov) => ov.id === fv.id)?.images ?? []
          : [];
        const originalImageIds = new Set(originalImages.map((img) => img.id));
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

        // 3b. Upload new images
        const newImages = formImages.filter((img) => img.file);
        for (let j = 0; j < newImages.length; j++) {
          const img = newImages[j];
          toast.loading(
            `Uploading image ${j + 1}/${newImages.length} for variant ${i + 1}...`,
            { id: 'update-product' },
          );
          await productApi.uploadImage(variantId, img.file, img.isFeatured);
        }
      }

      return productId;
    },
    onSuccess: () => {
      toast.success('Product updated successfully!', { id: 'update-product' });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['owner-products'] });
      router.push(`/dashboard/products/${productId}`);
    },
    onError: (error: any) => {
      console.error('Update error:', error);
      toast.error(
        error.response?.data?.message || 'Failed to update product',
        { id: 'update-product' },
      );
    },
  });
}
