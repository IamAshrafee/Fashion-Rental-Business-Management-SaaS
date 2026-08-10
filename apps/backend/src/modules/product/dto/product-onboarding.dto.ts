import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
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
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import {
  InventoryTrackingMode,
  StockConditionGrade,
  StorefrontItemVisibilityMode,
} from '@prisma/client';
import { CreateFaqDto, CreateDetailHeaderDto } from './product.dto';
import { SavePricingDto } from '../../pricing-engine/dto/pricing-engine.dto';

export class ProductOnboardingRevisionDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  expectedRevision!: number;
}

export class StartProductOnboardingDto {
  @IsString()
  @MinLength(2)
  @MaxLength(300)
  name!: string;

  @IsUUID()
  categoryId!: string;

  @IsOptional()
  @IsUUID()
  subcategoryId?: string;

  @IsUUID()
  productTypeId!: string;

  @IsOptional()
  @IsUUID()
  sizeSchemaOverrideId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  eventIds?: string[];

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
  @IsBoolean()
  purchasePricePublic?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  itemCountry?: string;

  @IsOptional()
  @IsBoolean()
  itemCountryPublic?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100_000)
  targetRentals?: number;

  @IsOptional()
  @IsEnum(StorefrontItemVisibilityMode)
  storefrontItemMode?: StorefrontItemVisibilityMode;
}

export class SaveProductBasicsDto extends StartProductOnboardingDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  expectedRevision!: number;
}

export class OnboardingSkuSizeDto {
  @IsUUID()
  sizeInstanceId!: string;

  @IsEnum(InventoryTrackingMode)
  trackingMode!: InventoryTrackingMode;
}

export class OnboardingVariantDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  clientKey!: string;

  @IsOptional()
  @IsUUID()
  id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  variantName?: string;

  @IsUUID()
  mainColorId!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  identicalColorIds?: string[];

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => OnboardingSkuSizeDto)
  sizes!: OnboardingSkuSizeDto[];
}

export class SaveProductSkusDto extends ProductOnboardingRevisionDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => OnboardingVariantDto)
  variants!: OnboardingVariantDto[];
}

export class SaveProductContentDto extends ProductOnboardingRevisionDto {
  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  description?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CreateFaqDto)
  faqs?: CreateFaqDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CreateDetailHeaderDto)
  details?: CreateDetailHeaderDto[];
}

export class SaveProductPricingSectionDto extends ProductOnboardingRevisionDto {
  @IsObject()
  @ValidateNested()
  @Type(() => SavePricingDto)
  pricing!: SavePricingDto;
}

export class OpeningPhysicalItemDto {
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
}

export class OpeningInventoryLineDto {
  @IsUUID()
  variantSizeId!: string;

  @IsUUID()
  locationId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  pooledQuantity?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => OpeningPhysicalItemDto)
  units?: OpeningPhysicalItemDto[];
}

export class SaveOpeningInventoryDto extends ProductOnboardingRevisionDto {
  @IsBoolean()
  skipInventory = false;

  @ValidateIf((input: SaveOpeningInventoryDto) => !input.skipInventory)
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => OpeningInventoryLineDto)
  lines?: OpeningInventoryLineDto[];
}

export class PublishOnboardedProductDto extends ProductOnboardingRevisionDto {}
