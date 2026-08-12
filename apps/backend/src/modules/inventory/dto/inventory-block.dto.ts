import { Transform, Type } from 'class-transformer';
import {
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
} from 'class-validator';
import { InventoryBlockType } from '@prisma/client';

export class InventoryBlocksQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 25;

  @IsOptional() @IsEnum(InventoryBlockType)
  blockType?: InventoryBlockType;

  @IsOptional() @IsUUID()
  productId?: string;

  @IsOptional() @IsUUID()
  variantSizeId?: string;

  @IsOptional() @IsUUID()
  stockUnitId?: string;

  @IsOptional() @IsUUID()
  locationId?: string;

  @IsOptional() @IsDateString()
  from?: string;

  @IsOptional() @IsDateString()
  to?: string;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === true || value === 'true')
  activeOnly = true;
}

export class CreateInventoryBlockDto {
  @IsOptional() @IsUUID()
  productId?: string;

  @IsOptional() @IsUUID()
  variantId?: string;

  @IsOptional() @IsUUID()
  variantSizeId?: string;

  @IsOptional() @IsUUID()
  stockUnitId?: string;

  @IsOptional() @IsUUID()
  locationId?: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsEnum(InventoryBlockType)
  blockType!: InventoryBlockType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}
