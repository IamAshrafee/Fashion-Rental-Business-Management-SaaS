import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
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
} from 'class-validator';
import {
  InventoryBlockType,
  InventoryTrackingMode,
  StockConditionGrade,
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
  @IsOptional()
  @IsEnum(InventoryTrackingMode)
  trackingMode?: InventoryTrackingMode;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100_000)
  pooledQuantity?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class CreateStockUnitDto {
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
  @IsString()
  @MaxLength(200)
  locationLabel?: string;

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
  @IsString()
  @MaxLength(200)
  locationLabel?: string;

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
}

export class StockUnitLifecycleDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}

export class CreateInventoryBlockDto {
  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsOptional()
  @IsUUID()
  variantId?: string;

  @IsOptional()
  @IsUUID()
  variantSizeId?: string;

  @IsOptional()
  @IsUUID()
  stockUnitId?: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsEnum(InventoryBlockType)
  blockType!: InventoryBlockType;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
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

