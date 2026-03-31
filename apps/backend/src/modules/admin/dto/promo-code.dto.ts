import { IsBoolean, IsDateString, IsInt, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';

export class CreatePromoCodeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @Matches(/^[A-Z0-9_-]+$/, {
    message: 'Code must be uppercase letters, numbers, hyphens, and underscores only',
  })
  code!: string;

  @IsOptional()
  @IsString()
  linkedPlanId?: string; // Auto-assign this plan on registration

  @IsOptional()
  @IsInt()
  @Min(1)
  trialDays?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  discountPct?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxUses?: number; // null = unlimited

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdatePromoCodeDto {
  @IsOptional()
  @IsString()
  linkedPlanId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  trialDays?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  discountPct?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxUses?: number;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
