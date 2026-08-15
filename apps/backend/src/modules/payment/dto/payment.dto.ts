import {
  IsString,
  IsOptional,
  IsInt,
  IsNotEmpty,
  MaxLength,
  Min,
  Max,
  IsIn,
  IsBoolean,
  IsUUID,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';

// ============================================================================
// PAYMENT RECORDING
// ============================================================================

const MANUAL_PAYMENT_METHODS = ['cod', 'bkash', 'nagad'] as const;

export class RecordPaymentDto {
  @IsInt()
  @Min(1)
  amount!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  depositAmount?: number;

  @IsIn(MANUAL_PAYMENT_METHODS)
  method!: (typeof MANUAL_PAYMENT_METHODS)[number];

  @ValidateIf(
    (dto: RecordPaymentDto) =>
      dto.method === 'bkash' || dto.method === 'nagad' || dto.transactionId !== undefined,
  )
  @IsString()
  @IsNotEmpty()
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
  @IsUUID()
  bookingId!: string;

  @IsUUID()
  trackingToken!: string;
}

export class ReviewPaymentClaimDto {
  @IsBoolean()
  approve!: boolean;

  @ValidateIf((dto: ReviewPaymentClaimDto) => !dto.approve || dto.reason !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason?: string;
}

// ============================================================================
// DEPOSIT MANAGEMENT
// ============================================================================

export class SettleDepositDto {
  @IsBoolean()
  forfeit!: boolean;

  @IsInt()
  @Min(0)
  refundAmount!: number;

  @IsInt()
  @Min(0)
  deductionAmount!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  additionalCharge?: number;

  @ValidateIf((dto: SettleDepositDto) => !dto.forfeit && dto.refundAmount > 0)
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  refundMethod?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason!: string;

  @IsOptional()
  @IsUUID()
  damageReportId?: string;
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
