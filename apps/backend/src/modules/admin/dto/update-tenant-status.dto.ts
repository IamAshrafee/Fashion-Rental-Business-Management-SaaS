import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { TenantStatus } from '@prisma/client';

export class UpdateTenantStatusDto {
  @IsEnum(TenantStatus)
  @IsNotEmpty()
  status!: TenantStatus;

  @IsString()
  @IsOptional()
  reason?: string;
}
