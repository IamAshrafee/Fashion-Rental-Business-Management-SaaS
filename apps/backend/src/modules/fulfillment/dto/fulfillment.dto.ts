import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsInt,
  Min,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';

// ---------------------------------------------------------------------------
// Ship Order DTO
// ---------------------------------------------------------------------------

export enum CourierProviderEnum {
  PATHAO = 'pathao',
  STEADFAST = 'steadfast',
  MANUAL = 'manual',
}

/**
 * Body for POST /api/v1/owner/fulfillment/:bookingId/ship
 *
 * When useApi = true, the service will call the courier API to create a parcel
 * and auto-fill the tracking number.
 *
 * When useApi = false (or courierProvider = 'manual'), the owner provides
 * a tracking number manually (optional) and no API call is made.
 */
export class ShipOrderDto {
  @IsEnum(CourierProviderEnum)
  courierProvider!: CourierProviderEnum;

  /**
   * If true, P09 calls the courier API (Pathao/Steadfast) to create a parcel.
   * Must be false for 'manual' provider.
   */
  @IsBoolean()
  useApi!: boolean;

  /**
   * Manual tracking number (required when useApi = false or manual delivery).
   * Optional when useApi = true (will be filled from courier API response).
   */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  trackingNumber?: string;

  /**
   * Cash-on-delivery amount to collect. Integer (ADR-04).
   * Defaults to 0 (pre-paid or no COD).
   */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  codAmount?: number;

  /** Optional delivery instructions passed to the courier */
  @IsOptional()
  @IsString()
  specialInstruction?: string;
}

// ---------------------------------------------------------------------------
// Calculate Shipping Rate DTO
// ---------------------------------------------------------------------------

/**
 * Body for POST /api/v1/owner/fulfillment/rate
 * Returns estimated shipping cost from the courier API.
 */
export class CalculateRateDto {
  @IsEnum(CourierProviderEnum)
  courierProvider!: CourierProviderEnum;

  @IsString()
  @IsNotEmpty()
  pickupCity!: string;

  @IsString()
  @IsNotEmpty()
  deliveryCity!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  weightKg?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  codAmount?: number;
}

// ---------------------------------------------------------------------------
// Update Delivery Stage DTO
// ---------------------------------------------------------------------------

export enum DeliveryStageEnum {
  PREPARE_PARCEL = 'prepare_parcel',
  AWAITING_PICKUP = 'awaiting_pickup',
  IN_TRANSIT = 'in_transit',
  DELIVERED = 'delivered',
  ERROR = 'error',
}

/**
 * Body for PATCH /api/v1/owner/fulfillment/:bookingId/stage
 *
 * Allows the owner to manually advance or revert a delivery stage.
 * This supports manual courier workflows and error recovery.
 */
export class UpdateDeliveryStageDto {
  @IsEnum(DeliveryStageEnum)
  stage!: DeliveryStageEnum;

  /** Reason for the transition — required when stage = 'error' */
  @IsOptional()
  @IsString()
  reason?: string;
}

// ---------------------------------------------------------------------------
// Pathao Webhook Payload
// ---------------------------------------------------------------------------

/**
 * Pathao sends webhooks with order status updates.
 * We accept the full body generically and parse what we need.
 */
export interface PathaoWebhookPayload {
  /** Pathao's consignment ID = our trackingNumber */
  consignment_id: string;
  /** Pathao's merchant order ID = our bookingNumber */
  merchant_order_id: string;
  /** Current status string from Pathao */
  order_status: string;
  updated_at?: string;
}

// ---------------------------------------------------------------------------
// Steadfast Webhook Payload
// ---------------------------------------------------------------------------

/**
 * Steadfast webhook payload for delivery status updates.
 */
export interface SteadfastWebhookPayload {
  /** Steadfast's tracking code = our trackingNumber */
  tracking_code: string;
  /** Our invoice number = bookingNumber */
  invoice?: string;
  delivery_status: string;
  updated_at?: string;
}

