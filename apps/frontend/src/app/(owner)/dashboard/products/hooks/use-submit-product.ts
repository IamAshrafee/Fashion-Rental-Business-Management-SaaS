import { useMutation, useQueryClient } from '@tanstack/react-query';
import { productApi } from '@/lib/api/products';
import { ProductFormValues } from '../components/product-form/schema';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

export function useSubmitProduct(clearDraft: () => void) {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: async (data: ProductFormValues) => {
      // 1. Transform basic info to backend DTO
      const productPayload = {
        name: data.name,
        description: data.description,
        categoryId: data.categoryId,
        subcategoryId: data.subcategoryId,
        eventIds: data.events,
        status: data.status,
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
          availableSizes: (data.sizeMode === 'standard' || data.sizeMode === 'multi_part') ? data.availableSizes : undefined,
          mainDisplaySize: (data.sizeMode === 'standard' || data.sizeMode === 'multi_part') ? data.mainDisplaySize : undefined,
          freeSizeType: data.sizeMode === 'free' ? data.freeSizeType : undefined,
          measurements: (data.sizeMode === 'measurement' || data.sizeMode === 'standard' || data.sizeMode === 'free') ? data.measurements?.map((m) => ({
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
        faqs: data.faqs?.map(faq => ({
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

      // 2. Create the core product
      toast.loading('Creating product base info...', { id: 'submit-product' });
      const { id: productId } = await productApi.createProduct(productPayload);

      // 3. Loop over variants and create them sequentially
      let variantIdx = 1;
      for (const variant of data.variants) {
        toast.loading(`Creating variant: ${variant.name || 'Default'} (${variantIdx}/${data.variants.length})...`, { id: 'submit-product' });
        
        const { id: variantId } = await productApi.addVariant(productId, {
          variantName: variant.name,
          mainColorId: variant.mainColorId,
          identicalColorIds: variant.identicalColorIds,
        });

        // 4. For this variant, upload its images
        if (variant.images && variant.images.length > 0) {
          let imageIdx = 1;
          for (const image of variant.images) {
            // Only upload if it has an actual file attached
            if (image.file) {
              toast.loading(`Uploading image ${imageIdx}/${variant.images.length} for ${variant.name || 'Default'}...`, { id: 'submit-product' });
              await productApi.uploadImage(variantId, image.file, image.isFeatured);
            }
            imageIdx++;
          }
        }
        variantIdx++;
      }

      return productId;
    },
    onSuccess: (productId) => {
      toast.success('Product created successfully!', { id: 'submit-product' });
      queryClient.invalidateQueries({ queryKey: ['owner-products'] });
      clearDraft();
      router.push(`/dashboard/products/${productId}`);
    },
    onError: (error: any) => {
      console.error('Submission error:', error);
      toast.error(error.response?.data?.message || 'Failed to create product', { id: 'submit-product' });
    },
  });
}
