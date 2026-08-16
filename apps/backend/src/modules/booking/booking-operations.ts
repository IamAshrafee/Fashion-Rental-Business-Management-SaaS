import type { BookingStatus } from '@prisma/client';

export type BookingNextAction =
  | 'REVIEW'
  | 'ASSIGN_ITEMS'
  | 'PREPARE'
  | 'HAND_OUT'
  | 'START_RENTAL'
  | 'RECEIVE_RETURN'
  | 'INSPECT'
  | 'REVIEW_RETURN'
  | 'SETTLE_DEPOSIT'
  | 'COLLECT_BALANCE'
  | 'RESOLVE_RETURN_WORK'
  | 'COMPLETE'
  | 'NONE';

type Requirement = {
  status: string;
  sourceLocationId?: string | null;
  sourceLocation?: { id: string; code: string; name: string } | null;
  quantity: number;
  assignedQuantity: number;
  handedOutQuantity: number;
  returnedQuantity: number;
  lostQuantity: number;
  preparationStatus: string;
};

export interface BookingOperationsInput {
  status: BookingStatus;
  grandTotal: number;
  totalPaid: number;
  sourceLocation: { id: string; code: string; name: string } | null;
  handoverMethod: 'DELIVERY' | 'CUSTOMER_PICKUP' | null;
  returnMethod: 'BUSINESS_PICKUP' | 'CUSTOMER_RETURN' | null;
  items: Array<{
    quantity: number;
    startDate: Date;
    endDate: Date;
    depositAmount: number;
    depositSettlement: { id: string } | null;
    stockUnitInspections: Array<{ id: string }>;
    stockUnitIssues: Array<{ status: string }>;
    fulfillmentRequirements: Requirement[];
  }>;
}

export type FulfillmentLocationState = 'SINGLE' | 'MULTIPLE' | 'UNRESOLVED';

function summarizeFulfillmentLocations(
  requirements: Requirement[],
  bookingLocation: BookingOperationsInput['sourceLocation'],
) {
  const locations = new Map<string, { id: string; code: string; name: string }>();
  for (const requirement of requirements) {
    if (requirement.sourceLocation) locations.set(requirement.sourceLocation.id, requirement.sourceLocation);
  }
  if (locations.size === 0 && bookingLocation) locations.set(bookingLocation.id, bookingLocation);
  const resolved = [...locations.values()].sort((left, right) => left.name.localeCompare(right.name));
  const state: FulfillmentLocationState = resolved.length === 0
    ? 'UNRESOLVED'
    : resolved.length === 1
      ? 'SINGLE'
      : 'MULTIPLE';
  return { state, locations: resolved };
}

