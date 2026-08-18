import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Max,
  Min,
  ValidateNested,
  ValidateIf,
} from 'class-validator';
import {
  InspectionCheckResult,
  InventoryMediaPurpose,
  InventoryServiceOrderType,
  InventoryServiceOrderStatus,
  StockConditionGrade,
  StockUnitComponentPresence,
  StockUnitDisposition,
  StockUnitInspectionDecision,
  StockUnitInspectionType,
  StockUnitInspectionStatus,
  StockUnitIssueStatus,
  StockUnitIssueResponsibility,
  StockUnitIssueSeverity,
  StockUnitOperationalState,
} from '@prisma/client';

export class InventoryAttentionQueryDto {
  @IsOptional()
  @IsIn(['INSPECTION', 'ISSUE'])
  kind: 'INSPECTION' | 'ISSUE' = 'INSPECTION';

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
  @IsEnum(StockUnitInspectionType)
  inspectionType?: StockUnitInspectionType;

  @IsOptional()
  @IsEnum(StockUnitInspectionStatus)
  inspectionStatus?: StockUnitInspectionStatus;

  @IsOptional()
  @IsEnum(StockUnitInspectionDecision)
  decision?: StockUnitInspectionDecision;

  @IsOptional()
  @IsEnum(StockUnitIssueStatus)
  issueStatus?: StockUnitIssueStatus;

  @IsOptional()
  @IsEnum(StockUnitIssueSeverity)
  severity?: StockUnitIssueSeverity;

  @IsOptional()
  @IsEnum(StockUnitIssueResponsibility)
  responsibility?: StockUnitIssueResponsibility;

  @IsOptional()
  @IsUUID()
  locationId?: string;

  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsOptional()
  @IsUUID()
  variantSizeId?: string;

  @IsOptional()
  @IsUUID()
  stockUnitId?: string;

  @IsOptional()
  @IsUUID()
  bookingId?: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;
}

export class InventoryServiceQueueQueryDto {
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
  @IsEnum(InventoryServiceOrderType)
  serviceType?: InventoryServiceOrderType;

  @IsOptional()
  @IsEnum(InventoryServiceOrderStatus)
  status?: InventoryServiceOrderStatus;

  @IsOptional()
  @IsUUID()
  locationId?: string;

  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsOptional()
  @IsUUID()
  variantSizeId?: string;

  @IsOptional()
  @IsUUID()
  stockUnitId?: string;

  @IsOptional()
  @IsUUID()
  issueId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  provider?: string;

  @IsOptional()
  @IsDateString()
  dueBefore?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5)
  overdue?: 'true' | 'false';
}

export class InventoryMediaInputDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  url!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  objectKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  mimeType?: string;

  @IsEnum(InventoryMediaPurpose)
  purpose!: InventoryMediaPurpose;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  caption?: string;

  @IsOptional()
  @IsDateString()
  capturedAt?: string;
}

export class ReplaceStockUnitReferenceMediaDto {
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => InventoryMediaInputDto)
  media!: InventoryMediaInputDto[];
}

export class TransitionStockUnitOperationalStateDto {
  @IsEnum(StockUnitOperationalState)
  targetState!: StockUnitOperationalState;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  idempotencyKey!: string;

  @IsOptional()
  @IsUUID()
  assignmentId?: string;

  @IsOptional()
  @IsUUID()
  serviceOrderId?: string;
}

export class ChangeStockUnitDispositionDto {
  @IsEnum(StockUnitDisposition)
  targetDisposition!: StockUnitDisposition;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  idempotencyKey?: string;
}

export class CreateStockUnitInspectionDto {
  @IsEnum(StockUnitInspectionType)
  inspectionType!: StockUnitInspectionType;

  @IsOptional()
  @IsUUID()
  bookingItemId?: string;

  @IsOptional()
  @IsUUID()
  assignmentId?: string;

  @ValidateIf(
    (dto: CreateStockUnitInspectionDto) =>
      dto.inspectionType === StockUnitInspectionType.PRE_RENTAL,
  )
  @IsUUID()
  bookingVersionId?: string;

  @IsOptional()
  @IsUUID()
  serviceOrderId?: string;

  @IsOptional()
  @IsUUID()
  amendsInspectionId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  idempotencyKey?: string;
}

export class InspectionCheckInputDto {
  @IsOptional()
  @IsUUID()
  setComponentDefinitionId?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  label!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedQuantity = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  observedQuantity?: number;

  @IsEnum(InspectionCheckResult)
  result!: InspectionCheckResult;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class InspectionIssueInputDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  issueType!: string;

  @IsEnum(StockUnitIssueSeverity)
  severity!: StockUnitIssueSeverity;

  @IsOptional()
  @IsEnum(StockUnitIssueResponsibility)
  responsibility?: StockUnitIssueResponsibility;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  description!: string;

  @IsOptional()
  @IsBoolean()
  isAvailabilityBlocking?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  estimatedCost?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  customerCharge?: number;
}

export class CompleteStockUnitInspectionDto {
  @IsEnum(StockConditionGrade)
  conditionAfter!: StockConditionGrade;

  @IsEnum(StockUnitInspectionDecision)
  decision!: StockUnitInspectionDecision;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  customerLiabilityNote?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => InspectionCheckInputDto)
  checks?: InspectionCheckInputDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => InspectionIssueInputDto)
  issues?: InspectionIssueInputDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => InventoryMediaInputDto)
  media?: InventoryMediaInputDto[];

  @IsOptional()
  @IsString()
  @MaxLength(120)
  idempotencyKey?: string;
}

export class ResolveStockUnitIssueDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  resolutionNotes!: string;

  @IsOptional()
  @IsBoolean()
  waive = false;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  idempotencyKey?: string;
}

export class CreateInventoryServiceOrderDto {
  @IsEnum(InventoryServiceOrderType)
  serviceType!: InventoryServiceOrderType;

  @IsOptional()
  @IsUUID()
  issueId?: string;

  @IsOptional()
  @IsUUID()
  sourceInspectionId?: string;

  @IsOptional()
  @IsBoolean()
  isAvailabilityBlocking = true;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  providerName?: string;

  @IsOptional()
  @IsUUID()
  serviceLocationId?: string;

  @IsOptional()
  @IsDateString()
  scheduledStartAt?: string;

  @IsOptional()
  @IsDateString()
  expectedCompletionAt?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  cost?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  idempotencyKey?: string;
}

export class StartInventoryServiceOrderDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  idempotencyKey?: string;
}

export class CompleteInventoryServiceOrderDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  completionOutcome!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  cost?: number;

  @IsOptional()
  @IsEnum(StockConditionGrade)
  conditionAfter?: StockConditionGrade;

  @IsOptional()
  @IsBoolean()
  requiresInspection = true;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  idempotencyKey?: string;
}

export class CancelInventoryServiceOrderDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  idempotencyKey?: string;
}

export class CreateSkuSetComponentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  requiredQuantity = 1;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  inspectionGuidance?: string;

  @IsOptional()
  @IsBoolean()
  absenceBlocksRental = true;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  displayOrder = 0;
}

export class UpdateStockUnitComponentStateDto {
  @IsEnum(StockUnitComponentPresence)
  presence!: StockUnitComponentPresence;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  presentQuantity!: number;

  @IsOptional()
  @IsEnum(StockConditionGrade)
  condition?: StockConditionGrade;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
