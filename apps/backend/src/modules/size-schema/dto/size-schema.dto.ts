import {
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  IsEnum,
  IsObject,
  MinLength,
  MaxLength,
  IsInt,
  Min,
  IsUUID,
  ArrayNotEmpty,
  ArrayMaxSize,
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

  @IsOptional() @IsInt() @Min(0)
  sortOrder?: number;
}

export class UpdateSizeSchemaDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(50)
  code?: string;

  @IsOptional() @IsString() @MinLength(2) @MaxLength(100)
  name?: string;

  @IsOptional() @IsString() @MaxLength(255)
  description?: string;

  @IsOptional() @IsEnum(['STANDARD', 'MULTI_PART', 'FREE_SIZE'])
  schemaType?: string;

  @IsOptional() @IsObject()
  definition?: Record<string, unknown>;
}

export class CreateSizeInstanceDto {
  @IsUUID()
  sizeSchemaId!: string;

  @IsString() @MinLength(1) @MaxLength(100)
  displayLabel!: string;

  @IsOptional() @IsObject()
  payload?: Record<string, unknown>;

  @IsOptional() @IsInt() @Min(0)
  sortOrder?: number;
}

export class CreateSizeInstancesBulkDto {
  @IsUUID()
  schemaId!: string;

  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(100, { each: true })
  labels!: string[];
}

export class SizeChartRowDto {
  @IsString() @MinLength(1) @MaxLength(100)
  sizeLabel!: string;

  @IsObject()
  measurements!: Record<string, unknown>;

  @IsOptional() @IsInt() @Min(0)
  sortOrder?: number;
}

export class CreateSizeChartDto {
  @IsUUID()
  sizeSchemaId!: string;

  @IsOptional() @IsUUID()
  productId?: string;

  @IsOptional() @IsString() @MaxLength(200)
  title?: string;

  @IsOptional() @IsObject()
  chartMeta?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => SizeChartRowDto)
  rows?: SizeChartRowDto[];
}

export class UpdateSizeChartDto {
  @IsOptional() @IsString() @MaxLength(200)
  title?: string;

  @IsOptional() @IsObject()
  chartMeta?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => SizeChartRowDto)
  rows?: SizeChartRowDto[];
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
