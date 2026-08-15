import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { TenantStatus } from '@prisma/client';

export class UpdateTenantStatusDto {
  @IsEnum(TenantStatus)
  @IsNotEmpty()
  status!: TenantStatus;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  reason?: string;
}
