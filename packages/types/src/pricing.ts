// ============================================
// Pricing Engine v2 — Shared Types
// ============================================

// --- Enums ---

export type RatePlanType =
  | 'PER_DAY'
  | 'FLAT_PERIOD'
  | 'TIERED_DAILY'
  | 'WEEKLY_MONTHLY'
  | 'PERCENT_RETAIL';

export type ComponentType =
  | 'FEE'
  | 'DEPOSIT'
  | 'DISCOUNT'
  | 'ADDON'
  | 'SURCHARGE';

export type ComponentVisibility = 'CUSTOMER' | 'STAFF_ONLY';

export type ChargeTiming =
  | 'AT_BOOKING'
  | 'AT_PICKUP'
  | 'AT_RETURN'
  | 'POST_RETURN';

export type PolicyVersionStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';

export type DurationMode = 'CALENDAR_DAYS' | 'NIGHTS';

export type BillingRounding = 'CEIL' | 'FLOOR' | 'NEAREST';

export type ConditionOperator =
  | 'EQ'
  | 'IN'
  | 'GTE'
  | 'LTE'
  | 'BETWEEN'
  | 'OVERLAPS';

// --- Rate Plan Config Shapes ---

export interface PerDayConfig {
  unitPriceMinor: number;
  minDays: number;
  maxDays?: number;
}

export interface FlatPeriodConfig {
  includedDays: number;
  flatPriceMinor: number;
  extraDayPriceMinor?: number;
  maxDays?: number;
}

export interface TieredDailyTier {
  fromDay: number;
  toDay: number | null; // null = unlimited
  pricePerDayMinor: number;
}

export interface TieredDailyConfig {
  tiers: TieredDailyTier[];
  minDays?: number;
}

export interface WeeklyMonthlyConfig {
  dailyPriceMinor?: number;
  weeklyPriceMinor?: number;
  monthlyPriceMinor?: number;
  optimizeCost: boolean; // engine picks cheapest combo
}

export interface PercentRetailConfig {
  percent: number; // e.g. 12 = 12%
  minPriceMinor?: number;
  maxPriceMinor?: number;
  basis: 'PER_DAY' | 'PER_RENTAL';
}

export type RatePlanConfig =
  | PerDayConfig
  | FlatPeriodConfig
  | TieredDailyConfig
  | WeeklyMonthlyConfig
  | PercentRetailConfig;

// --- Component Config Shapes ---

export interface ComponentPricingConfig {
  label: string;
  pricing:
    | { mode: 'FLAT'; amountMinor: number }
    | { mode: 'PERCENT_OF_BASE'; percent: number; capMinor?: number }
    | { mode: 'PERCENT_OF_RETAIL'; percent: number; minMinor?: number; maxMinor?: number }
    | { mode: 'PER_DAY'; amountMinor: number };
}

// --- Late Fee Policy ---

export interface LateFeePolicy {
  enabled: boolean;
  graceHours: number;
  mode: 'PER_DAY' | 'FLAT' | 'PERCENT_BASE';
  amountMinor?: number; // for PER_DAY or FLAT
  percent?: number; // for PERCENT_BASE
  totalCapMinor?: number;
}

// --- Presentation Config ---

export interface PresentationConfig {
  headlineStrategy: 'FROM' | 'EXACT' | 'STARTING_AT';
  showDepositSeparately: boolean;
  showItemizedByDefault: boolean;
}

// --- Condition ---

export interface ConditionDef {
  field: string;
  operator: ConditionOperator;
  value: unknown;
}

// --- API: Quote Request/Response ---

export interface QuoteRequest {
  tenantId: string;
  productId: string;
  variantId?: string;
  startAt: string; // ISO 8601
  endAt: string;
  context?: {
    customerTier?: string;
    channel?: string;
    location?: string;
  };
  selectedAddons?: string[];
}

export interface QuoteLineItem {
  type: string;
  label: string;
  amountMinor: number;
  refundable: boolean;
  visibility: ComponentVisibility;
  metadata?: Record<string, unknown>;
}

export interface QuoteResponse {
  quoteId: string;
  policyVersionId: string;
  currency: string;
  duration: {
    billableDays: number;
    startAt: string;
    endAt: string;
  };
  lineItems: QuoteLineItem[];
  totals: {
    subtotalMinor: number;
    depositMinor: number;
    totalDueNowMinor: number;
    totalDueLaterMinor: number;
  };
  expiresAt: string;
}

// --- API: Admin Pricing Profile ---

export interface PricingProfileSummary {
  id: string;
  productId: string;
  currency: string;
  timezone: string;
  durationMode: DurationMode;
  billingRounding: BillingRounding;
  activePolicyVersionId: string | null;
  activeVersion?: PolicyVersionSummary | null;
}

export interface PolicyVersionSummary {
  id: string;
  version: number;
  status: PolicyVersionStatus;
  ratePlans: RatePlanSummary[];
  components: ComponentSummary[];
  lateFeePolicy: LateFeePolicy | null;
  presentationConfig: PresentationConfig | null;
  publishedAt: string | null;
  createdAt: string;
}

export interface RatePlanSummary {
  id: string;
  type: RatePlanType;
  priority: number;
  config: RatePlanConfig;
  conditions: ConditionDef[];
}

export interface ComponentSummary {
  id: string;
  type: ComponentType;
  priority: number;
  visibility: ComponentVisibility;
  chargeTiming: ChargeTiming;
  refundable: boolean;
  exclusiveGroup: string | null;
  config: ComponentPricingConfig;
  conditions: ConditionDef[];
}

// --- API: Save Pricing (Admin form submission) ---

export interface SavePricingInput {
  ratePlan: {
    type: RatePlanType;
    priority?: number;
    config: RatePlanConfig;
  };
  components: Array<{
    type: ComponentType;
    priority?: number;
    visibility?: ComponentVisibility;
    chargeTiming?: ChargeTiming;
    refundable?: boolean;
    config: ComponentPricingConfig;
  }>;
  lateFeePolicy?: LateFeePolicy;
  presentationConfig?: PresentationConfig;
}
