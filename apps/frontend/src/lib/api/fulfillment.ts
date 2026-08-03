import type { ApiResponse } from '@closetrent/types';
import apiClient from '../api-client';

export type CompositionRole = 'REQUIRED_COMPONENT' | 'OPTIONAL_ADDON';
export type SkuResolution = 'FIXED' | 'CUSTOMER_SELECTED' | 'PARENT_DERIVED' | 'STAFF_SELECTED';
export type SubstitutionPolicy = 'NOT_ALLOWED' | 'EQUIVALENT_ONLY' | 'STAFF_APPROVAL' | 'CUSTOMER_APPROVAL';
export type PricingBehavior = 'INCLUDED' | 'ADDITIVE' | 'OPTIONAL_PRICE';
export type FulfillmentRequirementStatus = 'PLANNED' | 'RESERVED' | 'PARTIALLY_ASSIGNED' | 'ASSIGNED' | 'PARTIALLY_HANDED_OUT' | 'HANDED_OUT' | 'PARTIALLY_RETURNED' | 'RETURNED' | 'LOST' | 'OVERDUE' | 'CANCELLED' | 'SUPERSEDED';
export type DeliveryStage = 'prepare_parcel' | 'awaiting_pickup' | 'in_transit' | 'delivered' | 'error';

export interface DeliveryItem {
  id: string;
  bookingNumber: string;
  status: string;
  deliveryStage: DeliveryStage | null;
  courierProvider: string | null;
  courierConsignmentId: string | null;
  courierStatus: string | null;
  courierStatusHistory: Array<{ status: string; label: string; timestamp: string; source: string }> | null;
  trackingNumber: string | null;
  pickupRequestedAt: string | null;
  scheduledPickupAt: string | null;
  deliveryLeadDays: number | null;
  courierErrorReason: string | null;
  deliveredAt: string | null;
  deliveryName: string;
  deliveryPhone: string;
  deliveryCity: string;
  grandTotal: number;
  items: Array<{ productName: string; startDate: string; endDate: string }>;
}

