import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
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
  ValidateNested,
} from 'class-validator';
import { StorefrontItemVisibilityMode } from '@prisma/client';
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
  @IsString()
  @MaxLength(100)
  countryOfOrigin?: string;

  @IsOptional()
  @IsBoolean()
  countryOfOriginPublic?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000_000)
  referenceRetailValue?: number;

  @IsOptional()
  @IsBoolean()
  referenceRetailValuePublic?: boolean;

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

export class PublishOnboardedProductDto extends ProductOnboardingRevisionDto {}
