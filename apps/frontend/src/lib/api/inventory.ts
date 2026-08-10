import type { ApiResponse, PaginatedResponse } from '@closetrent/types';
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
    overdueTransfers: number;
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
  componentComplete: boolean;
  lastRental: { blockedEndDate: string; reservation: { booking: { id: string; bookingNumber: string } } } | null;
  nextRental: { blockedStartDate: string; blockedEndDate: string; reservation: { booking: { id: string; bookingNumber: string } } } | null;
}

export interface InventoryItemsQuery {
  page?: number;
  limit?: number;
  search?: string;
  locationId?: string;
  disposition?: StockUnitDisposition;
  operationalState?: StockUnitOperationalState;
  condition?: StockConditionGrade;
  productId?: string;
  variantSizeId?: string;
  attention?: 'OPEN_ISSUE' | 'OPEN_SERVICE' | 'INCOMPLETE_SET';
  availableFrom?: string;
  availableTo?: string;
}

export type InventoryStockState =
  | 'AVAILABLE'
  | 'LOW_STOCK'
  | 'UNAVAILABLE'
  | 'UNCONFIGURED';

export interface InventorySku {
  id: string;
  trackingMode: 'POOLED' | 'SERIALIZED';
  productId: string;
  productName: string;
  productStatus: string;
  variantId: string;
  variantName: string | null;
  sizeLabel: string;
  poolCount: number;
  serializedCount: number;
  activeUnitCount: number;
  availableUnitCount: number;
  onHandQuantity: number;
  reservedQuantity: number;
  nextReservedStart: string | null;
  peakReservedQuantity: number;
  availableQuantity: number;
  inventoryState: InventoryStockState;
}

export interface InventorySkuQuery {
  page?: number;
  limit?: number;
  search?: string;
  trackingMode?: 'POOLED' | 'SERIALIZED';
  locationId?: string;
  stockState?: InventoryStockState;
  sort?: 'PRODUCT' | 'ON_HAND' | 'AVAILABLE' | 'RESERVED';
  order?: 'asc' | 'desc';
}

export interface CreateInventoryItemInput {
  locationId: string;
  assetCode: string;
  barcode?: string;
  condition?: StockConditionGrade;
  purchaseDate?: string;
  purchasePrice?: number;
  notes?: string;
}

export interface BatchInventoryItemInput {
  locationId: string;
  rows: Array<{ assetCode: string; barcode?: string }>;
  condition?: StockConditionGrade;
  purchaseDate?: string;
  purchasePrice?: number;
  notes?: string;
  componentStates?: Array<{
    definitionId: string;
    presence?: 'PRESENT' | 'MISSING' | 'DAMAGED' | 'NOT_APPLICABLE';
    presentQuantity?: number;
    condition?: StockConditionGrade;
    notes?: string;
  }>;
  idempotencyKey: string;
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
  eligibleConditionGrades: StockConditionGrade[] | null;
  eligibleOperationalStates: StockUnitOperationalState[] | null;
  location?: { id: string; code: string; name: string } | null;
  product?: { id: string; name: string } | null;
  variantSize?: {
    id: string;
    sizeInstance: { displayLabel: string };
    variant: { variantName: string | null; product: { name: string } };
  } | null;
}

export interface AvailabilityPolicyInput {
  scope: AvailabilityPolicyScope;
  expectedVersion: number;
  locationId?: string;
  productId?: string;
  variantSizeId?: string;
  preparationBufferMinutes?: number;
  deliveryBufferMinutes?: number;
  returnBufferMinutes?: number;
  inspectionBufferMinutes?: number;
  cleaningBufferMinutes?: number;
  minimumNoticeMinutes?: number;
  maximumAdvanceDays?: number;
  pendingHoldMinutes?: number;
  allowShortage?: boolean;
  shortageLimit?: number;
  requireSingleLocationForBundle?: boolean;
  allowCrossLocationTransfers?: boolean;
  transferLeadTimeMinutes?: number;
  eligibleConditionGrades?: StockConditionGrade[];
  eligibleOperationalStates?: StockUnitOperationalState[];
}

