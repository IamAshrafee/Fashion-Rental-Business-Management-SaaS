import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  CompositionPricingBehavior,
  CompositionSkuResolution,
  CompositionSubstitutionPolicy,
  FulfillmentApprovalStatus,
  FulfillmentEventType,
  ProductCompositionRole,
} from '@prisma/client';

export class CompositionAlternativeInputDto {
  @IsUUID()
  productId!: string;

  @IsOptional()
  @IsUUID()
  variantSizeId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  priority = 0;

  @IsOptional()
  @IsObject()
  compatibilityRule?: Record<string, unknown>;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(-1_000_000_000)
  @Max(1_000_000_000)
  priceAdjustment = 0;
}

export class CreateCompositionRuleDto {
  @IsEnum(ProductCompositionRole)
  role!: ProductCompositionRole;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsUUID()
  componentProductId?: string;

  @IsOptional()
  @IsUUID()
  fixedVariantSizeId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  selectionGroupKey?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  quantity = 1;

  @IsEnum(CompositionSkuResolution)
  skuResolution!: CompositionSkuResolution;

  @IsOptional()
  @IsEnum(CompositionSubstitutionPolicy)
  substitutionPolicy: CompositionSubstitutionPolicy = CompositionSubstitutionPolicy.NOT_ALLOWED;

  @IsOptional()
  @IsEnum(CompositionPricingBehavior)
  pricingBehavior: CompositionPricingBehavior = CompositionPricingBehavior.INCLUDED;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000_000)
  priceAdjustment = 0;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000)
  allocationWeight = 1;

  @IsOptional()
  @IsBoolean()
  isDefaultSelected = false;

  @IsOptional()
  @IsBoolean()
  customerApprovalRequired = false;

  @IsOptional()
  @IsObject()
  compatibilityRules?: Record<string, unknown>;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  displayOrder = 0;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CompositionAlternativeInputDto)
  alternatives?: CompositionAlternativeInputDto[];
}

export class UpdateCompositionRuleDto extends CreateCompositionRuleDto {}

export class FulfillmentSelectionDto {
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
  quantity?: number;
}

export class SubstituteFulfillmentRequirementDto {
  @IsUUID()
  productId!: string;

  @IsUUID()
  variantSizeId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason!: string;

  @IsOptional()
  @IsObject()
  compatibilityResult?: Record<string, unknown>;

  @IsOptional()
  @IsEnum(FulfillmentApprovalStatus)
  approvalStatus?: FulfillmentApprovalStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  priceImpact = 0;
}

export class RecordFulfillmentEventDto {
  @IsEnum(FulfillmentEventType)
  eventType!: FulfillmentEventType;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('4', { each: true })
  assignmentIds?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(120)
  idempotencyKey?: string;
}

export class ExtendFulfillmentRequirementDto {
  @IsDateString()
  rentalEndDate!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason!: string;
}
