import {
  IsString,
  IsOptional,
  IsInt,
  IsEmail,
  MinLength,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

// --- Create Customer DTO ---
export class CreateCustomerDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  fullName!: string;

  @IsString()
  @MinLength(5)
  @MaxLength(20)
  phone!: string;

  @IsOptional()
  @IsString()
  altPhone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  addressLine1?: string;

  @IsOptional()
  @IsString()
  addressLine2?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  postalCode?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

// --- Update Customer DTO ---
export class UpdateCustomerDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(200) fullName?: string;
  @IsOptional() @IsString() altPhone?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() addressLine1?: string;
  @IsOptional() @IsString() addressLine2?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() state?: string;
  @IsOptional() @IsString() postalCode?: string;
  @IsOptional() @IsString() country?: string;
  @IsOptional() @IsString() notes?: string;
}

// --- Customer Query DTO ---
export class CustomerQueryDto {
  @IsOptional() @IsInt() @Min(1) @Type(() => Number) page?: number;
  @IsOptional() @IsInt() @Min(1) @Type(() => Number) limit?: number;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() tag?: string;
  @IsOptional() @IsString() sort?: string;
  @IsOptional() @IsString() order?: string;
}

// --- Tag DTO ---
export class AddTagDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  tag!: string;
}
