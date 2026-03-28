/**
 * Courier Provider Interface — P09 Order Fulfillment & Logistics
 *
 * Abstract contract that every courier adapter must implement.
 * This enables plug-and-play courier support without changing core order logic.
 */

// ---------------------------------------------------------------------------
// Shared Input Types
// ---------------------------------------------------------------------------

export interface CreateParcelParams {
  /** The tenant's booking/order number, used as merchant_order_id */
  merchantOrderId: string;
  /** Recipient customer full name */
  recipientName: string;
  /** Recipient primary phone */
  recipientPhone: string;
  /** Full delivery address string */
  recipientAddress: string;
  /** Recipient city / district (string label, e.g. "Dhaka") */
  recipientCity: string;
  /** Recipient zone / area (string label, e.g. "Dhanmondi") */
  recipientZone?: string;
  /** Amount to collect on delivery (COD). Integer (ADR-04). 0 = no COD */
  codAmount: number;
  /** Optional instructions for the courier */
  specialInstruction?: string;
  /** Estimated weight in kg */
  weightKg?: number;
  /** Total item quantity in the parcel */
  itemQuantity?: number;
}

export interface ShippingRateParams {
  /** Pickup city/district (tenant's store location) */
  pickupCity: string;
  /** Delivery city/district (customer's address) */
  deliveryCity: string;
  /** Estimated weight in kg */
  weightKg?: number;
  /** COD amount (affects courier fee for some providers) */
  codAmount?: number;
}

// ---------------------------------------------------------------------------
// Shared Output Types
// ---------------------------------------------------------------------------

export interface ParcelResult {
  /** Courier's tracking / consignment ID */
  trackingId: string;
  /** Raw order status from the courier at creation time */
  status: string;
  /** Estimated delivery fee (Int, ADR-04) — may be 0 if unknown */
  deliveryFee: number;
  /** Raw response from the courier API for debugging */
  raw?: unknown;
}

export interface TrackingResult {
  /** Normalised tracking ID */
  trackingId: string;
  /** Courier's raw status string */
  rawStatus: string;
  /**
   * Our normalised status mapping:
   * - 'in_transit' — picked up / on the way
   * - 'delivered'  — confirmed delivered to recipient
   * - 'returned'   — returned to sender
   * - 'unknown'    — any other courier status
   */
  normalisedStatus: 'in_transit' | 'delivered' | 'returned' | 'unknown';
  /** Last update timestamp from the courier */
  updatedAt?: Date;
  /** Raw response from the courier API */
  raw?: unknown;
}

export interface ShippingRate {
  /** Estimated shipping cost (Int, ADR-04) */
  cost: number;
  /** Currency code (e.g. "BDT") */
  currency: string;
  /** Human-readable breakdown or notes */
  note?: string;
}

export interface CancelResult {
  success: boolean;
  message: string;
}

// ---------------------------------------------------------------------------
// Provider Interface
// ---------------------------------------------------------------------------

/**
 * Every courier adapter must implement this interface.
 * Methods may throw HttpException or ServiceUnavailableException on API failure.
 */
export interface CourierProvider {
  /**
   * Create a parcel with the courier and return its tracking ID.
   */
  createParcel(params: CreateParcelParams): Promise<ParcelResult>;

  /**
   * Retrieve live tracking status from the courier.
   */
  trackParcel(trackingId: string): Promise<TrackingResult>;

  /**
   * Cancel a parcel at the courier.
   * Some providers do not support cancellation — they MUST throw NotImplementedException.
   */
  cancelParcel(trackingId: string): Promise<CancelResult>;

  /**
   * Calculate shipping rate between two locations.
   * Returns null if the provider does not support rate calculation.
   */
  calculateShipping(params: ShippingRateParams): Promise<ShippingRate | null>;
}

// ---------------------------------------------------------------------------
// Courier Provider Names
// ---------------------------------------------------------------------------

export type CourierProviderName = 'pathao' | 'steadfast' | 'manual';

// ---------------------------------------------------------------------------
// Tenant Courier Config Shapes (stored in StoreSettings.courierSettings JSONB)
// ---------------------------------------------------------------------------

export interface PathaoConfig {
  enabled: boolean;
  clientId: string;
  clientSecret: string;
  username: string;
  password: string;
  /** Pathao store/merchant ID to use for parcel creation */
  defaultStoreId: number;
}

export interface SteadfastConfig {
  enabled: boolean;
  apiKey: string;
  secretKey: string;
}

export interface CourierSettings {
  defaultProvider?: CourierProviderName;
  pathao?: PathaoConfig;
  steadfast?: SteadfastConfig;
}
