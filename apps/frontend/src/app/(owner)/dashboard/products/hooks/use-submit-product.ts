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
      // 1. Transform basic info to backend DTO (no longer includes pricing/services)
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
        productTypeId: data.productTypeId,
        sizeSchemaOverrideId: data.sizeSchemaOverrideId,

        // Legacy shipping (still on product, not on pricing engine)
        pricing: {
          mode: 'one_time' as const,
          shippingMode: data.shippingMode,
          shippingFee: data.flatShippingFee,
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

      // 3. Save pricing via the new Pricing Engine v2 API
      if (data.ratePlanType && data.ratePlanConfig) {
        toast.loading('Setting up pricing...', { id: 'submit-product' });

        // Build components array
        const components = (data.pricingComponents || []).map((comp) => ({
          type: comp.type === 'ADDON_BACKUP' || comp.type === 'ADDON_TRYON' ? 'ADDON' : comp.type,
          config: comp.config,
          chargeTiming: 'AT_BOOKING',
          refundable: comp.type === 'DEPOSIT',
        }));

        // Build late fee policy
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

      // 4. Loop over variants and create them sequentially
      let variantIdx = 1;
      for (const variant of data.variants) {
        toast.loading(`Creating variant: ${variant.name || 'Default'} (${variantIdx}/${data.variants.length})...`, { id: 'submit-product' });
        
        const { id: variantId } = await productApi.addVariant(productId, {
          variantName: variant.name,
          mainColorId: variant.mainColorId,
          sizeInstanceIds: variant.sizeInstanceIds || [],
          identicalColorIds: variant.identicalColorIds,
        });

        // 5. For this variant, upload its images
        if (variant.images && variant.images.length > 0) {
          let imageIdx = 1;
          for (const image of variant.images) {
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