export interface EffectiveAvailabilityPolicy {
  preparationBufferMinutes: number;
  deliveryBufferMinutes: number;
  returnBufferMinutes: number;
  inspectionBufferMinutes: number;
  cleaningBufferMinutes: number;
  minimumNoticeMinutes: number;
  maximumAdvanceDays: number;
  pendingHoldMinutes: number;
  allowShortage: boolean;
  shortageLimit: number;
  requireSingleLocationForBundle: boolean;
  allowCrossLocationTransfers: boolean;
  transferLeadTimeMinutes: number;
  eligibleConditionGrades: StockConditionGrade[];
  eligibleOperationalStates: StockUnitOperationalState[];
  sources: Array<{ id: string; scope: AvailabilityPolicyScope; version: number }>;
}

export type InventoryBlockType = 'MANUAL' | 'LOCATION_BLACKOUT' | 'SKU_BLACKOUT';
export interface InventoryBlockInput {
  productId?: string;
  variantId?: string;
  variantSizeId?: string;
  stockUnitId?: string;
  locationId?: string;
  inventoryPoolId?: string;
  quantity?: number;
  startDate: string;
  endDate: string;
  blockType: InventoryBlockType;
  reason: string;
}

export interface InventoryBlock {
  id: string;
  blockType: string;
  quantity: number | null;
  startDate: string;
  endDate: string;
  reason: string | null;
  canDelete: boolean;
  owner: 'MANUAL' | 'SERVICE_ORDER' | 'INSPECTION' | 'TRANSFER';
  product: { id: string; name: string } | null;
  variant: { id: string; variantName: string | null; product: { id: string; name: string } } | null;
  variantSize: { id: string; sizeInstance: { displayLabel: string }; variant: { variantName: string | null; product: { id: string; name: string } } } | null;
  stockUnit: { id: string; assetCode: string; location: { id: string; code: string; name: string }; variantSize: { sizeInstance: { displayLabel: string }; variant: { variantName: string | null; product: { id: string; name: string } } } } | null;
  location: { id: string; code: string; name: string } | null;
  inventoryPool: { id: string; onHandQuantity: number; location: { id: string; code: string; name: string }; variantSize: { id: string; sizeInstance: { displayLabel: string }; variant: { variantName: string | null; product: { id: string; name: string } } } } | null;
  createdByUser: { id: string; fullName: string } | null;
  transferLine: { id: string; transfer: { id: string; transferNumber: string } } | null;
}

export interface InventoryBlockPreview {
  target: Record<string, unknown>;
  dateRange: { start: string; end: string };
  quantity: number | null;
  affectedReservations: number;
  affectedQuantity: number;
  affectedBookings: Array<{ id: string; bookingNumber: string; status: string }>;
  warning: string | null;
}

export interface InventoryPool {
  id: string;
  variantSizeId: string;
  locationId: string;
  onHandQuantity: number;
  version: number;
  location: InventoryLocation;
}

export type InventoryTransferStatus =
  | 'DRAFT'
  | 'READY'
  | 'DISPATCHED'
  | 'PARTIALLY_RECEIVED'
  | 'RECEIVED'
  | 'CANCELLED'
  | 'RECONCILIATION_REQUIRED'
  | 'RECONCILED';
export type InventoryTransferUnitOutcome = 'PENDING' | 'RECEIVED' | 'DAMAGED' | 'LOST';

