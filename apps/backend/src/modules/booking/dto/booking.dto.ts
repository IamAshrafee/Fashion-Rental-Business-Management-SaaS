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
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';

// ============================================================================
// SHARED ENUMS
// ============================================================================

export const PAYMENT_METHODS = ['cod', 'bkash', 'nagad', 'sslcommerz'] as const;
export type PaymentMethodType = (typeof PAYMENT_METHODS)[number];

export const DAMAGE_LEVELS = ['none', 'minor', 'moderate', 'severe', 'destroyed', 'lost'] as const;
export type DamageLevelType = (typeof DAMAGE_LEVELS)[number];

export const DISCOUNT_TYPES = ['flat', 'percentage'] as const;
export type DiscountType = (typeof DISCOUNT_TYPES)[number];

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
}

export class ValidateCartDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CartItemDto)
  items!: CartItemDto[];
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
  phone!: string;

  @IsOptional()
  @IsString()
  altPhone?: string;

  @IsOptional()
  @IsString()
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
  priceOverride?: number;
}

export class InitialPaymentDto {
  @IsInt()
  @Min(1)
  amount!: number;

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

  @IsNumber()
  @Min(0)
  value!: number; // flat amount in paisa OR percentage (e.g. 10 = 10%)

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class CreateBookingDto {
  @ValidateNested()
  @Type(() => CustomerInfoDto)
  customer!: CustomerInfoDto;

  @ValidateNested()
  @Type(() => DeliveryAddressDto)
  delivery!: DeliveryAddressDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BookingItemDto)
  items!: BookingItemDto[];

  @IsEnum(PAYMENT_METHODS)
  paymentMethod!: PaymentMethodType;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  customerNotes?: string;

  @IsOptional()
  @IsString()
  bkashTransactionId?: string;

  @IsOptional()
  @IsString()
  nagadTransactionId?: string;

  // ── Manual booking power-ups ──

  /** Internal notes visible only to tenant staff */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  internalNotes?: string;

  /** Skip pending → create as confirmed immediately */
  @IsOptional()
  @IsBoolean()
  autoConfirm?: boolean;

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
  photos?: string[];
}

// ============================================================================
// DATE BLOCKING
// ============================================================================

export class BlockDatesDto {
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
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
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  status?: string;

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
  order?: string;
}

export class AvailabilityQueryDto {
  @IsString()
  @IsNotEmpty()
  month!: string; // Format: YYYY-MM
}

export class CheckAvailabilityDto {
  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;
}
