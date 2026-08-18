export const BOOKING_OPERATION_STAGES = [
  'REVIEW_RESERVE',
  'READY_CHECK',
  'PREPARING',
  'READY_HANDOVER',
  'HANDOVER_PROGRESS',
  'ACTIVE_RENTAL',
  'RETURN_PROGRESS',
  'RETURN_INSPECTION',
  'FINAL_SETTLEMENT',
  'CLOSED',
  'REJECTED',
  'CANCELLED',
] as const;

export type BookingOperationStage = (typeof BOOKING_OPERATION_STAGES)[number];
export type BookingStageModifier = 'PARTIAL' | 'ON_HOLD' | 'REOPENED' | null;

export type OperationsBookingDecision = 'PENDING' | 'APPROVED' | 'REJECTED';
export type OperationsAssignmentState = 'UNASSIGNED' | 'ASSIGNED' | 'CANCELLED';
export type ReadyCheckState = 'NOT_REQUIRED' | 'PENDING' | 'PASSED' | 'FAILED';
export type PackingState = 'NOT_STARTED' | 'IN_PROGRESS' | 'READY';
export type ReturnIntakeProjectionState = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
export type InspectionProjectionState = 'NOT_REQUIRED' | 'PENDING' | 'COMPLETED';

export type OperationsCustodyType =
  | 'BUSINESS_LOCATION'
  | 'INTERNAL_TRANSFER'
  | 'OUTBOUND_CARRIER'
  | 'CUSTOMER'
  | 'RETURN_CARRIER'
  | 'RECEIVING_AREA'
  | 'SERVICE_PROVIDER'
  | 'QUARANTINE'
  | 'LOST'
  | 'UNKNOWN';

export type OperationsFulfillmentProjectionStatus =
  | 'PLANNED'
  | 'PREPARING'
  | 'READY'
  | 'AWAITING_HANDOVER'
  | 'IN_CUSTODY'
  | 'IN_TRANSIT'
  | 'ATTEMPTED'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'RETURNED_TO_ORIGIN';

export interface BookingOperationItemInput {
  id: string;
  assignmentState: OperationsAssignmentState;
  readyCheckState: ReadyCheckState;
  packingState: PackingState;
  custody: OperationsCustodyType | null;
  outboundFulfillmentStatus: OperationsFulfillmentProjectionStatus | null;
  returnIntakeState: ReturnIntakeProjectionState;
  inspectionState: InspectionProjectionState;
  requiresReturn: boolean;
  returnResolved: boolean;
}

export interface BookingFinancialFacts {
  customerReceivable: number;
  customerCredit: number;
  depositRequired: number;
  depositHeld: number;
  depositUnresolved: number;
  refundDue: number;
  courierReceivable: number;
  failedRefundCount: number;
}

export interface BookingExceptionFacts {
  blockingCount: number;
  openCount: number;
  criticalCount: number;
  onHold: boolean;
}

export interface BookingTaskFacts {
  openCount: number;
  overdueCount: number;
}

export interface BookingCloseFacts {
  unresolvedDamageCount: number;
  missingRequiredRecordCount: number;
}

export interface BookingStageProjectionInput {
  decision: OperationsBookingDecision;
  cancelled: boolean;
  closed: boolean;
  reopened: boolean;
  now: Date;
  timeZone: string;
  returnDueAt: Date | null;
  customerReturnHandoverAt: Date | null;
  items: BookingOperationItemInput[];
  financial: BookingFinancialFacts;
  exceptions: BookingExceptionFacts;
  tasks: BookingTaskFacts;
  close: BookingCloseFacts;
}

export interface BookingStageAction {
  code: string;
  label: string;
  href: string;
  intent: 'PRIMARY' | 'RECOVERY' | 'SECONDARY';
}

export interface BookingStageBlocker {
  code: string;
  message: string;
  count?: number;
  amountMinor?: number;
  recoveryAction?: BookingStageAction;
}

export interface BookingItemProgress {
  total: number;
  assigned: number;
  readyChecked: number;
  packed: number;
  withCustomer: number;
  outbound: number;
  returning: number;
  received: number;
  inspected: number;
  lost: number;
  unknownCustody: number;
  unresolvedReturns: number;
}

export interface BookingAttentionFlags {
  paymentDue: boolean;
  refundDue: boolean;
  depositDue: boolean;
  returnDueToday: boolean;
  overdue: boolean;
  courierIssue: boolean;
  needsAttention: boolean;
}

export interface BookingStageProjection {
  stage: BookingOperationStage;
  modifier: BookingStageModifier;
  title: string;
  description: string;
  dominantAction: BookingStageAction | null;
  recoveryActions: BookingStageAction[];
  blockers: BookingStageBlocker[];
  closeBlockers: BookingStageBlocker[];
  canClose: boolean;
  itemProgress: BookingItemProgress;
  financial: BookingFinancialFacts;
  attention: BookingAttentionFlags;
  exceptions: BookingExceptionFacts;
  tasks: BookingTaskFacts;
}
