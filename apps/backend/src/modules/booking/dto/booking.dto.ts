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
} from 'class-validator';
import { Type } from 'class-transformer';

// ============================================================================
// SHARED ENUMS
// ============================================================================

export const PAYMENT_METHODS = ['cod', 'bkash', 'nagad', 'sslcommerz'] as const;
export type PaymentMethodType = (typeof PAYMENT_METHODS)[number];

export const DAMAGE_LEVELS = ['none', 'minor', 'moderate', 'severe', 'destroyed', 'lost'] as const;
export type DamageLevelType = (typeof DAMAGE_LEVELS)[number];

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
}

export class BookingItemDto extends CartItemDto {}

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
}

// ============================================================================
// STATUS TRANSITIONS
// ============================================================================

const BOOKING_STATUSES = [
  'pending',
  'confirmed',
  'cancelled',
  'shipped',
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

export class ShipBookingDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  courierProvider?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  trackingNumber?: string;

  @IsOptional()
  @IsBoolean()
  useCourierApi?: boolean;
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
