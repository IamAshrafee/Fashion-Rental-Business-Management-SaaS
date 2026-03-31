import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class ExtendSubscriptionDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  months?: number; // Number of months to extend (default 1)

  @IsOptional()
  @IsString()
  reason?: string;
}
