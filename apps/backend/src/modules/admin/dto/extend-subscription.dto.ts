import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class ExtendSubscriptionDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(24)
  months?: number; // Number of months to extend (default 1)

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
