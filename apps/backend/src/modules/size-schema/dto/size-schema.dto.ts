import {
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  IsEnum,
  IsObject,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSizeSchemaDto {
  @IsString() @MinLength(2) @MaxLength(50)
  code!: string;

  @IsString() @MinLength(2) @MaxLength(100)
  name!: string;

  @IsOptional() @IsString() @MaxLength(255)
  description?: string;

  @IsOptional() @IsEnum(['STANDARD', 'MULTI_PART', 'FREE_SIZE'])
  schemaType?: string;

  @IsOptional() @IsObject()
  definition?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSizeInstanceSubsetDto)
  instances?: CreateSizeInstanceSubsetDto[];
}

export class CreateSizeInstanceSubsetDto {
  @IsString() @MinLength(1) @MaxLength(100)
  displayLabel!: string;

  @IsOptional()
  sortOrder?: number;
}

export class UpdateSizeSchemaDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(100)
  name?: string;

  @IsOptional() @IsString() @MaxLength(255)
  description?: string;

  @IsOptional() @IsEnum(['STANDARD', 'MULTI_PART', 'FREE_SIZE'])
  schemaType?: string;

  @IsOptional() @IsEnum(['DRAFT', 'PUBLISHED', 'ARCHIVED'])
  status?: string;

  @IsOptional() @IsObject()
  definition?: Record<string, unknown>;
}

export class CreateSizeInstanceDto {
  @IsString()
  sizeSchemaId!: string;

  @IsString() @MinLength(1) @MaxLength(100)
  displayLabel!: string;

  @IsOptional() @IsObject()
  payload?: Record<string, unknown>;

  @IsOptional()
  sortOrder?: number;
}

export class CreateSizeChartDto {
  @IsString()
  sizeSchemaId!: string;

  @IsOptional() @IsString()
  productId?: string;

  @IsOptional() @IsString() @MaxLength(200)
  title?: string;

  @IsOptional() @IsObject()
  chartMeta?: Record<string, unknown>;

  @IsOptional()
  rows?: Array<{
    sizeLabel: string;
    measurements: Record<string, unknown>;
    sortOrder?: number;
  }>;
}

export class CreateProductTypeDto {
  @IsString() @MinLength(2) @MaxLength(100)
  name!: string;

  @IsOptional() @IsString() @MaxLength(255)
  description?: string;

  @IsOptional() @IsString()
  defaultSizeSchemaId?: string;
}

export class UpdateProductTypeDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(100)
  name?: string;

  @IsOptional() @IsString() @MaxLength(255)
  description?: string;

  @IsOptional() @IsString()
  defaultSizeSchemaId?: string;
}
