import {
  IsString,
  IsOptional,
  IsInt,
  IsArray,
  IsEnum,
  IsBoolean,
  IsDateString,
  ValidateNested,
  IsObject,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

// --- Quote API ---

export class CustomerContextDto {
  @IsOptional() @IsString() customerTier?: string;
  @IsOptional() @IsString() channel?: string;
  @IsOptional() @IsString() location?: string;
}

export class GetQuoteDto {
  @IsString() productId!: string;
  @IsOptional() @IsString() variantId?: string;
  @IsDateString() startAt!: string;
  @IsDateString() endAt!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CustomerContextDto)
  context?: CustomerContextDto;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  selectedAddons?: string[];
}

// --- Admin: Save full pricing config ---

export class RatePlanInputDto {
  @IsEnum(['PER_DAY', 'FLAT_PERIOD', 'TIERED_DAILY', 'WEEKLY_MONTHLY', 'PERCENT_RETAIL'])
  type!: string;

  @IsOptional() @IsInt() @Min(1) priority?: number;

  @IsObject()
  config!: Record<string, unknown>;
}

export class ComponentInputDto {
  @IsEnum(['FEE', 'DEPOSIT', 'DISCOUNT', 'ADDON', 'SURCHARGE'])
  type!: string;

  @IsOptional() @IsInt() @Min(1) priority?: number;

  @IsOptional()
  @IsEnum(['CUSTOMER', 'STAFF_ONLY'])
  visibility?: string;

  @IsOptional()
  @IsEnum(['AT_BOOKING', 'AT_PICKUP', 'AT_RETURN', 'POST_RETURN'])
  chargeTiming?: string;

  @IsOptional() @IsBoolean() refundable?: boolean;

  @IsObject()
  config!: Record<string, unknown>;
}

export class LateFeeInputDto {
  @IsBoolean() enabled!: boolean;
  @IsOptional() @IsInt() @Min(0) graceHours?: number;
  @IsOptional() @IsEnum(['PER_DAY', 'FLAT', 'PERCENT_BASE']) mode?: string;
  @IsOptional() @IsInt() amountMinor?: number;
  @IsOptional() @IsInt() percent?: number;
  @IsOptional() @IsInt() totalCapMinor?: number;
}

export class SavePricingDto {
  @ValidateNested()
  @Type(() => RatePlanInputDto)
  ratePlan!: RatePlanInputDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ComponentInputDto)
  components?: ComponentInputDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => LateFeeInputDto)
  lateFeePolicy?: LateFeeInputDto;
}

// --- Admin: Simulate ---

export class SimulatePricingDto {
  @IsString() productId!: string;
  @IsDateString() startAt!: string;
  @IsDateString() endAt!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  selectedAddons?: string[];
}
