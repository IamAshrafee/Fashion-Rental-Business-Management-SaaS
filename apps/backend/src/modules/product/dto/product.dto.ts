import {
  IsString,
  IsOptional,
  IsInt,
  IsArray,
  ValidateNested,
  MinLength,
  Min,
  Max,
  IsIn,
  ArrayNotEmpty,
  ArrayMaxSize,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';

// --- FAQ DTOs ---
export class CreateFaqDto {
  @IsString() @MinLength(3) question!: string;
  @IsString() @MinLength(1) answer!: string;
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
  @IsIn(['draft', 'archived'])
  status!: 'draft' | 'archived';
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

// --- Storefront Showcase DTO (landing page APIs) ---
export class StorefrontShowcaseQueryDto {
  @IsOptional() @IsInt() @Min(1) @Type(() => Number) limit?: number; // default 12
  @IsOptional() @IsString() slug?: string; // category/subcategory/event slug (auto-detect if missing)
}
