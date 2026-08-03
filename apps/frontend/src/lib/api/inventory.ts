import type { ApiResponse } from '@closetrent/types';
import apiClient from '../api-client';
import type {
  StockConditionGrade,
  StockUnitDisposition,
  StockUnitOperationalState,
} from './inventory-operations';

const unwrap = <T>(response: { data: ApiResponse<T> }) => response.data.data;

export type InventoryLocationType =
  | 'WAREHOUSE'
  | 'SHOWROOM'
  | 'PICKUP_POINT'
  | 'CLEANING_FACILITY'
  | 'REPAIR_FACILITY'
  | 'EXTERNAL';

export interface InventoryLocation {
  id: string;
  code: string;
  name: string;
  locationType: InventoryLocationType;
  timezone: string;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  canStoreInventory: boolean;
  canFulfillRentals: boolean;
  canCustomerPickup: boolean;
  canAcceptReturns: boolean;
  canClean: boolean;
  canRepair: boolean;
  canTransfer: boolean;
  isDefault: boolean;
  isActive: boolean;
  _count?: { stockUnits: number; pools: number };
}

export type InventoryLocationInput = {
  code: string;
  name: string;
  locationType: InventoryLocationType;
  timezone?: string;
  addressLine1?: string;
  city?: string;
  country?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  canStoreInventory?: boolean;
  canFulfillRentals?: boolean;
  canCustomerPickup?: boolean;
  canAcceptReturns?: boolean;
  canClean?: boolean;
  canRepair?: boolean;
  canTransfer?: boolean;
  isDefault?: boolean;
};

export interface InventoryOverview {
  locations: Array<Pick<InventoryLocation, 'id' | 'code' | 'name' | 'locationType' | 'isDefault'> & { _count: { stockUnits: number; pools: number } }>;
  pooled: { poolCount: number; onHandQuantity: number };
  serialized: Array<{
    disposition: StockUnitDisposition;
    operationalState: StockUnitOperationalState;
    _count: { _all: number };
  }>;
  reservations: { reservationCount: number; quantity: number };
  transfers: Partial<Record<InventoryTransferStatus, number>>;
  workQueues: {
    draftInspections: number;
    openServiceOrders: number;
    openIssues: number;
    overdueRequirements: number;
  };
  lowStock: Array<{
    id: string;
    onHandQuantity: number;
    reorderThreshold: number;
    location: { id: string; code: string; name: string };
    variantSize: {
      id: string;
      sizeInstance: { displayLabel: string };
      variant: { variantName: string | null; product: { id: string; name: string } };
    };
  }>;
  conditionSummary: Array<{
    condition: StockConditionGrade;
    _count: { _all: number };
  }>;
  economics: {
    acquisitionCost: number;
    estimatedCurrentValue: number;
    completedServiceCost: number;
    completedServiceOrders: number;
  };
}

export interface InventoryItem {
  id: string;
  assetCode: string;
  barcode: string | null;
  condition: StockConditionGrade;
  disposition: StockUnitDisposition;
  operationalState: StockUnitOperationalState;
  purchaseDate: string | null;
  purchasePrice: number | null;
  estimatedCurrentValue: number | null;
  storefrontVisible: boolean;
  publicConditionNote: string | null;
  rentalPriceAdjustment: number;
  notes: string | null;
  location: { id: string; code: string; name: string };
  variantSize: {
    id: string;
    sizeInstance: { displayLabel: string };
    variant: {
      id: string;
      variantName: string | null;
      product: { id: string; name: string };
    };
  };
  _count: { inspections: number; issues: number; serviceOrders: number };
  rentalMetrics: { completedRentals: number; totalRentalDays: number };
}

export type AvailabilityPolicyScope = 'TENANT' | 'LOCATION' | 'PRODUCT' | 'SKU';
export interface AvailabilityPolicy {
  id: string;
  scope: AvailabilityPolicyScope;
  scopeKey: string;
  version: number;
  isActive: boolean;
  locationId: string | null;
  productId: string | null;
  variantSizeId: string | null;
  preparationBufferMinutes: number | null;
  deliveryBufferMinutes: number | null;
  returnBufferMinutes: number | null;
  inspectionBufferMinutes: number | null;
  cleaningBufferMinutes: number | null;
  minimumNoticeMinutes: number | null;
  maximumAdvanceDays: number | null;
  pendingHoldMinutes: number | null;
  allowShortage: boolean | null;
  shortageLimit: number | null;
  requireSingleLocationForBundle: boolean | null;
  allowCrossLocationTransfers: boolean | null;
  transferLeadTimeMinutes: number | null;
  location?: { id: string; code: string; name: string } | null;
  product?: { id: string; name: string } | null;
}

export type InventoryTransferStatus =
  | 'DRAFT'
  | 'READY'
  | 'DISPATCHED'
  | 'PARTIALLY_RECEIVED'
  | 'RECEIVED'
  | 'CANCELLED'
  | 'RECONCILIATION_REQUIRED';
export type InventoryTransferUnitOutcome = 'PENDING' | 'RECEIVED' | 'DAMAGED' | 'LOST';

