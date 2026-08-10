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
  purchasePrice: z.number().int().nonnegative().optional(),
  showPurchasePrice: z.boolean().default(false),
  itemCountry: z.string().optional(),
  showCountry: z.boolean().default(false),
  targetRentals: z.number().int().optional(),

  // Step 2: Variants & Step 3: Images
  variants: z
    .array(
      z.object({
        id: z.string().optional(), // Used for edit, or temp ID for DnD
        clientKey: z.string().min(1).default(() => Math.random().toString(36).slice(2)),
        name: z.string().optional(),
        sizeInstanceIds: z.array(z.string()).min(1, 'At least one rentable size is required').default([]),
        inventoryBySizeId: z.record(z.object({
          trackingMode: z.enum(['POOLED', 'SERIALIZED']).default('POOLED'),
        })).default({}),
        skuIdBySizeInstanceId: z.record(z.string()).default({}),
        mainColorId: z.string().min(1, 'Main color is required'),
        identicalColorIds: z.array(z.string()).default([]),
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
  lateFeeGraceHours: z.number().int().nonnegative().optional(),
  lateFeeAmountMinor: z.number().int().nonnegative().optional(),
  lateFeeCapMinor: z.number().int().positive().optional(),

  // Delivery charge is stored as a versioned pricing component.
  shippingMode: z.enum(['free', 'flat'] as [ShippingMode, ...ShippingMode[]]).default('free'),
  flatShippingFee: z.number().int().nonnegative().optional(),

  // Step 5: Size (schema-driven)
  productTypeId: z.string().min(1, 'Product type is required'),
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

  // Step 5: auditable opening inventory receipt/registration
  openingInventorySkipped: z.boolean().default(false),
  openingInventoryLines: z.array(z.object({
    variantSizeId: z.string().min(1),
    label: z.string(),
    trackingMode: z.enum(['POOLED', 'SERIALIZED']),
    locationId: z.string().min(1, 'Choose an inventory location'),
    pooledQuantity: z.number().int().nonnegative().optional(),
    units: z.array(z.object({
      assetCode: z.string().min(1, 'Asset code is required'),
      barcode: z.string().optional(),
      condition: z.enum(['NEW', 'EXCELLENT', 'GOOD', 'FAIR', 'POOR', 'DAMAGED']).default('GOOD'),
      purchaseDate: z.string().optional(),
      purchasePrice: z.number().int().nonnegative().optional(),
      notes: z.string().optional(),
    })).default([]),
  })).default([]),
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

  const positiveInteger = (value: unknown) =>
    typeof value === 'number' && Number.isInteger(value) && value > 0;
  const nonNegativeInteger = (value: unknown) =>
    value === undefined || (typeof value === 'number' && Number.isInteger(value) && value >= 0);
  const pricingIssue = (message: string, path: Array<string | number> = ['ratePlanConfig']) =>
    ctx.addIssue({ code: z.ZodIssueCode.custom, message, path });

  switch (data.ratePlanType) {
    case 'PER_DAY': {
      if (!positiveInteger(config.unitPriceMinor)) pricingIssue('Price per day must be greater than zero');
      const minDays = config.minDays ?? 1;
      if (!positiveInteger(minDays)) pricingIssue('Minimum rental days must be at least 1');
      if (config.maxDays !== undefined && (!positiveInteger(config.maxDays) || Number(config.maxDays) < Number(minDays))) {
        pricingIssue('Maximum rental days cannot be lower than the minimum');
      }
      break;
    }
    case 'FLAT_PERIOD':
      if (!positiveInteger(config.flatPriceMinor)) pricingIssue('Package price must be greater than zero');
      if (!positiveInteger(config.includedDays)) pricingIssue('Included days must be at least 1');
      if (!nonNegativeInteger(config.extraDayPriceMinor)) pricingIssue('Extra-day price must be a valid amount');
      break;
    case 'TIERED_DAILY': {
      const tiers = config.tiers as Array<{ fromDay: number; toDay: number | null; pricePerDayMinor: number }> | undefined;
      if (!tiers?.length) {
        pricingIssue('At least one pricing tier is required');
        break;
      }
      let expectedFromDay = 1;
      tiers.forEach((tier, index) => {
        if (tier.fromDay !== expectedFromDay) pricingIssue(`Tier ${index + 1} must start on day ${expectedFromDay}`);
        if (!positiveInteger(tier.pricePerDayMinor)) pricingIssue(`Tier ${index + 1} needs a price greater than zero`);
        if (tier.toDay === null) {
          if (index !== tiers.length - 1) pricingIssue('Only the final tier can be open-ended');
        } else if (!positiveInteger(tier.toDay) || tier.toDay < tier.fromDay) {
          pricingIssue(`Tier ${index + 1} has an invalid end day`);
        } else {
          expectedFromDay = tier.toDay + 1;
        }
      });
      if (tiers[tiers.length - 1]?.toDay !== null) pricingIssue('The final tier must cover all later rental days');
      break;
    }
    case 'WEEKLY_MONTHLY':
      if (!positiveInteger(config.dailyPriceMinor)) pricingIssue('A daily fallback price greater than zero is required');
      if (!nonNegativeInteger(config.weeklyPriceMinor) || !nonNegativeInteger(config.monthlyPriceMinor)) pricingIssue('Weekly and monthly prices must be valid amounts');
      break;
    case 'PERCENT_RETAIL':
      if (typeof config.percent !== 'number' || config.percent <= 0 || config.percent > 100) pricingIssue('Rental percentage must be between 0 and 100');
      if (!data.purchasePrice || data.purchasePrice <= 0) pricingIssue('Enter a purchase price before using percentage-of-retail pricing', ['purchasePrice']);
      if (!nonNegativeInteger(config.minPriceMinor) || !nonNegativeInteger(config.maxPriceMinor)) pricingIssue('Minimum and maximum prices must be valid amounts');
      if (typeof config.minPriceMinor === 'number' && typeof config.maxPriceMinor === 'number' && config.maxPriceMinor > 0 && config.minPriceMinor > config.maxPriceMinor) pricingIssue('Maximum price cannot be lower than the minimum');
      break;
  }

  data.pricingComponents.forEach((component, index) => {
    const pricing = component.config.pricing as Record<string, unknown> | undefined;
    if (!pricing || !positiveInteger(pricing.amountMinor)) {
      pricingIssue('Enabled fees, deposits, and add-ons need an amount greater than zero', ['pricingComponents', index, 'config']);
    }
  });
  if (data.shippingMode === 'flat' && (!data.flatShippingFee || data.flatShippingFee <= 0)) {
    pricingIssue('Flat shipping fee must be greater than zero', ['flatShippingFee']);
  }
  if (data.lateFeeEnabled) {
    if (!data.lateFeeAmountMinor || data.lateFeeAmountMinor <= 0) pricingIssue('Late fee per day must be greater than zero', ['lateFeeAmountMinor']);
    if (data.lateFeeGraceHours === undefined) pricingIssue('Enter the late-fee grace period', ['lateFeeGraceHours']);
  }

  if (!data.openingInventorySkipped) {
    if (data.openingInventoryLines.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Add opening inventory or choose to add stock later',
        path: ['openingInventoryLines'],
      });
    }
    data.openingInventoryLines.forEach((line, index) => {
      if (line.trackingMode === 'POOLED' && (!line.pooledQuantity || line.pooledQuantity < 1)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Enter a positive opening quantity',
          path: ['openingInventoryLines', index, 'pooledQuantity'],
        });
      }
      if (line.trackingMode === 'SERIALIZED' && line.units.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Register at least one physical item',
          path: ['openingInventoryLines', index, 'units'],
        });
      }
    });
  }
});

export type ProductFormValues = z.infer<typeof productFormSchema>;
