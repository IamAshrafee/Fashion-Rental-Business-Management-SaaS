import type { ApiResponse } from '@closetrent/types';
import apiClient from '../api-client';

export type StockConditionGrade = 'NEW' | 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'DAMAGED';
export type StockUnitDisposition = 'ACTIVE' | 'QUARANTINED' | 'LOST' | 'RETIRED';
export type StockUnitOperationalState =
  | 'AVAILABLE'
  | 'PREPARING'
  | 'READY'
  | 'OUT_FOR_RENTAL'
  | 'AWAITING_INSPECTION'
  | 'CLEANING'
  | 'WASHING'
  | 'REPAIRING'
  | 'IN_TRANSFER';
export type StockUnitInspectionType = 'PRE_RENTAL' | 'RETURN' | 'PERIODIC' | 'SERVICE_COMPLETION';
export type StockUnitInspectionStatus = 'DRAFT' | 'COMPLETED' | 'SUPERSEDED';
export type StockUnitInspectionDecision = 'AVAILABLE' | 'CLEANING' | 'WASHING' | 'REPAIR' | 'QUARANTINE' | 'LOST' | 'RETIRE';
export type InspectionCheckResult = 'PASS' | 'FAIL' | 'NOT_APPLICABLE';
export type StockUnitIssueSeverity = 'INFO' | 'MINOR' | 'MODERATE' | 'SEVERE' | 'CRITICAL';
export type StockUnitIssueStatus = 'OPEN' | 'IN_SERVICE' | 'RESOLVED' | 'WAIVED';
export type StockUnitIssueResponsibility = 'CUSTOMER' | 'BUSINESS' | 'NORMAL_WEAR' | 'THIRD_PARTY' | 'UNKNOWN';
export type InventoryServiceOrderType = 'PREPARATION' | 'CLEANING' | 'WASHING' | 'REPAIR' | 'ALTERATION' | 'MAINTENANCE';
export type InventoryServiceOrderStatus = 'REQUESTED' | 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type StockUnitComponentPresence = 'PRESENT' | 'MISSING' | 'DAMAGED' | 'NOT_APPLICABLE';
export type InventoryMediaPurpose = 'UNIT_REFERENCE' | 'PRE_RENTAL' | 'POST_RETURN' | 'DAMAGE' | 'SERVICE' | 'CHECKLIST' | 'OTHER';

interface PersonSummary { id: string; fullName: string }

export interface SetComponentDefinition {
  id: string;
  name: string;
  requiredQuantity: number;
  inspectionGuidance: string | null;
  absenceBlocksRental: boolean;
  displayOrder: number;
  isActive: boolean;
}

export interface StockUnitComponentState {
  id: string;
  setComponentDefinitionId: string;
  presence: StockUnitComponentPresence;
  presentQuantity: number;
  condition: StockConditionGrade | null;
  notes: string | null;
  updatedAt: string;
  setComponentDefinition: SetComponentDefinition;
}

export interface InventoryMediaAttachment {
  id: string;
  purpose: InventoryMediaPurpose;
  url: string;
  objectKey: string | null;
  mimeType: string | null;
  caption: string | null;
  capturedAt: string | null;
  createdAt: string;
}

export interface StockUnitIssue {
  id: string;
  inspectionId: string | null;
  bookingItemId: string | null;
  assignmentId: string | null;
  issueType: string;
  severity: StockUnitIssueSeverity;
  status: StockUnitIssueStatus;
  responsibility: StockUnitIssueResponsibility;
  description: string;
  isAvailabilityBlocking: boolean;
  estimatedCost: number | null;
  customerCharge: number | null;
  resolutionNotes: string | null;
  resolvedAt: string | null;
  createdAt: string;
  reportedBy?: PersonSummary;
  resolvedBy?: PersonSummary | null;
  serviceOrders?: InventoryServiceOrder[];
  mediaAttachments?: InventoryMediaAttachment[];
}

export interface InspectionCheck {
  id: string;
  setComponentDefinitionId: string | null;
  labelSnapshot: string;
  expectedQuantity: number;
  observedQuantity: number | null;
  result: InspectionCheckResult;
  notes: string | null;
}