export interface InventoryTransfer {
  id: string;
  transferNumber: string;
  status: InventoryTransferStatus;
  notes: string | null;
  expectedDispatchAt: string | null;
  expectedArrivalAt: string | null;
  createdAt: string;
  originLocation: { id: string; code: string; name: string };
  destinationLocation: { id: string; code: string; name: string };
  lines: Array<{
    id: string;
    lineKind: 'POOLED' | 'SERIALIZED';
    variantSizeId: string;
    requestedQuantity: number;
    dispatchedQuantity: number;
    receivedQuantity: number;
    damagedQuantity: number;
    lostQuantity: number;
    variantSize: {
      sizeInstance: { displayLabel: string };
      variant: { variantName: string | null; product: { id: string; name: string } };
    };
    units: Array<{
      id: string;
      stockUnitId: string;
      outcome: InventoryTransferUnitOutcome;
      stockUnit: { id: string; assetCode: string; condition: StockConditionGrade };
    }>;
  }>;
  events: Array<{
    id: string;
    fromStatus: InventoryTransferStatus | null;
    toStatus: InventoryTransferStatus;
    reason: string;
    createdAt: string;
    actor: { id: string; fullName: string };
  }>;
}

export interface InventoryOperationsQueue {
  inspections: Array<{
    id: string;
    inspectionType: string;
    createdAt: string;
    stockUnit: InventoryItem;
  }>;
  serviceOrders: Array<{
    id: string;
    serviceType: string;
    status: string;
    expectedCompletionAt: string | null;
    stockUnit: { id: string; assetCode: string; variantSize: { variant: { product: { id: string; name: string } } } };
    serviceLocation: { id: string; code: string; name: string };
  }>;
  issues: Array<{
    id: string;
    issueType: string;
    severity: string;
    status: string;
    description: string;
    stockUnit: { id: string; assetCode: string; variantSize: { variant: { product: { id: string; name: string } } } };
  }>;
}

export const inventoryApi = {
  overview: async (): Promise<InventoryOverview> =>
    unwrap(await apiClient.get<ApiResponse<InventoryOverview>>('/owner/inventory/overview')),

  listItems: async (params?: Record<string, string | number | undefined>) =>
    unwrap(await apiClient.get<ApiResponse<{ data: InventoryItem[]; meta: { page: number; limit: number; total: number; totalPages: number } }>>('/owner/inventory/items', { params })),

  operations: async (): Promise<InventoryOperationsQueue> =>
    unwrap(await apiClient.get<ApiResponse<InventoryOperationsQueue>>('/owner/inventory/operations')),

  listLocations: async (includeInactive = false): Promise<InventoryLocation[]> =>
    unwrap(await apiClient.get<ApiResponse<InventoryLocation[]>>('/owner/inventory/locations', { params: { includeInactive } })),

  createLocation: async (payload: InventoryLocationInput): Promise<InventoryLocation> =>
    unwrap(await apiClient.post<ApiResponse<InventoryLocation>>('/owner/inventory/locations', payload)),

  updateLocation: async (locationId: string, payload: Partial<Omit<InventoryLocationInput, 'code'>> & { isActive?: boolean }): Promise<InventoryLocation> =>
    unwrap(await apiClient.patch<ApiResponse<InventoryLocation>>(`/owner/inventory/locations/${locationId}`, payload)),

  setDefaultLocation: async (locationId: string): Promise<InventoryLocation> =>
    unwrap(await apiClient.post<ApiResponse<InventoryLocation>>(`/owner/inventory/locations/${locationId}/default`)),

  listPolicies: async (): Promise<AvailabilityPolicy[]> =>
    unwrap(await apiClient.get<ApiResponse<AvailabilityPolicy[]>>('/owner/inventory/availability-policies')),

  upsertPolicy: async (payload: Record<string, unknown>): Promise<AvailabilityPolicy> =>
    unwrap(await apiClient.put<ApiResponse<AvailabilityPolicy>>('/owner/inventory/availability-policies', payload)),

  deactivatePolicy: async (policyId: string): Promise<AvailabilityPolicy> =>
    unwrap(await apiClient.delete<ApiResponse<AvailabilityPolicy>>(`/owner/inventory/availability-policies/${policyId}`)),

  setPoolQuantity: async (variantSizeId: string, payload: { locationId: string; onHandQuantity: number; reorderThreshold?: number; reason: string }) =>
    unwrap(await apiClient.put<ApiResponse<unknown>>(`/owner/inventory/variant-sizes/${variantSizeId}/pools`, payload)),

  listTransfers: async (status?: InventoryTransferStatus): Promise<InventoryTransfer[]> =>
    unwrap(await apiClient.get<ApiResponse<InventoryTransfer[]>>('/owner/inventory/transfers', { params: { status } })),

  getTransfer: async (transferId: string): Promise<InventoryTransfer> =>
    unwrap(await apiClient.get<ApiResponse<InventoryTransfer>>(`/owner/inventory/transfers/${transferId}`)),

  createTransfer: async (payload: Record<string, unknown>): Promise<InventoryTransfer> =>
    unwrap(await apiClient.post<ApiResponse<InventoryTransfer>>('/owner/inventory/transfers', payload)),

  transferAction: async (transferId: string, action: 'ready' | 'dispatch' | 'cancel', reason: string): Promise<InventoryTransfer> =>
    unwrap(await apiClient.post<ApiResponse<InventoryTransfer>>(`/owner/inventory/transfers/${transferId}/${action}`, { reason, idempotencyKey: crypto.randomUUID() })),

  receiveTransfer: async (transferId: string, payload: Record<string, unknown>): Promise<InventoryTransfer> =>
    unwrap(await apiClient.post<ApiResponse<InventoryTransfer>>(`/owner/inventory/transfers/${transferId}/receive`, { ...payload, idempotencyKey: crypto.randomUUID() })),
};