export function buildBookingOperations(booking: BookingOperationsInput) {
  const requirements = booking.items.flatMap((item) =>
    item.fulfillmentRequirements.filter((requirement) =>
      !['CANCELLED', 'SUPERSEDED'].includes(requirement.status),
    ),
  );
  const fulfillmentLocations = summarizeFulfillmentLocations(requirements, booking.sourceLocation);
  const physicalItemRequired = requirements.reduce((sum, item) => sum + item.quantity, 0);
  const physicalItemAssigned = requirements.reduce((sum, item) => sum + item.assignedQuantity, 0);
  const inventoryShortages = requirements.filter((item) => item.status === 'PLANNED').length;
  const handedOutQuantity = requirements.reduce((sum, item) => sum + item.handedOutQuantity, 0);
  const returnedQuantity = requirements.reduce((sum, item) => sum + item.returnedQuantity, 0);
  const lostQuantity = requirements.reduce((sum, item) => sum + item.lostQuantity, 0);
  const unresolvedReturnQuantity = Math.max(0, handedOutQuantity - returnedQuantity - lostQuantity);
  const completedReturnInspections = booking.items.reduce(
    (sum, item) => sum + item.stockUnitInspections.length,
    0,
  );
  const inspectionOutstanding = Math.max(0, returnedQuantity - completedReturnInspections);
  const unresolvedIssueCount = booking.items.reduce(
    (sum, item) => sum + item.stockUnitIssues.filter((issue) => ['OPEN', 'IN_SERVICE'].includes(issue.status)).length,
    0,
  );
  const unsettledDepositCount = booking.items.filter(
    (item) => item.depositAmount > 0 && !item.depositSettlement,
  ).length;
  const balanceDue = Math.max(0, booking.grandTotal - booking.totalPaid);
  const needsAssignment = ['pending', 'confirmed'].includes(booking.status)
    && physicalItemAssigned < physicalItemRequired;
  const unpreparedRequirementCount = requirements.filter(
    (item) => item.preparationStatus !== 'READY',
  ).length;
  const preparationReady =
    inventoryShortages === 0 &&
    physicalItemAssigned >= physicalItemRequired &&
    unpreparedRequirementCount === 0;
  const nextAction: BookingNextAction =
    booking.status === 'pending'
      ? 'REVIEW'
      : booking.status === 'confirmed'
        ? needsAssignment || inventoryShortages > 0
          ? 'ASSIGN_ITEMS'
          : !preparationReady
            ? 'PREPARE'
            : handedOutQuantity < physicalItemRequired
              ? 'HAND_OUT'
              : 'START_RENTAL'
        : booking.status === 'delivered' || booking.status === 'overdue'
          ? 'RECEIVE_RETURN'
          : booking.status === 'returned'
            ? inspectionOutstanding > 0
              ? 'INSPECT'
              : 'REVIEW_RETURN'
            : booking.status === 'inspected'
              ? unsettledDepositCount > 0
                ? 'SETTLE_DEPOSIT'
                : balanceDue > 0
                  ? 'COLLECT_BALANCE'
                  : unresolvedIssueCount > 0
                    ? 'RESOLVE_RETURN_WORK'
                    : 'COMPLETE'
              : 'NONE';
  const blockers = [
    ...(['pending', 'confirmed'].includes(booking.status) && inventoryShortages > 0
      ? [`${inventoryShortages} inventory requirement${inventoryShortages === 1 ? '' : 's'} have no capacity`]
      : []),
    ...(['pending', 'confirmed'].includes(booking.status) && needsAssignment
      ? [`${physicalItemRequired - physicalItemAssigned} physical-item assignment${physicalItemRequired - physicalItemAssigned === 1 ? '' : 's'} missing`]
      : []),
    ...(booking.status === 'confirmed' && unpreparedRequirementCount > 0
      ? [`${unpreparedRequirementCount} requirement${unpreparedRequirementCount === 1 ? '' : 's'} not prepared`]
      : []),
    ...((booking.status === 'delivered' || booking.status === 'overdue') && unresolvedReturnQuantity > 0
      ? [`${unresolvedReturnQuantity} handed-out piece${unresolvedReturnQuantity === 1 ? '' : 's'} not returned or lost`]
      : []),
    ...(booking.status === 'returned' && inspectionOutstanding > 0
      ? [`${inspectionOutstanding} returned physical item${inspectionOutstanding === 1 ? '' : 's'} awaiting inspection`]
      : []),
    ...(booking.status === 'inspected' && unsettledDepositCount > 0
      ? [`${unsettledDepositCount} deposit settlement${unsettledDepositCount === 1 ? '' : 's'} pending`]
      : []),
    ...(booking.status === 'inspected' && balanceDue > 0 ? ['Booking payment is still outstanding'] : []),
    ...(booking.status === 'inspected' && unresolvedIssueCount > 0
      ? [`${unresolvedIssueCount} return issue${unresolvedIssueCount === 1 ? '' : 's'} unresolved`]
      : []),
  ];

  return {
    rentalStartDate: booking.items.reduce<Date | null>(
      (minimum, item) => (!minimum || item.startDate < minimum ? item.startDate : minimum),
      null,
    ),
    rentalEndDate: booking.items.reduce<Date | null>(
      (maximum, item) => (!maximum || item.endDate > maximum ? item.endDate : maximum),
      null,
    ),
    totalQuantity: booking.items.reduce((sum, item) => sum + item.quantity, 0),
    requirementCount: requirements.length,
    inventoryShortages,
    physicalItemRequired,
    physicalItemAssigned,
    needsAssignment,
    preparationReady,
    handedOutQuantity,
    returnedQuantity,
    lostQuantity,
    unresolvedReturnQuantity,
    inspectionOutstanding,
    unsettledDepositCount,
    unresolvedIssueCount,
    balanceDue,
    sourceLocation: fulfillmentLocations.state === 'SINGLE'
      ? fulfillmentLocations.locations[0]
      : booking.sourceLocation,
    fulfillmentLocations,
    handoverMethod: booking.handoverMethod,
    returnMethod: booking.returnMethod,
    blockers,
    nextAction,
  };
}
