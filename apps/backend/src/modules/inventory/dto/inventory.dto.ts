import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  InventoryTrackingMode,
  StockConditionGrade,
  StockUnitComponentPresence,
} from '@prisma/client';

export class PublicAvailabilityQueryDto {
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

export class InventoryCalendarQueryDto {
  @IsDateString()
  from!: string;

  @IsDateString()
  to!: string;

  @IsOptional()
  @IsUUID()
  variantSizeId?: string;
}

export class ConfigureVariantSizeInventoryDto {
  @IsEnum(InventoryTrackingMode)
  trackingMode!: InventoryTrackingMode;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class CreateStockUnitDto {
  @IsUUID()
  locationId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  assetCode!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  barcode?: string;

  @IsOptional()
  @IsEnum(StockConditionGrade)
  condition?: StockConditionGrade;

  @IsOptional()
  @IsDateString()
  purchaseDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000_000)
  purchasePrice?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @IsBoolean()
  storefrontVisible?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  publicConditionNote?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(-100_000_000)
  @Max(100_000_000)
  rentalPriceAdjustment?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  estimatedCurrentValue?: number;
}

export class BatchStockUnitRowDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  assetCode!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  barcode?: string;
}

export class InitialStockUnitComponentDto {
  @IsUUID()
  definitionId!: string;

  @IsOptional()
  @IsEnum(StockUnitComponentPresence)
  presence: StockUnitComponentPresence = StockUnitComponentPresence.PRESENT;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  presentQuantity?: number;

  @IsOptional()
  @IsEnum(StockConditionGrade)
  condition?: StockConditionGrade;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class RegisterStockUnitBatchDto {
  @IsUUID()
  locationId!: string;

  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => BatchStockUnitRowDto)
  rows!: BatchStockUnitRowDto[];

  @IsOptional()
  @IsEnum(StockConditionGrade)
  condition?: StockConditionGrade;

  @IsOptional()
  @IsDateString()
  purchaseDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000_000)
  purchasePrice?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => InitialStockUnitComponentDto)
  componentStates?: InitialStockUnitComponentDto[];

  @IsUUID()
  idempotencyKey!: string;
}

export class UpdateStockUnitDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  assetCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  barcode?: string;

  @IsOptional()
  @IsEnum(StockConditionGrade)
  condition?: StockConditionGrade;

  @IsOptional()
  @IsDateString()
  purchaseDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  purchasePrice?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @IsOptional()
  @IsBoolean()
  storefrontVisible?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  publicConditionNote?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(-100_000_000)
  @Max(100_000_000)
  rentalPriceAdjustment?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  estimatedCurrentValue?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  storefrontSortOrder?: number;
}

export class StockUnitLifecycleDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}

export class AssignStockUnitsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  stockUnitIds!: string[];
}

export class ReleaseAssignmentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}
