import type { ProductReadinessBlocker } from '@/lib/api/products';
import type { EditTabId } from './product-form/tabbed-edit-layout';

export interface ProductReadinessGuidance {
  title: string;
  description: string;
  editTab?: EditTabId;
  wizardStep?: number;
}

const GUIDANCE: Record<ProductReadinessBlocker['code'], ProductReadinessGuidance> = {
  CATEGORY: {
    title: 'Choose an active category',
    description: 'The saved category is no longer available for publication. Select an active category customers can use to find this item.',
    editTab: 'basic',
    wizardStep: 0,
  },
  PRODUCT_TYPE: {
    title: 'Choose an active product type',
    description: 'The listing needs an available product type so it can use the right sizing system.',
    editTab: 'size_details',
    wizardStep: 0,
  },
  SIZE_SCHEMA: {
    title: 'Set up the size system',
    description: 'Choose a product type with active sizes, then make sure each rentable variant uses one of those sizes.',
    editTab: 'size_details',
    wizardStep: 0,
  },
  VARIANT: {
    title: 'Add a variant',
    description: 'Add the color, style, or version that customers will rent.',
    editTab: 'media',
    wizardStep: 1,
  },
  RENTABLE_SKU: {
    title: 'Add a rentable size',
    description: 'Give at least one variant a valid size so physical items can be assigned and rented.',
    editTab: 'media',
    wizardStep: 1,
  },
  VARIANT_MEDIA: {
    title: 'Add a featured image',
    description: 'Each rentable variant needs a featured image so customers can recognize what they are booking.',
    editTab: 'media',
    wizardStep: 1,
  },
  ACTIVE_PRICING: {
    title: 'Set rental pricing',
    description: 'Choose and activate a rental price before customers can book this listing.',
    editTab: 'pricing',
    wizardStep: 3,
  },
  COMPOSITION: {
    title: 'Fix the bundle composition',
    description: 'A linked component or alternative is no longer available. Update the bundle before publishing.',
  },
};

export function getProductReadinessGuidance(
  blocker: ProductReadinessBlocker,
): ProductReadinessGuidance {
  return GUIDANCE[blocker.code];
}

export function getProductReadinessFixHref({
  productId,
  blocker,
  needsSetup,
}: {
  productId: string;
  blocker: ProductReadinessBlocker;
  needsSetup: boolean;
}) {
  const guidance = getProductReadinessGuidance(blocker);
  const issue = new URLSearchParams({ issue: blocker.code });
  if (blocker.field) issue.set('field', blocker.field);
  if (blocker.entityId) issue.set('entityId', blocker.entityId);

  if (blocker.section === 'composition') {
    return `/dashboard/products/${productId}/composition?${issue.toString()}`;
  }

  if (needsSetup && guidance.wizardStep !== undefined) {
    issue.set('step', String(guidance.wizardStep));
    return `/dashboard/products/new?productId=${productId}&${issue.toString()}`;
  }

  issue.set('focus', guidance.editTab ?? 'basic');
  return `/dashboard/products/${productId}/edit?${issue.toString()}`;
}