export interface InventoryTransfer {
  id: string;
  transferNumber: string;
  status: InventoryTransferStatus;
  notes: string | null;
  expectedDispatchAt: string | null;
  expectedArrivalAt: string | null;
  reconciledAt: string | null;
  reconciliationReason: string | null;
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

export type PoolAdjustmentType = 'RECEIVE' | 'ADD' | 'SUBTRACT' | 'WRITE_OFF';

export interface InventoryPoolMutationResult {
  pool: {
    id: string;
    onHandQuantity: number;
    reorderThreshold: number | null;
    version: number;
  };
  movement?: InventoryMovementRecord;
  count?: InventoryMovementRecord;
}

export interface InventoryMovementRecord {
  id: string;
  movementType: string;
  quantityDelta: number | null;
  beforeState: Record<string, unknown> | null;
  afterState: Record<string, unknown> | null;
  reason: string;
  createdAt: string;
  variantSize: {
    id: string;
    sizeInstance: { displayLabel: string };
    variant: {
      id: string;
      variantName: string | null;
      product: { id: string; name: string };
    };
  } | null;
  stockUnit: { id: string; assetCode: string } | null;
  inventoryPool: {
    id: string;
    onHandQuantity: number;
    version: number;
    location: { id: string; code: string; name: string };
  } | null;
  originLocation: { id: string; code: string; name: string } | null;
  destinationLocation: { id: string; code: string; name: string } | null;
  actor: { id: string; fullName: string } | null;
  transfer: { id: string; transferNumber: string } | null;
  reservation: {
    id: string;
    booking: { id: string; bookingNumber: string };
  } | null;
}

export interface InventoryMovementQuery {
  page?: number;
  limit?: number;
  movementType?: string;
  productId?: string;
  variantSizeId?: string;
  stockUnitId?: string;
  inventoryPoolId?: string;
  locationId?: string;
  actorUserId?: string;
  bookingId?: string;
  transferId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

export const inventoryApi = {
  overview: async (): Promise<InventoryOverview> =>
    unwrap(await apiClient.get<ApiResponse<InventoryOverview>>('/owner/inventory/overview')),

  listItems: async (params?: InventoryItemsQuery): Promise<PaginatedResponse<InventoryItem>> => {
    const { data } = await apiClient.get<PaginatedResponse<InventoryItem>>('/owner/inventory/items', { params });
    return data;
  },

  listSkus: async (params?: InventorySkuQuery): Promise<PaginatedResponse<InventorySku>> => {
    const { data } = await apiClient.get<PaginatedResponse<InventorySku>>('/owner/inventory/skus', { params });
    return data;
  },

  createItem: async (variantSizeId: string, payload: CreateInventoryItemInput): Promise<{ id: string; assetCode: string }> =>
    unwrap(await apiClient.post<ApiResponse<{ id: string; assetCode: string }>>(`/owner/variant-sizes/${variantSizeId}/stock-units`, payload)),

  registerItemBatch: async (
    variantSizeId: string,
    payload: BatchInventoryItemInput,
  ): Promise<{ replayed: boolean; units: Array<{ id: string; assetCode: string }> }> =>
    unwrap(await apiClient.post<ApiResponse<{ replayed: boolean; units: Array<{ id: string; assetCode: string }> }>>(
      `/owner/variant-sizes/${variantSizeId}/stock-units/batch`,
      payload,
    )),

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

  upsertPolicy: async (payload: AvailabilityPolicyInput): Promise<AvailabilityPolicy> =>
    unwrap(await apiClient.put<ApiResponse<AvailabilityPolicy>>('/owner/inventory/availability-policies', payload)),

  deactivatePolicy: async (policyId: string, expectedVersion: number): Promise<AvailabilityPolicy> =>
    unwrap(await apiClient.delete<ApiResponse<AvailabilityPolicy>>(`/owner/inventory/availability-policies/${policyId}`, { params: { expectedVersion } })),

  resolvePolicy: async (params: { productId: string; variantSizeId: string; locationId: string }): Promise<{ target: Record<string, unknown>; effective: EffectiveAvailabilityPolicy }> =>
    unwrap(await apiClient.get<ApiResponse<{ target: Record<string, unknown>; effective: EffectiveAvailabilityPolicy }>>('/owner/inventory/availability-policies/resolved', { params })),

  listPools: async (variantSizeId: string): Promise<InventoryPool[]> =>
    unwrap(await apiClient.get<ApiResponse<InventoryPool[]>>(`/owner/inventory/variant-sizes/${variantSizeId}/pools`)),

  listBlocks: async (params?: { page?: number; limit?: number; blockType?: string; productId?: string; variantSizeId?: string; stockUnitId?: string; locationId?: string; inventoryPoolId?: string; from?: string; to?: string; activeOnly?: boolean }): Promise<PaginatedResponse<InventoryBlock>> => {
    const { data } = await apiClient.get<PaginatedResponse<InventoryBlock>>('/owner/inventory/blocks', { params });
    return data;
  },

  previewBlock: async (payload: InventoryBlockInput): Promise<InventoryBlockPreview> =>
    unwrap(await apiClient.post<ApiResponse<InventoryBlockPreview>>('/owner/inventory/blocks/preview', payload)),

  createBlock: async (payload: InventoryBlockInput): Promise<{ block: InventoryBlock; preview: InventoryBlockPreview }> =>
    unwrap(await apiClient.post<ApiResponse<{ block: InventoryBlock; preview: InventoryBlockPreview }>>('/owner/inventory/blocks', payload)),

  deleteBlock: async (blockId: string): Promise<void> => {
    await apiClient.delete(`/owner/inventory/blocks/${blockId}`);
  },

  adjustPool: async (
    variantSizeId: string,
    payload: {
      locationId: string;
      adjustmentType: PoolAdjustmentType;
      quantity: number;
      expectedVersion: number;
      reorderThreshold?: number;
      reason: string;
    },
  ): Promise<InventoryPoolMutationResult> =>
    unwrap(await apiClient.post<ApiResponse<InventoryPoolMutationResult>>(
      `/owner/inventory/variant-sizes/${variantSizeId}/pools/adjust`,
      payload,
    )),

  countPool: async (
    variantSizeId: string,
    payload: {
      locationId: string;
      observedQuantity: number;
      expectedVersion: number;
      reason: string;
    },
  ): Promise<InventoryPoolMutationResult> =>
    unwrap(await apiClient.post<ApiResponse<InventoryPoolMutationResult>>(
      `/owner/inventory/variant-sizes/${variantSizeId}/pools/count`,
      payload,
    )),

  listMovements: async (
    params?: InventoryMovementQuery,
  ): Promise<PaginatedResponse<InventoryMovementRecord>> => {
    const { data } = await apiClient.get<PaginatedResponse<InventoryMovementRecord>>(
      '/owner/inventory/movements',
      { params },
    );
    return data;
  },

  listCounts: async (
    params?: InventoryMovementQuery,
  ): Promise<PaginatedResponse<InventoryMovementRecord>> => {
    const { data } = await apiClient.get<PaginatedResponse<InventoryMovementRecord>>(
      '/owner/inventory/counts',
      { params },
    );
    return data;
  },

  listTransfers: async (status?: InventoryTransferStatus): Promise<InventoryTransfer[]> =>
    unwrap(await apiClient.get<ApiResponse<InventoryTransfer[]>>('/owner/inventory/transfers', { params: { status } })),

  getTransfer: async (transferId: string): Promise<InventoryTransfer> =>
    unwrap(await apiClient.get<ApiResponse<InventoryTransfer>>(`/owner/inventory/transfers/${transferId}`)),

  createTransfer: async (payload: Record<string, unknown>): Promise<InventoryTransfer> =>
    unwrap(await apiClient.post<ApiResponse<InventoryTransfer>>('/owner/inventory/transfers', payload)),

  transferAction: async (transferId: string, action: 'ready' | 'dispatch' | 'cancel' | 'reconcile', reason: string): Promise<InventoryTransfer> =>
    unwrap(await apiClient.post<ApiResponse<InventoryTransfer>>(`/owner/inventory/transfers/${transferId}/${action}`, { reason, idempotencyKey: crypto.randomUUID() })),

  receiveTransfer: async (transferId: string, payload: Record<string, unknown>): Promise<InventoryTransfer> =>
    unwrap(await apiClient.post<ApiResponse<InventoryTransfer>>(`/owner/inventory/transfers/${transferId}/receive`, { ...payload, idempotencyKey: crypto.randomUUID() })),
};
