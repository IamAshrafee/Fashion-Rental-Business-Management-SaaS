import {
  IsString,
  IsEnum,
  IsOptional,
  IsArray,
  IsBoolean,
  IsInt,
  IsDateString,
  ValidateNested,
  Min,
  Max,
  IsIn,
  IsNotEmpty,
  MaxLength,
  MinLength,
  IsUUID,
  ArrayMaxSize,
  ArrayMinSize,
  ValidateIf,
  IsEmail,
} from 'class-validator';
import { Type } from 'class-transformer';

// ============================================================================
// SHARED ENUMS
// ============================================================================

export const PAYMENT_METHODS = ['cod', 'bkash', 'nagad', 'sslcommerz'] as const;
export type PaymentMethodType = (typeof PAYMENT_METHODS)[number];

export const BOOKING_LIST_MAX_LIMIT = 250;

export const DAMAGE_LEVELS = ['none', 'minor', 'moderate', 'severe', 'destroyed', 'lost'] as const;
export type DamageLevelType = (typeof DAMAGE_LEVELS)[number];

export const DISCOUNT_TYPES = ['flat', 'percentage'] as const;
export type DiscountType = (typeof DISCOUNT_TYPES)[number];

export const BOOKING_HANDOVER_METHODS = ['DELIVERY', 'CUSTOMER_PICKUP'] as const;
export const BOOKING_RETURN_METHODS = ['BUSINESS_PICKUP', 'CUSTOMER_RETURN'] as const;

// ============================================================================
// CART VALIDATION
// ============================================================================

export class CartItemDto {
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @IsString()
  @IsNotEmpty()
  variantId!: string;

  @IsUUID()
  variantSizeId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  quantity = 1;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsOptional()
  @IsString()
  selectedSize?: string;

  @IsOptional()
  @IsString()
  backupSize?: string;

  @IsOptional()
  @IsBoolean()
  tryOn?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => BookingCompositionSelectionDto)
  compositionSelections?: BookingCompositionSelectionDto[];
}

export class BookingCompositionSelectionDto {
  @IsUUID()
  compositionRuleId!: string;

  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsOptional()
  @IsUUID()
  variantSizeId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  quantity?: number;
}

export class ValidateCartDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20) // H5 FIX: Prevent excessively large cart validations
  @ValidateNested({ each: true })
  @Type(() => CartItemDto)
  items!: CartItemDto[];

  @IsOptional()
  @IsBoolean()
  issueCheckoutQuote?: boolean;
}

export class StorefrontCartLineDto extends CartItemDto {
  @IsUUID()
  lineKey!: string;

  @IsOptional()
  displaySnapshot?: Record<string, unknown>;
}

export class ReplaceStorefrontCartDto {
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => StorefrontCartLineDto)
  items!: StorefrontCartLineDto[];
}

// ============================================================================
// BOOKING CREATION
// ============================================================================

export class CustomerInfoDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(200)
  fullName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  phone!: string;

  @IsOptional()
  @IsString()
  altPhone?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;
}

export class DeliveryAddressDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  address!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  area?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  thana?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  district?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  state?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  postalCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2)
  country?: string;

  @IsOptional()
  extra?: Record<string, unknown>;

  // ── Delivery recipient override (may differ from customer) ──
  @IsOptional()
  @IsString()
  @MaxLength(200)
  deliveryName?: string;

  @IsOptional()
  @IsString()
  deliveryPhone?: string;

  @IsOptional()
  @IsString()
  deliveryAltPhone?: string;
}

export class BookingItemDto extends CartItemDto {
  /** Per-item price override for manual bookings */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100_000_000)
  priceOverride?: number;

  @ValidateIf((item: BookingItemDto) => item.priceOverride !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  priceOverrideReason?: string;
}

export class InitialPaymentDto {
  @IsInt()
  @Min(1)
  @Max(100_000_000)
  amount!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100_000_000)
  depositAmount?: number;

  @IsEnum(PAYMENT_METHODS)
  method!: PaymentMethodType;

  @IsOptional()
  @IsString()
  transactionId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class DiscountDto {
  @IsEnum(DISCOUNT_TYPES)
  type!: DiscountType;

  @IsInt()
  @Min(0)
  @Max(100_000_000)
  value!: number; // flat amount in paisa OR percentage (e.g. 10 = 10%)

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}

export class ManualRentalPlanDto {
  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsUUID()
  sourceLocationId!: string;

  @IsIn(BOOKING_HANDOVER_METHODS)
  handoverMethod!: (typeof BOOKING_HANDOVER_METHODS)[number];

  @IsIn(BOOKING_RETURN_METHODS)
  returnMethod!: (typeof BOOKING_RETURN_METHODS)[number];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  handoverNotes?: string;

  @IsOptional()
  @IsBoolean()
  allowTransferPlan?: boolean;
}

