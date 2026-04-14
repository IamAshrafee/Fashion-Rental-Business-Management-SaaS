import { IsString, IsUUID, IsIn, IsOptional, IsObject } from 'class-validator';
import { StorefrontEventType } from '@closetrent/types';

export class StorefrontEventDto {
  @IsUUID(4, { message: 'sessionId must be a valid UUID v4' })
  sessionId!: string;

  @IsString()
  @IsIn(['product_view', 'add_to_cart', 'remove_from_cart', 'checkout_started'])
  eventType!: StorefrontEventType;

  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsString()
  variantId?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
