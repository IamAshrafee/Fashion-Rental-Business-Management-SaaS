import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  AvailabilityPolicyScope,
  InventoryTrackingMode,
  InventoryLocationType,
  InventoryMovementType,
  StockConditionGrade,
  StockUnitDisposition,
  StockUnitOperationalState,
} from '@prisma/client';

export class InventorySkusQueryDto {
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

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsEnum(InventoryTrackingMode)
  trackingMode?: InventoryTrackingMode;

  @IsOptional()
  @IsUUID()
  locationId?: string;

  @IsOptional()
  @IsIn(['AVAILABLE', 'LOW_STOCK', 'UNAVAILABLE', 'UNCONFIGURED'])
  stockState?: 'AVAILABLE' | 'LOW_STOCK' | 'UNAVAILABLE' | 'UNCONFIGURED';

  @IsOptional()
  @IsIn(['PRODUCT', 'ON_HAND', 'AVAILABLE', 'RESERVED'])
  sort?: 'PRODUCT' | 'ON_HAND' | 'AVAILABLE' | 'RESERVED' = 'PRODUCT';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc' = 'asc';
}

export class InventoryItemsQueryDto {
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

  @IsOptional()
  @IsUUID()
  locationId?: string;

  @IsOptional()
  @IsEnum(StockUnitDisposition)
  disposition?: StockUnitDisposition;

  @IsOptional()
  @IsEnum(StockUnitOperationalState)
  operationalState?: StockUnitOperationalState;

  @IsOptional()
  @IsEnum(StockConditionGrade)
  condition?: StockConditionGrade;

  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsOptional()
  @IsUUID()
  variantSizeId?: string;

  @IsOptional()
  @IsIn(['OPEN_ISSUE', 'OPEN_SERVICE', 'INCOMPLETE_SET'])
  attention?: 'OPEN_ISSUE' | 'OPEN_SERVICE' | 'INCOMPLETE_SET';

  @IsOptional()
  @IsDateString()
  availableFrom?: string;

  @IsOptional()
  @IsDateString()
  availableTo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}

export class CreateInventoryLocationDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z0-9][A-Z0-9_-]{1,31}$/)
  code!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsEnum(InventoryLocationType)
  locationType!: InventoryLocationType;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  timezone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  addressLine1?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  addressLine2?: string;

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
  @MaxLength(32)
  postalCode?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{2}$/)
  country?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  contactName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  contactPhone?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(200)
  contactEmail?: string;

  @IsOptional()
  @IsBoolean()
  canStoreInventory?: boolean;

  @IsOptional()
  @IsBoolean()
  canFulfillRentals?: boolean;

  @IsOptional()
  @IsBoolean()
  canCustomerPickup?: boolean;

  @IsOptional()
  @IsBoolean()
  canAcceptReturns?: boolean;

  @IsOptional()
  @IsBoolean()
  canClean?: boolean;

  @IsOptional()
  @IsBoolean()
  canRepair?: boolean;

  @IsOptional()
  @IsBoolean()
  canTransfer?: boolean;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateInventoryLocationDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsEnum(InventoryLocationType)
  locationType?: InventoryLocationType;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  timezone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  addressLine1?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  addressLine2?: string;

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
  @MaxLength(32)
  postalCode?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{2}$/)
  country?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  contactName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  contactPhone?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(200)
  contactEmail?: string;

  @IsOptional()
  @IsBoolean()
  canStoreInventory?: boolean;

  @IsOptional()
  @IsBoolean()
  canFulfillRentals?: boolean;

  @IsOptional()
  @IsBoolean()
  canCustomerPickup?: boolean;

  @IsOptional()
  @IsBoolean()
  canAcceptReturns?: boolean;

  @IsOptional()
  @IsBoolean()
  canClean?: boolean;

  @IsOptional()
  @IsBoolean()
  canRepair?: boolean;

  @IsOptional()
  @IsBoolean()
  canTransfer?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class AdjustInventoryPoolDto {
  @IsUUID()
  locationId!: string;

  @IsIn(['RECEIVE', 'ADD', 'SUBTRACT', 'WRITE_OFF'])
  adjustmentType!: 'RECEIVE' | 'ADD' | 'SUBTRACT' | 'WRITE_OFF';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  quantity!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  expectedVersion!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  reorderThreshold?: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}

export class CountInventoryPoolDto {
  @IsUUID()
  locationId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  observedQuantity!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  expectedVersion!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}

export class InventoryMovementsQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page = 1;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit = 25;

  @IsOptional() @IsEnum(InventoryMovementType)
  movementType?: InventoryMovementType;

  @IsOptional() @IsUUID()
  productId?: string;

  @IsOptional() @IsUUID()
  variantSizeId?: string;

  @IsOptional() @IsUUID()
  stockUnitId?: string;

  @IsOptional() @IsUUID()
  inventoryPoolId?: string;

  @IsOptional() @IsUUID()
  locationId?: string;

  @IsOptional() @IsUUID()
  actorUserId?: string;

  @IsOptional() @IsUUID()
  bookingId?: string;

  @IsOptional() @IsUUID()
  transferId?: string;

  @IsOptional() @IsDateString()
  dateFrom?: string;

  @IsOptional() @IsDateString()
  dateTo?: string;

  @IsOptional() @IsString() @MaxLength(100)
  search?: string;
}

export class UpsertAvailabilityPolicyDto {
  @IsEnum(AvailabilityPolicyScope)
  scope!: AvailabilityPolicyScope;

  @IsOptional()
  @IsUUID()
  locationId?: string;

  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsOptional()
  @IsUUID()
  variantSizeId?: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  expectedVersion!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(43_200)
  preparationBufferMinutes?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(43_200)
  deliveryBufferMinutes?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(43_200)
  returnBufferMinutes?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(43_200)
  inspectionBufferMinutes?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(43_200)
  cleaningBufferMinutes?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(525_600)
  minimumNoticeMinutes?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1095)
  maximumAdvanceDays?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_080)
  pendingHoldMinutes?: number;

  @IsOptional()
  @IsBoolean()
  allowShortage?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10_000)
  shortageLimit?: number;

  @IsOptional()
  @IsBoolean()
  requireSingleLocationForBundle?: boolean;

  @IsOptional()
  @IsBoolean()
  allowCrossLocationTransfers?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(43_200)
  transferLeadTimeMinutes?: number;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsEnum(StockConditionGrade, { each: true })
  eligibleConditionGrades?: StockConditionGrade[];

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsEnum(StockUnitOperationalState, { each: true })
  eligibleOperationalStates?: StockUnitOperationalState[];
}

export class AvailabilityPolicyVersionDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}

export class ResolveAvailabilityPolicyQueryDto {
  @IsUUID()
  productId!: string;

  @IsUUID()
  variantSizeId!: string;

  @IsUUID()
  locationId!: string;
}
