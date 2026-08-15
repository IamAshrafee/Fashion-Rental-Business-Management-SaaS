import { productApi, type UploadedProductImage } from '@/lib/api/products';
import type { ProductFormValues } from '../components/product-form/schema';

type FormImage = ProductFormValues['variants'][number]['images'][number];

interface SyncVariantImagesOptions {
  variantId: string;
  images: FormImage[];
  onUploadStart?: (uploadedCount: number, totalUploads: number) => void;
  onUploaded?: (imageIndex: number, image: UploadedProductImage) => void;
}

export function isPersistedProductId(id?: string): id is string {
  return Boolean(
    id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id),
  );
}

export async function syncVariantImages({
  variantId,
  images,
  onUploadStart,
  onUploaded,
}: SyncVariantImagesOptions): Promise<void> {
  const totalUploads = images.filter((image) => image.file).length;
  const persistedIds: string[] = [];
  let featuredImageId: string | undefined;
  let uploadedCount = 0;

  for (const [imageIndex, image] of images.entries()) {
    let persistedId: string;
    if (image.file) {
      uploadedCount += 1;
      onUploadStart?.(uploadedCount, totalUploads);
      const uploaded = await productApi.uploadImage(
        variantId,
        image.file,
        Boolean(image.isFeatured),
      );
      onUploaded?.(imageIndex, uploaded);
      persistedId = uploaded.id;
    } else if (isPersistedProductId(image.id)) {
      persistedId = image.id;
    } else {
      continue;
    }

    persistedIds.push(persistedId);
    if (image.isFeatured) featuredImageId = persistedId;
  }

  if (persistedIds.length === 0) {
    throw new Error('Each variant needs at least one saved storefront image.');
  }
  await productApi.syncImages(
    variantId,
    persistedIds,
    featuredImageId ?? persistedIds[0],
  );
}
