/**
 * Courier Provider Interface — P09 Order Fulfillment & Logistics
 *
 * Abstract contract that every courier adapter must implement.
 * This enables plug-and-play courier support without changing core order logic.
 */

// ---------------------------------------------------------------------------
// Courier Status Types (granular tracking)
// ---------------------------------------------------------------------------

/** All possible granular courier statuses used across providers */
export type CourierStatusSlug =
  | 'pickup_pending'
  | 'pickup_assigned'
  | 'pickup_failed'
  | 'picked_up'
  | 'at_hub'
  | 'in_transit'
  | 'at_destination'
  | 'out_for_delivery'
  | 'delivered'
  | 'partial_delivered'
  | 'returned_to_sender'
  | 'cancelled'
  | 'on_hold'
  | 'unknown';

/** A single timeline event stored in booking.courierStatusHistory JSONB */
export interface CourierStatusEvent {
  status: CourierStatusSlug;
  label: string;
  timestamp: string; // ISO 8601
  source: 'system' | 'pathao' | 'steadfast' | 'webhook';
}

/** Human-readable labels for each courier status */
export const COURIER_STATUS_LABELS: Record<CourierStatusSlug, string> = {
  pickup_pending: 'Pickup Requested',
  pickup_assigned: 'Courier Assigned for Pickup',
  pickup_failed: 'Pickup Request Failed',
  picked_up: 'Parcel Picked Up by Courier',
  at_hub: 'At Sorting Hub',
  in_transit: 'In Transit to Destination',
  at_destination: 'Arrived at Destination Hub',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  partial_delivered: 'Partial Delivery',
  returned_to_sender: 'Returned to Sender',
  cancelled: 'Shipment Cancelled',
  on_hold: 'On Hold',
  unknown: 'Status Update',
};

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
  /** If true, use Pathao sandbox URL instead of production */
  sandbox?: boolean;
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

// ---------------------------------------------------------------------------
// Pickup Lead Days Configuration (for 'smart' mode)
// ---------------------------------------------------------------------------

export interface PickupLeadDaysConfig {
  /** Lead days for same-city deliveries (e.g., Dhaka → Dhaka) */
  same_city: number;
  /** Lead days for inter-city deliveries between major cities */
  inter_city: number;
  /** Lead days for remote/rural areas */
  remote: number;
}

/** Major cities in Bangladesh for smart lead days calculation */
export const MAJOR_CITIES_BD = [
  'dhaka', 'chittagong', 'chattogram', 'rajshahi', 'khulna',
  'sylhet', 'rangpur', 'barisal', 'barishal', 'comilla', 'cumilla',
  'gazipur', 'narayanganj', 'mymensingh',
];
