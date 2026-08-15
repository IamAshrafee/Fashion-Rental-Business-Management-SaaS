import {
  IsString,
  IsOptional,
  IsInt,
  IsArray,
  IsEnum,
  IsBoolean,
  ValidateNested,
  MinLength,
  MaxLength,
  Min,
  Max,
  IsIn,
  ArrayNotEmpty,
  ArrayMaxSize,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';
import { StorefrontItemVisibilityMode } from '@prisma/client';

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
export class VariantSizeInventoryDto {
  @IsString()
  sizeInstanceId!: string;
}

export class CreateVariantDto {
  @IsOptional() @IsString() variantName?: string;
  @IsString() mainColorId!: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VariantSizeInventoryDto)
  sizes?: VariantSizeInventoryDto[];

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
  @ValidateNested({ each: true })
  @Type(() => VariantSizeInventoryDto)
  sizes?: VariantSizeInventoryDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  identicalColorIds?: string[];

  @IsOptional() @IsInt() @Min(0) sequence?: number;
}

// --- Reorder DTO ---
export class ReorderDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(100)
  @IsUUID('4', { each: true })
  ids!: string[];
}

export class SyncProductImagesDto extends ReorderDto {
  @IsUUID('4')
  featuredImageId!: string;
}

// --- Product Status DTO ---
export class UpdateProductStatusDto {
  @IsEnum(['draft', 'published', 'archived'])
  status!: 'draft' | 'published' | 'archived';
}

// --- Product Query DTO ---
export class ProductQueryDto {
  @IsOptional() @IsInt() @Min(1) @Type(() => Number) page?: number;
  @IsOptional() @IsInt() @Min(1) @Max(100) @Type(() => Number) limit?: number;
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

export class OwnerProductQueryDto extends ProductQueryDto {
  @IsOptional()
  @IsIn(['draft', 'published', 'archived', 'trash'])
  status?: 'draft' | 'published' | 'archived' | 'trash';

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  productTypeId?: string;

  @IsOptional()
  @IsIn(['ready', 'needs_attention'])
  readiness?: 'ready' | 'needs_attention';

  @IsOptional()
  @IsIn(['in_stock', 'no_stock'])
  stockState?: 'in_stock' | 'no_stock';

  @IsOptional()
  @IsIn(['name', 'status', 'createdAt', 'updatedAt'])
  sort?: 'name' | 'status' | 'createdAt' | 'updatedAt';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc';
}

export class UpdateProductDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(300) name?: string;
  @IsOptional() @IsString() description?: string | null;
  @IsOptional() @IsString() categoryId?: string;
  @IsOptional() @IsString() subcategoryId?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  eventIds?: string[];

  @IsOptional() @IsString() @MaxLength(100) countryOfOrigin?: string | null;
  @IsOptional() @IsBoolean() countryOfOriginPublic?: boolean;
  @IsOptional() @IsInt() @Min(0) referenceRetailValue?: number | null;
  @IsOptional() @IsBoolean() referenceRetailValuePublic?: boolean;
  @IsOptional() @IsEnum(StorefrontItemVisibilityMode) storefrontItemMode?: StorefrontItemVisibilityMode;

  @IsOptional() @IsString() productTypeId?: string;
  @IsOptional() @IsString() sizeSchemaOverrideId?: string | null;

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

// --- Storefront Showcase DTO (landing page APIs) ---
export class StorefrontShowcaseQueryDto {
  @IsOptional() @IsInt() @Min(1) @Type(() => Number) limit?: number; // default 12
  @IsOptional() @IsString() slug?: string; // category/subcategory/event slug (auto-detect if missing)
}
