import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  CustomerAddressKind,
  CustomerContactChannel,
  CustomerIdentityKind,
  CustomerStatus,
} from '@prisma/client';

export class CustomerIdentityInputDto {
  @IsEnum(CustomerIdentityKind)
  kind!: CustomerIdentityKind;

  @IsString()
  @MinLength(3)
  @MaxLength(254)
  value!: string;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

export class CustomerAddressInputDto {
  @IsOptional() @IsEnum(CustomerAddressKind) kind?: CustomerAddressKind;
  @IsOptional() @IsString() @MaxLength(80) label?: string;
  @IsOptional() @IsString() @MaxLength(200) recipientName?: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsString() @MinLength(3) @MaxLength(300) addressLine1!: string;
  @IsOptional() @IsString() @MaxLength(300) addressLine2?: string;
  @IsOptional() @IsString() @MaxLength(120) area?: string;
  @IsOptional() @IsString() @MaxLength(120) city?: string;
  @IsOptional() @IsString() @MaxLength(120) state?: string;
  @IsOptional() @IsString() @MaxLength(30) postalCode?: string;
  @IsOptional() @IsString() @MaxLength(2) country?: string;
  @IsOptional() @IsString() @MaxLength(500) instructions?: string;
  @IsOptional() @IsBoolean() isDefault?: boolean;
}

export class CreateCustomerDto {
  @IsString() @MinLength(2) @MaxLength(200) fullName!: string;
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => CustomerIdentityInputDto)
  identities!: CustomerIdentityInputDto[];
  @IsOptional() @ValidateNested() @Type(() => CustomerAddressInputDto)
  address?: CustomerAddressInputDto;
  @IsOptional() @IsEnum(CustomerContactChannel) preferredContactChannel?: CustomerContactChannel;
  @IsOptional() @IsString() @MaxLength(20) preferredLocale?: string;
  @IsOptional() @IsString() @MaxLength(80) source?: string;
  @IsOptional() @IsString() @MaxLength(2000) note?: string;
}

export class UpdateCustomerDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(200) fullName?: string;
  @IsOptional() @IsEnum(CustomerStatus) status?: CustomerStatus;
  @IsOptional() @IsEnum(CustomerContactChannel) preferredContactChannel?: CustomerContactChannel;
  @IsOptional() @IsString() @MaxLength(20) preferredLocale?: string;
  @IsOptional() @IsString() @MaxLength(80) source?: string;
}

export class CustomerQueryDto {
  @IsOptional() @IsInt() @Min(1) @Type(() => Number) page?: number;
  @IsOptional() @IsInt() @Min(1) @Type(() => Number) limit?: number;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsUUID() tagId?: string;
  @IsOptional() @IsEnum(CustomerStatus) status?: CustomerStatus;
  @IsOptional() @Transform(({ value }) => value === 'true') @IsBoolean() hasAccount?: boolean;
  @IsOptional() @IsString() sort?: string;
  @IsOptional() @IsEnum(['asc', 'desc']) order?: 'asc' | 'desc';
}

export class AddIdentityDto {
  @IsEnum(CustomerIdentityKind) kind!: CustomerIdentityKind;
  @IsString() @MinLength(3) @MaxLength(254) value!: string;
  @IsOptional() @IsBoolean() isPrimary?: boolean;
}

export class SetPrimaryIdentityDto {
  @IsUUID() identityId!: string;
}

export class AddAddressDto extends CustomerAddressInputDto {}

export class UpdateAddressDto {
  @IsOptional() @IsEnum(CustomerAddressKind) kind?: CustomerAddressKind;
  @IsOptional() @IsString() @MaxLength(80) label?: string;
  @IsOptional() @IsString() @MaxLength(200) recipientName?: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsOptional() @IsString() @MinLength(3) @MaxLength(300) addressLine1?: string;
  @IsOptional() @IsString() @MaxLength(300) addressLine2?: string;
  @IsOptional() @IsString() @MaxLength(120) area?: string;
  @IsOptional() @IsString() @MaxLength(120) city?: string;
  @IsOptional() @IsString() @MaxLength(120) state?: string;
  @IsOptional() @IsString() @MaxLength(30) postalCode?: string;
  @IsOptional() @IsString() @MaxLength(2) country?: string;
  @IsOptional() @IsString() @MaxLength(500) instructions?: string;
  @IsOptional() @IsBoolean() isDefault?: boolean;
}

export class AddNoteDto {
  @IsString() @MinLength(1) @MaxLength(2000) body!: string;
  @IsOptional() @IsBoolean() isPinned?: boolean;
}

export class RecordConsentDto {
  @IsString() @MinLength(2) @MaxLength(80) purpose!: string;
  @IsOptional() @IsEnum(CustomerContactChannel) channel?: CustomerContactChannel;
  @IsBoolean() granted!: boolean;
  @IsString() @MinLength(2) @MaxLength(80) source!: string;
}

export class CreateTagDefinitionDto {
  @IsString() @MinLength(1) @MaxLength(50) name!: string;
  @IsOptional() @IsString() @MaxLength(30) color?: string;
}

export class AssignTagDto {
  @IsUUID() tagId!: string;
}

export class MergeCustomerDto {
  @IsUUID() sourceCustomerId!: string;
}
