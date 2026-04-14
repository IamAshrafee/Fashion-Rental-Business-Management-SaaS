import {
  IsString,
  IsOptional,
  IsInt,
  IsArray,
  IsEnum,
  IsBoolean,
  IsDateString,
  ValidateNested,
  MinLength,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

// --- Pricing DTO ---
export class SetPricingDto {
  @IsEnum(['one_time', 'per_day', 'percentage'])
  mode!: 'one_time' | 'per_day' | 'percentage';

  @IsOptional() @IsInt() rentalPrice?: number;
  @IsOptional() @IsInt() @Min(1) includedDays?: number;
  @IsOptional() @IsInt() pricePerDay?: number;
  @IsOptional() @IsInt() @Min(1) minimumDays?: number;
  @IsOptional() @IsInt() retailPrice?: number;
  @IsOptional() @IsInt() rentalPercentage?: number; // stored as whole number (20 = 20%)
  @IsOptional() @IsInt() priceOverride?: number;
  @IsOptional() @IsInt() minInternalPrice?: number;
  @IsOptional() @IsInt() maxDiscountPrice?: number;
  @IsOptional() @IsInt() extendedRentalRate?: number;

  @IsOptional() @IsEnum(['fixed', 'percentage', 'per_day']) lateFeeType?: string;
  @IsOptional() @IsInt() lateFeeAmount?: number;
  @IsOptional() @IsInt() lateFeePercentage?: number;
  @IsOptional() @IsInt() maxLateFee?: number;

  @IsOptional() @IsEnum(['flat', 'calculated', 'free']) shippingMode?: string;
  @IsOptional() @IsInt() shippingFee?: number;
}

// --- Services DTO ---
export class SetServicesDto {
  @IsOptional() @IsInt() depositAmount?: number;
  @IsOptional() @IsInt() cleaningFee?: number;
  @IsOptional() @IsBoolean() backupSizeEnabled?: boolean;
  @IsOptional() @IsInt() backupSizeFee?: number;
  @IsOptional() @IsBoolean() tryOnEnabled?: boolean;
  @IsOptional() @IsInt() tryOnFee?: number;
  @IsOptional() @IsInt() @Min(1) tryOnDurationHours?: number;
  @IsOptional() @IsBoolean() tryOnCreditToRental?: boolean;
}

// --- Size DTOs ---
export class SizeMeasurementDto {
  @IsString() label!: string;
  @IsString() value!: string;
  @IsOptional() @IsString() unit?: string;
}

export class SizePartDto {
  @IsString() partName!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SizeMeasurementDto)
  measurements!: SizeMeasurementDto[];
}

export class SetSizeDto {
  @IsEnum(['standard', 'measurement', 'multi_part', 'free'])
  mode!: string;

  @IsOptional() @IsArray() @IsString({ each: true }) availableSizes?: string[];
  @IsOptional() @IsString() sizeChartUrl?: string;
  @IsOptional() @IsString() mainDisplaySize?: string;
  @IsOptional() @IsEnum(['free_size', 'adjustable', 'no_size']) freeSizeType?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SizeMeasurementDto)
  measurements?: SizeMeasurementDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SizePartDto)
  parts?: SizePartDto[];
}

// --- FAQ DTOs ---
export class CreateFaqDto {
  @IsString() @MinLength(3) question!: string;
  @IsString() @MinLength(1) answer!: string;
}

export class UpdateFaqDto {
  @IsOptional() @IsString() @MinLength(3) question?: string;
  @IsOptional() @IsString() @MinLength(1) answer?: string;
  @IsOptional() @IsInt() @Min(0) sequence?: number;
}

// --- Detail DTOs ---
export class DetailEntryDto {
  @IsString() key!: string;
  @IsString() value!: string;
}

export class CreateDetailHeaderDto {
  @IsString() @MinLength(2) headerName!: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DetailEntryDto)
  entries?: DetailEntryDto[];

  @IsOptional() @IsInt() @Min(0) sequence?: number;
}

export class UpdateDetailHeaderDto {
  @IsOptional() @IsString() @MinLength(2) headerName?: string;
  @IsOptional() @IsInt() @Min(0) sequence?: number;
}

// --- Variant DTOs ---
export class CreateVariantDto {
  @IsOptional() @IsString() variantName?: string;
  @IsString() mainColorId!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  identicalColorIds?: string[];

