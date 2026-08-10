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

const PAYMENT_METHODS = ['cod', 'bkash', 'nagad', 'sslcommerz'] as const;

export class RecordPaymentDto {
  @IsInt()
  @Min(1)
  amount!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  depositAmount?: number;

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