export interface DeliveryDashboardResponse {
  summary: Record<string, number>;
  stageSummary: Record<DeliveryStage, number>;
  data: DeliveryItem[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface DeliveryQuery {
  stage?: DeliveryStage;
  courierStatus?: string;
  page?: number;
  limit?: number;
}

export interface CompositionAlternativeInput {
  productId: string;
  variantSizeId?: string;
  priority?: number;
  compatibilityRule?: Record<string, unknown>;
  priceAdjustment?: number;
}

export interface CompositionRuleInput {
  role: CompositionRole;
  name: string;
  componentProductId: string;
  fixedVariantSizeId?: string;
  selectionGroupKey?: string;
  quantity: number;
  skuResolution: SkuResolution;
  substitutionPolicy: SubstitutionPolicy;
  pricingBehavior: PricingBehavior;
  priceAdjustment?: number;
  allocationWeight?: number;
  isDefaultSelected?: boolean;
  customerApprovalRequired?: boolean;
  compatibilityRules?: Record<string, unknown>;
  displayOrder?: number;
  alternatives?: CompositionAlternativeInput[];
}

export interface VariantSizeSummary {
  id: string;
  sizeInstance: { id: string; displayLabel: string; normalizedKey: string };
  variant: { id: string; variantName: string | null; mainColor: { id: string; name: string; hexCode: string | null } };
}

export interface CompositionRule extends Omit<CompositionRuleInput, 'alternatives' | 'fixedVariantSizeId'> {
  id: string;
  fixedVariantSizeId: string | null;
  isActive: boolean;
  configurationVersion: number;
  componentProduct: { id: string; name: string; slug: string; status?: string } | null;
  fixedVariantSize: VariantSizeSummary | null;
  alternatives: Array<{
    id: string;
    productId: string;
    variantSizeId: string | null;
    priority: number;
    priceAdjustment: number;
    product: { id: string; name: string; slug: string };
    variantSize: VariantSizeSummary | null;
  }>;
}

export interface FulfillmentAssignment {
  id: string;
  assignedAt: string;
  releasedAt: string | null;
  stockUnit: {
    id: string;
    assetCode: string;
    condition: string;
    operationalState: string;
    disposition: string;
    location: { id: string; code: string; name: string };
  };
}

export interface FulfillmentRequirement {
  id: string;
  bookingId: string;
  bookingItemId: string;
  requirementKey: string;
  role: 'MAIN' | CompositionRole;
  selectionSource: string;
  status: FulfillmentRequirementStatus;
  productId: string | null;
  variantSizeId: string | null;
  sourceLocationId: string;
  sourceLocation: { id: string; code: string; name: string };
  quantity: number;
  assignedQuantity: number;
  handedOutQuantity: number;
  returnedQuantity: number;
  lostQuantity: number;
  productNameSnapshot: string;
  variantNameSnapshot: string | null;
  sizeSnapshot: string | null;
  priceAdjustment: number;
  rentalStartDate: string;
  rentalEndDate: string;
  blockedStartDate: string;
  blockedEndDate: string;
  variantSize: {
    id: string;
    trackingMode: 'POOLED' | 'SERIALIZED';
    sizeInstance: { displayLabel: string };
    variant: { id: string; variantName: string | null };
  } | null;
  compositionRule: CompositionRule | null;
  reservation: {
    id: string;
    status: string;
    assignments: FulfillmentAssignment[];
  } | null;
  versions: Array<{ id: string; version: number; action: string; reason: string; createdAt: string }>;
  substitutions: Array<{ id: string; reason: string; approvalStatus: string; createdAt: string }>;
  events: Array<{ id: string; eventType: string; quantity: number; reason: string; metadata?: { assignmentIds?: string[] } | null; createdAt: string; actor?: { id: string; fullName: string } | null }>;
}

export interface RequirementAssignmentOptions {
  requirement: FulfillmentRequirement;
  reservationId: string;
  required: number;
  assigned: FulfillmentAssignment[];
  eligible: FulfillmentAssignment['stockUnit'][];
}

const unwrap = <T>(response: { data: ApiResponse<T> }) => response.data.data;

export const fulfillmentApi = {
  getDeliveries: async (query?: DeliveryQuery): Promise<DeliveryDashboardResponse> => {
    const { data } = await apiClient.get<DeliveryDashboardResponse>('/owner/fulfillment/deliveries', { params: query });
    return data;
  },
  sendPickup: async (bookingId: string): Promise<void> => {
    await apiClient.post(`/owner/fulfillment/${bookingId}/send-pickup`);
  },
  updateStage: async (bookingId: string, payload: { stage: DeliveryStage; reason?: string }): Promise<void> => {
    await apiClient.patch(`/owner/fulfillment/${bookingId}/stage`, payload);
  },
  listComposition: async (productId: string): Promise<CompositionRule[]> =>
    unwrap(await apiClient.get<ApiResponse<CompositionRule[]>>(`/owner/products/${productId}/composition`)),
  listGuestComposition: async (productId: string): Promise<CompositionRule[]> =>
    unwrap(await apiClient.get<ApiResponse<CompositionRule[]>>(`/products/${productId}/composition`)),
  createComposition: async (productId: string, payload: CompositionRuleInput): Promise<CompositionRule> =>
    unwrap(await apiClient.post<ApiResponse<CompositionRule>>(`/owner/products/${productId}/composition`, payload)),
  updateComposition: async (ruleId: string, payload: CompositionRuleInput): Promise<CompositionRule> =>
    unwrap(await apiClient.patch<ApiResponse<CompositionRule>>(`/owner/composition/${ruleId}`, payload)),
  deactivateComposition: async (ruleId: string): Promise<void> => {
    await apiClient.delete(`/owner/composition/${ruleId}`);
  },
  listBookingRequirements: async (bookingId: string): Promise<FulfillmentRequirement[]> =>
    unwrap(await apiClient.get<ApiResponse<FulfillmentRequirement[]>>(`/owner/bookings/${bookingId}/fulfillment`)),
  extendBookingDates: async (bookingId: string, rentalEndDate: string, reason: string): Promise<FulfillmentRequirement[]> =>
    unwrap(await apiClient.patch<ApiResponse<FulfillmentRequirement[]>>(`/owner/bookings/${bookingId}/fulfillment/dates`, { rentalEndDate, reason })),
  getAssignmentOptions: async (bookingId: string, bookingItemId: string, requirementId: string): Promise<RequirementAssignmentOptions> =>
    unwrap(await apiClient.get<ApiResponse<RequirementAssignmentOptions>>(`/owner/bookings/${bookingId}/items/${bookingItemId}/requirements/${requirementId}/assignments`)),
  assignUnits: async (bookingId: string, bookingItemId: string, requirementId: string, stockUnitIds: string[]): Promise<void> => {
    await apiClient.post(`/owner/bookings/${bookingId}/items/${bookingItemId}/requirements/${requirementId}/assignments`, { stockUnitIds });
  },
  releaseUnit: async (bookingId: string, bookingItemId: string, requirementId: string, assignmentId: string, reason: string): Promise<void> => {
    await apiClient.delete(`/owner/bookings/${bookingId}/items/${bookingItemId}/requirements/${requirementId}/assignments/${assignmentId}`, { data: { reason } });
  },
  recordEvent: async (requirementId: string, payload: { eventType: 'HANDED_OUT' | 'RETURNED' | 'MARKED_LOST'; quantity: number; reason: string; assignmentIds?: string[]; idempotencyKey?: string }): Promise<FulfillmentRequirement> =>
    unwrap(await apiClient.post<ApiResponse<FulfillmentRequirement>>(`/owner/fulfillment/requirements/${requirementId}/events`, payload)),
  substitute: async (requirementId: string, payload: { productId: string; variantSizeId: string; reason: string; approvalStatus?: 'NOT_REQUIRED' | 'APPROVED'; priceImpact?: number }): Promise<FulfillmentRequirement> =>
    unwrap(await apiClient.post<ApiResponse<FulfillmentRequirement>>(`/owner/fulfillment/requirements/${requirementId}/substitute`, payload)),
};
