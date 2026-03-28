import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpdatePlanDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  priceMonthly?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  priceAnnual?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxProducts?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxStaff?: number;

  @IsOptional()
  @IsBoolean()
  customDomain?: boolean;

  @IsOptional()
  @IsBoolean()
  smsEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  analyticsFull?: boolean;

  @IsOptional()
  @IsBoolean()
  removeBranding?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  displayOrder?: number;
}
