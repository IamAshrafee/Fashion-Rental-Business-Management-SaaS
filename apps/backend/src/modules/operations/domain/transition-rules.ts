import type {
  OperationsCustodyType,
  OperationsFulfillmentProjectionStatus,
} from './operations.types';

const FULFILLMENT_TRANSITIONS = {
  PLANNED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY', 'FAILED', 'CANCELLED'],
  READY: ['AWAITING_HANDOVER', 'IN_CUSTODY', 'CANCELLED'],
  AWAITING_HANDOVER: ['IN_CUSTODY', 'ATTEMPTED', 'FAILED', 'CANCELLED'],
  IN_CUSTODY: ['IN_TRANSIT', 'COMPLETED', 'FAILED', 'RETURNED_TO_ORIGIN'],
  IN_TRANSIT: ['ATTEMPTED', 'COMPLETED', 'FAILED', 'RETURNED_TO_ORIGIN'],
  ATTEMPTED: ['IN_TRANSIT', 'COMPLETED', 'FAILED', 'RETURNED_TO_ORIGIN'],
  COMPLETED: [],
  FAILED: ['PREPARING', 'AWAITING_HANDOVER', 'IN_CUSTODY', 'CANCELLED'],
  CANCELLED: [],
  RETURNED_TO_ORIGIN: [],
} as const satisfies Record<
  OperationsFulfillmentProjectionStatus,
  readonly OperationsFulfillmentProjectionStatus[]
>;

export function canTransitionFulfillment(
  from: OperationsFulfillmentProjectionStatus,
  to: OperationsFulfillmentProjectionStatus,
): boolean {
  return (
    FULFILLMENT_TRANSITIONS[from] as readonly OperationsFulfillmentProjectionStatus[]
  ).includes(to);
}

const LOCATION_CUSTODIES = new Set<OperationsCustodyType>([
  'BUSINESS_LOCATION',
  'RECEIVING_AREA',
  'SERVICE_PROVIDER',
  'QUARANTINE',
]);

export function custodyRequiresLocation(custody: OperationsCustodyType): boolean {
  return LOCATION_CUSTODIES.has(custody);
}

export function isUncertainCustody(custody: OperationsCustodyType | null): boolean {
  return custody === null || custody === 'UNKNOWN';
}