  @IsOptional() @IsInt() @Min(0) sequence?: number;
}

export class UpdateVariantDto {
  @IsOptional() @IsString() variantName?: string;
  @IsOptional() @IsString() mainColorId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  identicalColorIds?: string[];

  @IsOptional() @IsInt() @Min(0) sequence?: number;
}

// --- Reorder DTO ---
export class ReorderDto {
  @IsArray()
  @IsString({ each: true })
  ids!: string[];
}

// --- Product Status DTO ---
export class UpdateProductStatusDto {
  @IsEnum(['draft', 'published', 'archived'])
  status!: 'draft' | 'published' | 'archived';
}

// --- Product Query DTO ---
export class ProductQueryDto {
  @IsOptional() @IsInt() @Min(1) @Type(() => Number) page?: number;
  @IsOptional() @IsInt() @Min(1) @Type(() => Number) limit?: number;
  @IsOptional() @IsString() sort?: string;
  @IsOptional() @IsString() order?: string;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() subcategory?: string;
  @IsOptional() @IsString() event?: string;
  @IsOptional() @IsString() color?: string;
  @IsOptional() @IsString() size?: string;
  @IsOptional() @IsInt() @Type(() => Number) minPrice?: number;
  @IsOptional() @IsInt() @Type(() => Number) maxPrice?: number;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() availableFrom?: string;
  @IsOptional() @IsString() availableTo?: string;
}

// --- Create Product DTO (full nested) ---
export class CreateProductDto {
  @IsString() @MinLength(2) @MaxLength(300) name!: string;
  @IsOptional() @IsString() description?: string;
  @IsString() categoryId!: string;
  @IsOptional() @IsString() subcategoryId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  eventIds?: string[];

  @IsOptional() @IsEnum(['draft', 'published']) status?: string;
  @IsOptional() @IsDateString() purchaseDate?: string;
  @IsOptional() @IsInt() purchasePrice?: number;
  @IsOptional() @IsBoolean() purchasePricePublic?: boolean;
  @IsOptional() @IsString() itemCountry?: string;
  @IsOptional() @IsBoolean() itemCountryPublic?: boolean;
  @IsOptional() @IsInt() targetRentals?: number;

  @IsOptional() @ValidateNested() @Type(() => SetPricingDto) pricing?: SetPricingDto;
  @IsOptional() @ValidateNested() @Type(() => SetServicesDto) services?: SetServicesDto;
  @IsOptional() @ValidateNested() @Type(() => SetSizeDto) size?: SetSizeDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateFaqDto)
  faqs?: CreateFaqDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateDetailHeaderDto)
  details?: CreateDetailHeaderDto[];
}

export class UpdateProductDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(300) name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() categoryId?: string;
  @IsOptional() @IsString() subcategoryId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  eventIds?: string[];

  @IsOptional() @IsDateString() purchaseDate?: string;
  @IsOptional() @IsInt() purchasePrice?: number;
  @IsOptional() @IsBoolean() purchasePricePublic?: boolean;
  @IsOptional() @IsString() itemCountry?: string;
  @IsOptional() @IsBoolean() itemCountryPublic?: boolean;
  @IsOptional() @IsInt() targetRentals?: number;

  @IsOptional() @ValidateNested() @Type(() => SetPricingDto) pricing?: SetPricingDto;
  @IsOptional() @ValidateNested() @Type(() => SetServicesDto) services?: SetServicesDto;
  @IsOptional() @ValidateNested() @Type(() => SetSizeDto) size?: SetSizeDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateFaqDto)
  faqs?: CreateFaqDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateDetailHeaderDto)
  details?: CreateDetailHeaderDto[];
}

// --- Date Block DTOs ---
export class CreateDateBlockDto {
  @IsDateString() startDate!: string;
  @IsDateString() endDate!: string;
  @IsOptional() @IsString() reason?: string;
}

// --- Storefront Showcase DTO (landing page APIs) ---
export class StorefrontShowcaseQueryDto {
  @IsOptional() @IsInt() @Min(1) @Type(() => Number) limit?: number; // default 12
  @IsOptional() @IsString() slug?: string; // category/subcategory/event slug (auto-detect if missing)
}
