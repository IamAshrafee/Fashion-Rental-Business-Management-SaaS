import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  IsUrl,
  IsHexColor,
  IsIn,
  MaxLength,
  MinLength,
  Min,
  Max,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';

// =========================================================================
// BRANDING + CONTACT + SOCIAL (PATCH /tenant/settings)
// =========================================================================

export class UpdateStoreSettingsDto {
  // Branding
  @IsOptional()
  @IsString()
  @MaxLength(200)
  businessName?: string;

  @IsOptional()
  @IsHexColor()
  primaryColor?: string;

  @IsOptional()
  @IsHexColor()
  secondaryColor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  tagline?: string;

  @IsOptional()
  @IsString()
  about?: string;

  // Contact
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  whatsapp?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @IsString()
  address?: string;

  // Social links — @Transform converts empty strings to undefined so
  // @IsOptional() + @IsUrl() correctly skips validation for blank fields.
  @IsOptional()
  @Transform(({ value }) => value || undefined)
  @IsUrl()
  @MaxLength(500)
  facebookUrl?: string;

  @IsOptional()
  @Transform(({ value }) => value || undefined)
  @IsUrl()
  @MaxLength(500)
  instagramUrl?: string;

  @IsOptional()
  @Transform(({ value }) => value || undefined)
  @IsUrl()
  @MaxLength(500)
  tiktokUrl?: string;

  @IsOptional()
  @Transform(({ value }) => value || undefined)
  @IsUrl()
  @MaxLength(500)
  youtubeUrl?: string;
}

// =========================================================================
// LOCALE (PATCH /tenant/locale)
// =========================================================================

export class UpdateLocaleSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(5)
  defaultLanguage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  timezone?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(2)
  country?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(3)
  currencyCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5)
  currencySymbol?: string;

  @IsOptional()
  @IsIn(['before', 'after'])
  currencyPosition?: string;

  @IsOptional()
  @IsIn(['south_asian', 'international'])
  numberFormat?: string;

  @IsOptional()
  @IsIn(['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'])
  dateFormat?: string;

  @IsOptional()
  @IsIn(['12h', '24h'])
  timeFormat?: string;

  @IsOptional()
  @IsIn(['saturday', 'sunday', 'monday'])
  weekStart?: string;
}

// =========================================================================
// PAYMENT (PATCH /tenant/payment-settings)
// =========================================================================

export class UpdatePaymentSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(20)
  bkashNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  nagadNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  sslcommerzStoreId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  sslcommerzStorePass?: string;

  @IsOptional()
  @IsBoolean()
  sslcommerzSandbox?: boolean;
}

// =========================================================================
// COURIER (PATCH /tenant/courier-settings)
// =========================================================================

export class UpdateCourierSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  defaultCourier?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  courierApiKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  courierSecretKey?: string;

  @IsOptional()
  @IsString()
  pickupAddress?: string;

  // ── Pathao-specific credentials ──────────────────────────────────────
  @IsOptional()
  @IsString()
  @MaxLength(255)
  pathaoClientId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  pathaoClientSecret?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  pathaoUsername?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  pathaoPassword?: string;

  @IsOptional()
  @IsInt()
  pathaoStoreId?: number;

  @IsOptional()
  @IsBoolean()
  pathaoSandbox?: boolean;

  // ── Pickup Scheduling ──────────────────────────────────────────────────
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(14)
  pickupLeadDays?: number;

  @IsOptional()
  pickupLeadDaysConfig?: Record<string, number>;
}

// =========================================================================
// OPERATIONAL (PATCH /tenant/operational-settings)
// =========================================================================

export class UpdateOperationalSettingsDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  maxConcurrentSessions?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(30)
  bufferDays?: number;

  @IsOptional()
  @IsBoolean()
  smsEnabled?: boolean;
}

// =========================================================================
// CUSTOM DOMAIN (POST /tenant/custom-domain)
// =========================================================================

export class SetCustomDomainDto {
  @IsString()
  @MaxLength(255)
  @Matches(/^[a-zA-Z0-9][a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, {
    message: 'Invalid domain format. Example: rentbysara.com',
  })
  domain!: string;
}
