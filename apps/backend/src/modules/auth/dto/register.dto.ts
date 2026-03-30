import {
  IsString,
  IsEmail,
  IsOptional,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class RegisterDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  fullName!: string;

  @IsOptional()
  @Transform(({ value }) => value || undefined)
  @IsEmail()
  email?: string;

  @IsString()
  @Matches(/^01[3-9]\d{8}$/, {
    message: 'Phone must be a valid BD number (01X-XXXX-XXXX)',
  })
  phone!: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @Matches(/^(?=.*[A-Z])(?=.*\d)/, {
    message: 'Password must contain at least 1 uppercase letter and 1 number',
  })
  password!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  businessName!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(30)
  @Matches(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, {
    message: 'Subdomain must be lowercase letters, numbers, and hyphens only',
  })
  subdomain!: string;
}
