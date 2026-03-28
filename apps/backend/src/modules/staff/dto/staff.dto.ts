import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNotEmpty,
  IsIn,
  IsEmail,
  MaxLength,
  MinLength,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

// =========================================================================
// INVITE STAFF (POST /staff)
// =========================================================================

export class InviteStaffDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  fullName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  phone!: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @IsIn(['manager', 'staff'])
  role!: 'manager' | 'staff';

  @IsString()
  @MinLength(6)
  @MaxLength(128)
  password!: string;
}

// =========================================================================
// UPDATE STAFF (PATCH /staff/:id)
// =========================================================================

export class UpdateStaffDto {
  @IsOptional()
  @IsIn(['manager', 'staff'])
  role?: 'manager' | 'staff';

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// =========================================================================
// STAFF QUERY (GET /staff)
// =========================================================================

export class StaffQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsString()
  search?: string;
}
