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
  ValidateNested,
} from 'class-validator';
import { InventoryTransferStatus, InventoryTransferUnitOutcome } from '@prisma/client';

export class ListInventoryTransfersQueryDto {
  @IsOptional()
  @IsEnum(InventoryTransferStatus)
  status?: InventoryTransferStatus;
}

export class CreateInventoryTransferLineDto {
  @IsUUID()
  variantSizeId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  stockUnitIds!: string[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class CreateInventoryTransferDto {
  @IsUUID()
  originLocationId!: string;

  @IsUUID()
  destinationLocationId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CreateInventoryTransferLineDto)
  lines!: CreateInventoryTransferLineDto[];

  @IsOptional()
  @IsDateString()
  expectedDispatchAt?: string;

  @IsOptional()
  @IsDateString()
  expectedArrivalAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  idempotencyKey?: string;
}

export class InventoryTransferActionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  idempotencyKey?: string;
}

export class ReceiveInventoryTransferUnitDto {
  @IsUUID()
  stockUnitId!: string;

  @IsEnum(InventoryTransferUnitOutcome)
  outcome!: InventoryTransferUnitOutcome;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class ReceiveInventoryTransferLineDto {
  @IsUUID()
  transferLineId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => ReceiveInventoryTransferUnitDto)
  units!: ReceiveInventoryTransferUnitDto[];
}

export class ReceiveInventoryTransferDto extends InventoryTransferActionDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ReceiveInventoryTransferLineDto)
  lines!: ReceiveInventoryTransferLineDto[];
}
