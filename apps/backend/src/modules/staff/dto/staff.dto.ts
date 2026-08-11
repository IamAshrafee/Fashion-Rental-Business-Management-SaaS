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
  IsArray,
  ArrayUnique,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

// =========================================================================
// INVITE STAFF (POST /staff)
// =========================================================================

export class InviteStaffDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  fullName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @Transform(({ value }) => value || undefined)
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @IsIn(['manager', 'staff'])
  role!: 'manager' | 'staff';

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(
    [
      'manage_products',
      'manage_inventory',
      'manage_bookings',
      'manage_fulfillment',
      'view_customers',
      'manage_customers',
      'view_analytics',
      'manage_finance',
    ],
    { each: true },
  )
  permissions?: string[];
}

export class AcceptStaffInvitationDto {
  @IsString()
  @MinLength(32)
  @MaxLength(200)
  token!: string;

  @IsString()
  @MinLength(10)
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

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(
    [
      'manage_products',
      'manage_inventory',
      'manage_bookings',
      'manage_fulfillment',
      'view_customers',
      'manage_customers',
      'view_analytics',
      'manage_finance',
    ],
    { each: true },
  )
  permissions?: string[];
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