export interface StockUnitInspection {
  id: string;
  inspectionType: StockUnitInspectionType;
  status: StockUnitInspectionStatus;
  conditionBefore: StockConditionGrade;
  conditionAfter: StockConditionGrade | null;
  decision: StockUnitInspectionDecision | null;
  notes: string | null;
  customerLiabilityNote: string | null;
  completedAt: string | null;
  createdAt: string;
  assignmentId: string | null;
  serviceOrderId: string | null;
  inspectedBy: PersonSummary;
  bookingItem?: { id: string; bookingId: string; productName: string } | null;
  serviceOrder?: { id: string; serviceType: InventoryServiceOrderType; status: InventoryServiceOrderStatus } | null;
  checks: InspectionCheck[];
  issues: StockUnitIssue[];
  mediaAttachments: InventoryMediaAttachment[];
}

export interface InventoryServiceOrder {
  id: string;
  issueId: string | null;
  sourceInspectionId: string | null;
  serviceType: InventoryServiceOrderType;
  status: InventoryServiceOrderStatus;
  isAvailabilityBlocking: boolean;
  providerName: string | null;
  locationLabel: string | null;
  requestedAt: string;
  scheduledStartAt: string | null;
  startedAt: string | null;
  expectedCompletionAt: string | null;
  completedAt: string | null;
  cost: number | null;
  notes: string | null;
  completionOutcome: string | null;
  requestedBy: PersonSummary;
  completedBy: PersonSummary | null;
  issue?: StockUnitIssue | null;
  inventoryBlock?: { id: string; startDate: string; endDate: string; reason: string | null } | null;
  mediaAttachments: InventoryMediaAttachment[];
}

export interface StockUnitLifecycleEvent {
  id: string;
  fromDisposition: StockUnitDisposition;
  toDisposition: StockUnitDisposition;
  fromOperationalState: StockUnitOperationalState;
  toOperationalState: StockUnitOperationalState;
  reason: string;
  createdAt: string;
  actor: PersonSummary | null;
}

export interface StockUnitOperations {
  stockUnit: {
    id: string;
    assetCode: string;
    barcode: string | null;
    condition: StockConditionGrade;
    disposition: StockUnitDisposition;
    operationalState: StockUnitOperationalState;
    locationLabel: string | null;
    purchaseDate: string | null;
    purchasePrice: number | null;
    notes: string | null;
    variantSize: {
      id: string;
      sizeInstance: { id: string; displayLabel: string; normalizedKey: string };
      variant: {
        id: string;
        variantName: string | null;
        mainColor: { id: string; name: string; hexCode: string | null };
        product: { id: string; name: string };
      };
      setComponentDefinitions: SetComponentDefinition[];
    };
    componentStates: StockUnitComponentState[];
    assignments: Array<{
      id: string;
      blockedStartDate: string;
      blockedEndDate: string;
      assignedAt: string;
      reservation: {
        id: string;
        bookingId: string;
        bookingItemId: string;
        blockedStartDate: string;
        blockedEndDate: string;
        status: string;
      };
    }>;
    blocks: Array<{ id: string; startDate: string; endDate: string; blockType: string; reason: string | null }>;
  };
  inspections: StockUnitInspection[];
  issues: StockUnitIssue[];
  lifecycleEvents: StockUnitLifecycleEvent[];
  serviceOrders: InventoryServiceOrder[];
}

export interface CompleteInspectionInput {
  conditionAfter: StockConditionGrade;
  decision: StockUnitInspectionDecision;
  notes?: string;
  customerLiabilityNote?: string;
  checks?: Array<{
    setComponentDefinitionId?: string;
    label: string;
    expectedQuantity: number;
    observedQuantity?: number;
    result: InspectionCheckResult;
    notes?: string;
  }>;
  issues?: Array<{
    issueType: string;
    severity: StockUnitIssueSeverity;
    responsibility?: StockUnitIssueResponsibility;
    description: string;
    isAvailabilityBlocking?: boolean;
    estimatedCost?: number;
    customerCharge?: number;
  }>;
  media?: Array<{
    url: string;
    objectKey?: string;
    mimeType?: string;
    purpose: InventoryMediaPurpose;
    caption?: string;
    capturedAt?: string;
  }>;
  idempotencyKey?: string;
}

const unwrap = <T>(response: { data: ApiResponse<T> }) => response.data.data;

