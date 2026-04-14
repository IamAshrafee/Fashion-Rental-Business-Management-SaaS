/**
 * Courier Provider Interface — Order Fulfillment & Logistics
 *
 * Abstract contract that every courier adapter must implement.
 * This enables plug-and-play courier support without changing core order logic.
 */

// ---------------------------------------------------------------------------
// Courier Status Types (granular tracking)
// ---------------------------------------------------------------------------

/** All possible granular courier statuses used across providers */
export type CourierStatusSlug =
  | 'prepare_parcel'
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
  | 'error'
  | 'unknown';

/** A single timeline event stored in booking.courierStatusHistory JSONB */
export interface CourierStatusEvent {
  status: CourierStatusSlug;
  label: string;
  timestamp: string; // ISO 8601
  source: 'system' | 'pathao' | 'steadfast' | 'webhook' | 'manual';
}

/** Human-readable labels for each courier status */
export const COURIER_STATUS_LABELS: Record<CourierStatusSlug, string> = {
  prepare_parcel: 'Prepare Parcel',
  pickup_pending: 'Awaiting Pickup',
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
  error: 'Error — Requires Attention',
  unknown: 'Status Update',
};

// ---------------------------------------------------------------------------
// Delivery Stage Groups (for dashboard)
// ---------------------------------------------------------------------------

/** High-level delivery stage groups shown in the deliveries dashboard */
export type DeliveryStageGroup =
  | 'prepare_parcel'
  | 'awaiting_pickup'
  | 'in_transit'
  | 'delivered'
  | 'error';

/** Maps each granular courier status to its dashboard stage group */
export const COURIER_STATUS_TO_STAGE: Record<CourierStatusSlug, DeliveryStageGroup> = {
  prepare_parcel: 'prepare_parcel',
  pickup_pending: 'awaiting_pickup',
  pickup_assigned: 'awaiting_pickup',
  pickup_failed: 'error',
  picked_up: 'in_transit',
  at_hub: 'in_transit',
  in_transit: 'in_transit',
  at_destination: 'in_transit',
  out_for_delivery: 'in_transit',
  delivered: 'delivered',
  partial_delivered: 'error',
  returned_to_sender: 'error',
  cancelled: 'error',
  on_hold: 'error',
  error: 'error',
  unknown: 'error',
};

/** The allowed manual delivery stage values owners can set */
export const MANUAL_DELIVERY_STAGES: DeliveryStageGroup[] = [
  'prepare_parcel',
  'awaiting_pickup',
  'in_transit',
  'delivered',
  'error',
];

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
// District-Based Pickup Lead Days Configuration
// ---------------------------------------------------------------------------

/**
 * District-based lead days config stored in StoreSettings.pickupLeadDaysConfig.
 * Each district maps to a number of lead days (1, 2, or 3).
 * Districts not in the map use defaultLeadDays.
 */
export interface DistrictLeadDaysConfig {
  /** Map of district name (lowercase) → lead days (1, 2, or 3) */
  districtLeadDays: Record<string, number>;
  /** Fallback lead days for districts not explicitly mapped */
  defaultLeadDays: number;
}

// ---------------------------------------------------------------------------
// Bangladesh Districts (64 total)
// ---------------------------------------------------------------------------

/** All 64 districts of Bangladesh for pre-populating settings */
export const BANGLADESH_DISTRICTS: string[] = [
  // Dhaka Division
  'Dhaka', 'Gazipur', 'Narayanganj', 'Tangail', 'Kishoreganj',
  'Manikganj', 'Munshiganj', 'Narsingdi', 'Faridpur', 'Gopalganj',
  'Madaripur', 'Rajbari', 'Shariatpur',
  // Chittagong Division
  'Chittagong', 'Comilla', 'Cox\'s Bazar', 'Feni', 'Lakshmipur',
  'Noakhali', 'Chandpur', 'Brahmanbaria', 'Rangamati', 'Bandarban',
  'Khagrachari',
  // Rajshahi Division
  'Rajshahi', 'Bogra', 'Pabna', 'Sirajganj', 'Natore',
  'Nawabganj', 'Naogaon', 'Joypurhat',
  // Khulna Division
  'Khulna', 'Jessore', 'Satkhira', 'Bagerhat', 'Narail',
  'Magura', 'Kushtia', 'Chuadanga', 'Meherpur', 'Jhenaidah',
  // Barisal Division
  'Barisal', 'Patuakhali', 'Bhola', 'Pirojpur', 'Jhalokathi',
  'Barguna',
  // Sylhet Division
  'Sylhet', 'Habiganj', 'Sunamganj', 'Moulvibazar',
  // Rangpur Division
  'Rangpur', 'Dinajpur', 'Kurigram', 'Lalmonirhat', 'Nilphamari',
  'Gaibandha', 'Thakurgaon', 'Panchagarh',
  // Mymensingh Division
  'Mymensingh', 'Netrokona', 'Sherpur', 'Jamalpur',
];

/**
 * Default district lead days mapping.
 * Tier 1 (1 day): Dhaka metro area
 * Tier 2 (2 days): Major cities / divisional capitals
 * Tier 3 (3 days): Everything else
 */
export const DEFAULT_DISTRICT_LEAD_DAYS: DistrictLeadDaysConfig = {
  districtLeadDays: {
    // Tier 1 — 1-day delivery (Dhaka metro)
    'dhaka': 1,
    'gazipur': 1,
    'narayanganj': 1,

    // Tier 2 — 2-day delivery (major cities / divisional capitals)
    'chittagong': 2,
    'rajshahi': 2,
    'khulna': 2,
    'sylhet': 2,
    'rangpur': 2,
    'barisal': 2,
    'mymensingh': 2,
    'comilla': 2,
    'bogra': 2,
    'cox\'s bazar': 2,
    'jessore': 2,
    'dinajpur': 2,
    'tangail': 2,
    'narsingdi': 2,
    'faridpur': 2,
    'manikganj': 2,
    'munshiganj': 2,
    'madaripur': 2,
    'kishoreganj': 2,

    // All others default to 3-day via defaultLeadDays
  },
  defaultLeadDays: 3,
};
