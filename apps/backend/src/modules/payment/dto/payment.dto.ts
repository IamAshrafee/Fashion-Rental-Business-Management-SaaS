import {
  IsString,
  IsOptional,
  IsInt,
  IsNotEmpty,
  MaxLength,
  Min,
  Max,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

// ============================================================================
// PAYMENT RECORDING
// ============================================================================

const PAYMENT_METHODS = ['cod', 'bkash', 'nagad', 'sslcommerz'] as const;

export class RecordPaymentDto {
  @IsInt()
  @Min(1)
  amount!: number;

  @IsIn(PAYMENT_METHODS)
  method!: (typeof PAYMENT_METHODS)[number];

  @IsOptional()
  @IsString()
  @MaxLength(255)
  transactionId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

// ============================================================================
// SSLCOMMERZ
// ============================================================================

export class InitiatePaymentDto {
  @IsString()
  @IsNotEmpty()
  bookingId!: string;
}

// ============================================================================
// DEPOSIT MANAGEMENT
// ============================================================================

export class RefundDepositDto {
  @IsInt()
  @Min(0)
  refundAmount!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  refundMethod!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class ForfeitDepositDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}

// ============================================================================
// QUERY
// ============================================================================

export class PaymentQueryDto {
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
}
