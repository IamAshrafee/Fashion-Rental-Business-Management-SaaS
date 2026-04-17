import { z } from 'zod';
import {
  ProductStatus,
  ShippingMode,
} from '@closetrent/types';

export const productFormSchema = z.object({
  // Step 1: Basic Info
  name: z.string().min(3, 'Name is required (min 3 chars)'),
  description: z.string().optional(),
  categoryId: z.string().min(1, 'Category is required'),
  subcategoryId: z.string().optional(),
  events: z.array(z.string()).default([]),
  status: z.enum(['draft', 'published', 'archived'] as [ProductStatus, ...ProductStatus[]]).default('draft'),
  purchaseDate: z.string().optional(),
  purchasePrice: z.number().optional(),
  showPurchasePrice: z.boolean().default(false),
  itemCountry: z.string().optional(),
  showCountry: z.boolean().default(false),
  targetRentals: z.number().int().optional(),

  // Step 2: Variants & Step 3: Images
  variants: z
    .array(
      z.object({
        id: z.string().optional(), // Used for edit, or temp ID for DnD
        name: z.string().optional(),
        sizeInstanceIds: z.array(z.string()).default([]),
        mainColorId: z.string().min(1, 'Main color is required'),
        identicalColorIds: z.array(z.string()).min(1, 'At least one identical color is required'),
        images: z
          .array(
            z.object({
              id: z.string().default(() => Math.random().toString(36).substring(7)), // temp ID or DB ID
              url: z.string(),
              isFeatured: z.boolean().default(false),
              sequence: z.number().int().optional(),
              file: z.any().optional(), // The actual File object before upload
            })
          )
          .default([]),
      })
    )
    .min(1, 'At least one variant is required'),

  // Step 4: Pricing — Pricing Engine v2
  ratePlanType: z.enum(['PER_DAY', 'FLAT_PERIOD', 'TIERED_DAILY', 'WEEKLY_MONTHLY', 'PERCENT_RETAIL']).optional(),
  ratePlanConfig: z.record(z.unknown()).optional(), // Validated per rate plan type at submit
  pricingComponents: z.array(z.object({
    type: z.string(),
    config: z.record(z.unknown()),
  })).default([]),

  // Late fee policy
  lateFeeEnabled: z.boolean().default(false),
  lateFeeGraceHours: z.number().int().optional(),
  lateFeeAmountMinor: z.number().int().optional(),
  lateFeeCapMinor: z.number().int().optional(),

  // Shipping (kept from legacy — not part of pricing engine)
  shippingMode: z.enum(['free', 'flat', 'area_based'] as [ShippingMode, ...ShippingMode[]]).default('free'),
  flatShippingFee: z.number().optional(),

  // Step 5: Size (schema-driven)
  productTypeId: z.string().optional(),
  sizeSchemaOverrideId: z.string().optional(),

  // Step 6: Details & FAQ
  details: z
    .array(
      z.object({
        header: z.string().min(1, 'Header is required'),
        items: z.array(
          z.object({
            key: z.string().min(1, 'Key is required'),
            value: z.string().min(1, 'Value is required'),
          })
        ),
      })
    )
    .optional(),
  faqs: z
    .array(
      z.object({
        question: z.string().min(1),
        answer: z.string().min(1),
      })
    )
    .optional(),
}).superRefine((data, ctx) => {
  // Pricing validation: rate plan type is required
  if (!data.ratePlanType) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Please select a pricing model', path: ['ratePlanType'] });
    return;
  }

  const config = data.ratePlanConfig;
  if (!config) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Pricing configuration is required', path: ['ratePlanConfig'] });
    return;
  }

  // Validate per rate plan type
  switch (data.ratePlanType) {
    case 'PER_DAY':
      if (!config.unitPriceMinor || Number(config.unitPriceMinor) <= 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Price per day is required', path: ['ratePlanConfig'] });
      }
      break;
    case 'FLAT_PERIOD':
      if (!config.flatPriceMinor || Number(config.flatPriceMinor) <= 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Package price is required', path: ['ratePlanConfig'] });
      }
      if (!config.includedDays || Number(config.includedDays) <= 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Included days is required', path: ['ratePlanConfig'] });
      }
      break;
    case 'TIERED_DAILY': {
      const tiers = config.tiers as Array<{ pricePerDayMinor: number }> | undefined;
      if (!tiers?.length) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'At least one pricing tier is required', path: ['ratePlanConfig'] });
      }
      break;
    }
    case 'WEEKLY_MONTHLY':
      if (!config.dailyPriceMinor || Number(config.dailyPriceMinor) <= 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Daily rate is required', path: ['ratePlanConfig'] });
      }
      break;
    case 'PERCENT_RETAIL':
      if (!config.percent || Number(config.percent) <= 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Rental percentage is required', path: ['ratePlanConfig'] });
      }
      break;
  }
});

export type ProductFormValues = z.infer<typeof productFormSchema>;
