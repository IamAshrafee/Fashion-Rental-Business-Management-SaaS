import { z } from 'zod';
import {
  ProductStatus,
  PricingMode,
  LateFeeType,
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

  // Step 4: Pricing
  pricingMode: z.enum(['one_time', 'per_day', 'percentage'] as [PricingMode, ...PricingMode[]]).default('one_time'),
  rentalPrice: z.number().optional(), // required if one_time or per_day
  includedDays: z.number().int().optional(), // required if one_time or percentage
  pricePerDay: z.number().optional(), // required if per_day
  minimumDays: z.number().int().default(1),
  retailPrice: z.number().optional(), // required if percentage
  rentalPercentage: z.number().optional(), // required if percentage
  minPrice: z.number().optional(),
  maxDiscount: z.number().optional(),
  extendedRentalRate: z.number().optional(),
  lateFeeType: z.enum(['fixed', 'percentage'] as [LateFeeType, ...LateFeeType[]]).default('fixed'),
  lateFeePerDay: z.number().optional(), // fixed amount per day
  lateFeePercentage: z.number().optional(), // percentage per day (when type=percentage)
  maxLateFeeCap: z.number().optional(), // cap on total late fees
  shippingMode: z.enum(['free', 'flat', 'area_based'] as [ShippingMode, ...ShippingMode[]]).default('free'),
  flatShippingFee: z.number().optional(),

  // Step 5: Size (schema-driven)
  productTypeId: z.string().optional(),
  sizeSchemaOverrideId: z.string().optional(),

  // Step 6: Services
  securityDeposit: z.number().optional(),
  cleaningFee: z.number().optional(),
  enableBackupSize: z.boolean().default(false),
  backupSizeFee: z.number().optional(),
  enableTryOn: z.boolean().default(false),
  tryOnFee: z.number().optional(),
  tryOnDuration: z.number().int().optional(), // In DAYS (converted to hours in submit hook)
  creditTryOnFee: z.boolean().default(false),

  // Step 7: Details & FAQ
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
  if (data.pricingMode === 'one_time') {
    if (data.rentalPrice == null) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Rental price required', path: ['rentalPrice'] });
    if (data.includedDays == null) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Included days required', path: ['includedDays'] });
  } else if (data.pricingMode === 'per_day') {
    if (data.pricePerDay == null) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Price per day required', path: ['pricePerDay'] });
  } else if (data.pricingMode === 'percentage') {
    if (data.retailPrice == null) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Retail price required', path: ['retailPrice'] });
    if (data.rentalPercentage == null) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Rental percentage required', path: ['rentalPercentage'] });
    if (data.includedDays == null) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Included days required', path: ['includedDays'] });
  }
});

export type ProductFormValues = z.infer<typeof productFormSchema>;