export const inventoryOperationsApi = {
  getUnit: async (stockUnitId: string): Promise<StockUnitOperations> =>
    unwrap(await apiClient.get<ApiResponse<StockUnitOperations>>(`/owner/inventory/stock-units/${stockUnitId}/operations`)),

  transition: async (stockUnitId: string, payload: { targetState: StockUnitOperationalState; reason: string; assignmentId?: string; serviceOrderId?: string; idempotencyKey?: string }) =>
    unwrap(await apiClient.post<ApiResponse<unknown>>(`/owner/inventory/stock-units/${stockUnitId}/transitions`, payload)),

  changeDisposition: async (stockUnitId: string, payload: { targetDisposition: StockUnitDisposition; reason: string; idempotencyKey?: string }) =>
    unwrap(await apiClient.post<ApiResponse<unknown>>(`/owner/inventory/stock-units/${stockUnitId}/disposition`, payload)),

  createInspection: async (stockUnitId: string, payload: { inspectionType: StockUnitInspectionType; bookingItemId?: string; assignmentId?: string; serviceOrderId?: string; amendsInspectionId?: string; notes?: string; idempotencyKey?: string }): Promise<StockUnitInspection> =>
    unwrap(await apiClient.post<ApiResponse<StockUnitInspection>>(`/owner/inventory/stock-units/${stockUnitId}/inspections`, payload)),

  completeInspection: async (inspectionId: string, payload: CompleteInspectionInput): Promise<StockUnitInspection> =>
    unwrap(await apiClient.post<ApiResponse<StockUnitInspection>>(`/owner/inventory/inspections/${inspectionId}/complete`, payload)),

  resolveIssue: async (issueId: string, payload: { resolutionNotes: string; waive?: boolean; idempotencyKey?: string }): Promise<StockUnitIssue> =>
    unwrap(await apiClient.post<ApiResponse<StockUnitIssue>>(`/owner/inventory/issues/${issueId}/resolve`, payload)),

  createServiceOrder: async (stockUnitId: string, payload: { serviceType: InventoryServiceOrderType; issueId?: string; sourceInspectionId?: string; isAvailabilityBlocking?: boolean; providerName?: string; locationLabel?: string; scheduledStartAt?: string; expectedCompletionAt?: string; cost?: number; notes?: string; idempotencyKey?: string }): Promise<InventoryServiceOrder> =>
    unwrap(await apiClient.post<ApiResponse<InventoryServiceOrder>>(`/owner/inventory/stock-units/${stockUnitId}/service-orders`, payload)),

  startServiceOrder: async (serviceOrderId: string, payload: { note?: string; idempotencyKey?: string }): Promise<InventoryServiceOrder> =>
    unwrap(await apiClient.post<ApiResponse<InventoryServiceOrder>>(`/owner/inventory/service-orders/${serviceOrderId}/start`, payload)),

  completeServiceOrder: async (serviceOrderId: string, payload: { completionOutcome: string; cost?: number; conditionAfter?: StockConditionGrade; requiresInspection?: boolean; idempotencyKey?: string }): Promise<InventoryServiceOrder> =>
    unwrap(await apiClient.post<ApiResponse<InventoryServiceOrder>>(`/owner/inventory/service-orders/${serviceOrderId}/complete`, payload)),

  cancelServiceOrder: async (serviceOrderId: string, payload: { reason: string; idempotencyKey?: string }): Promise<InventoryServiceOrder> =>
    unwrap(await apiClient.post<ApiResponse<InventoryServiceOrder>>(`/owner/inventory/service-orders/${serviceOrderId}/cancel`, payload)),

  createSetComponent: async (variantSizeId: string, payload: { name: string; requiredQuantity: number; inspectionGuidance?: string; absenceBlocksRental: boolean; displayOrder?: number }): Promise<SetComponentDefinition> =>
    unwrap(await apiClient.post<ApiResponse<SetComponentDefinition>>(`/owner/inventory/variant-sizes/${variantSizeId}/set-components`, payload)),

  deactivateSetComponent: async (definitionId: string): Promise<void> => {
    await apiClient.delete(`/owner/inventory/set-components/${definitionId}`);
  },

  updateComponentState: async (stockUnitId: string, definitionId: string, payload: { presence: StockUnitComponentPresence; presentQuantity: number; condition?: StockConditionGrade; notes?: string }): Promise<StockUnitComponentState> =>
    unwrap(await apiClient.patch<ApiResponse<StockUnitComponentState>>(`/owner/inventory/stock-units/${stockUnitId}/set-components/${definitionId}`, payload)),

  uploadInspectionMedia: async (stockUnitId: string, files: File[]): Promise<Array<{ url: string; objectKey: string; mimeType: string }>> => {
    const body = new FormData();
    body.append('stockUnitId', stockUnitId);
    files.forEach((file) => body.append('files', file));
    const response = await apiClient.post<ApiResponse<{ files: Array<{ url: string; objectKey: string; mimeType: string }> }>>('/owner/upload/inventory-photos', body, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data.data.files;
  },
};