export class CreateManualBookingQuoteDto {
  @ValidateNested()
  @Type(() => ManualRentalPlanDto)
  plan!: ManualRentalPlanDto;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => BookingItemDto)
  items!: BookingItemDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => DiscountDto)
  discount?: DiscountDto;
}

export class CreateBookingDto {
  @ValidateNested()
  @Type(() => CustomerInfoDto)
  customer!: CustomerInfoDto;

  @ValidateNested()
  @Type(() => DeliveryAddressDto)
  delivery!: DeliveryAddressDto;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20) // H5 FIX: Prevent excessively large bookings
  @ValidateNested({ each: true })
  @Type(() => BookingItemDto)
  items!: BookingItemDto[];

  @IsEnum(PAYMENT_METHODS)
  paymentMethod!: PaymentMethodType;

  @IsOptional()
  @IsUUID()
  checkoutQuoteId?: string;

  @IsOptional()
  @IsString()
  @MinLength(64)
  @MaxLength(64)
  checkoutQuoteHash?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  customerNotes?: string;

  @ValidateIf((dto: CreateBookingDto) => dto.paymentMethod === 'bkash')
  @IsString()
  @MinLength(5)
  @MaxLength(100)
  bkashTransactionId?: string;

  @ValidateIf((dto: CreateBookingDto) => dto.paymentMethod === 'nagad')
  @IsString()
  @MinLength(5)
  @MaxLength(100)
  nagadTransactionId?: string;

  // ── Manual booking power-ups ──

  /** Internal notes visible only to tenant staff */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  internalNotes?: string;

  /** Record an upfront payment atomically with the booking */
  @IsOptional()
  @ValidateNested()
  @Type(() => InitialPaymentDto)
  initialPayment?: InitialPaymentDto;

  /** Discount applied to the order */
  @IsOptional()
  @ValidateNested()
  @Type(() => DiscountDto)
  discount?: DiscountDto;
}

export class CreateManualBookingDto extends CreateBookingDto {
  @IsUUID()
  quoteId!: string;

  @IsString()
  @MinLength(64)
  @MaxLength(64)
  quoteHash!: string;

  @ValidateNested()
  @Type(() => ManualRentalPlanDto)
  plan!: ManualRentalPlanDto;
}

// ============================================================================
// STATUS TRANSITIONS
// ============================================================================

const BOOKING_STATUSES = [
  'pending',
  'confirmed',
  'cancelled',
  'delivered',
  'overdue',
  'returned',
  'inspected',
  'completed',
] as const;

export class UpdateBookingStatusDto {
  @IsEnum(BOOKING_STATUSES)
  status!: (typeof BOOKING_STATUSES)[number];
}

export class CancelBookingDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}

export class AddNoteDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  note!: string;
}

// ============================================================================
// DAMAGE REPORT
// ============================================================================

export class CreateDamageReportDto {
  @IsOptional()
  @IsUUID()
  stockUnitIssueId?: string;

  @IsEnum(DAMAGE_LEVELS)
  damageLevel!: DamageLevelType;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  estimatedRepairCost?: number;

  @IsInt()
  @Min(0)
  deductionAmount!: number;

  @IsInt()
  @Min(0)
  additionalCharge!: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(4)
  @MaxLength(2048, { each: true })
  photos?: string[];
}

// ============================================================================
// QUERY / FILTERS
// ============================================================================

export class BookingQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(BOOKING_LIST_MAX_LIMIT)
  limit?: number = 20;

  @IsOptional()
  @IsIn(BOOKING_STATUSES)
  status?: (typeof BOOKING_STATUSES)[number];

  @IsOptional()
  @IsIn(['REQUEST', 'ASSIGNMENT', 'PREPARATION', 'HANDOFF', 'ACTIVE', 'RETURN_DUE', 'RETURN_INTAKE', 'INSPECTION', 'EXCEPTION', 'CLOSED'])
  queue?: 'REQUEST' | 'ASSIGNMENT' | 'PREPARATION' | 'HANDOFF' | 'ACTIVE' | 'RETURN_DUE' | 'RETURN_INTAKE' | 'INSPECTION' | 'EXCEPTION' | 'CLOSED';

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  /** Filter bookings where any item's rental period overlaps with this start date */
  @IsOptional()
  @IsDateString()
  itemDateFrom?: string;

  /** Filter bookings where any item's rental period overlaps with this end date */
  @IsOptional()
  @IsDateString()
  itemDateTo?: string;

  @IsOptional()
  @IsString()
  @IsIn(['unpaid', 'partial', 'paid'])
  paymentStatus?: string;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc';

  @IsOptional()
  @IsIn(['createdAt', 'grandTotal'])
  sort?: 'createdAt' | 'grandTotal';
}

export class BookingCalendarQueryDto {
  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;
}

export class CheckAvailabilityDto {
  @IsUUID()
  variantSizeId!: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  quantity = 1;
}
