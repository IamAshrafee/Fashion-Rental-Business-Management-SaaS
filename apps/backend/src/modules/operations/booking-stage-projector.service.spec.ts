import { Test, TestingModule } from '@nestjs/testing';
import { BookingStageProjectorService } from './booking-stage-projector.service';
import { requestFingerprint } from './domain/idempotency';
import { canTransitionFulfillment, custodyRequiresLocation } from './domain/transition-rules';
import type {
  BookingOperationItemInput,
  BookingStageProjectionInput,
} from './domain/operations.types';

function item(id: string): BookingOperationItemInput {
  return {
    id,
    assignmentState: 'ASSIGNED',
    readyCheckState: 'PASSED',
    packingState: 'READY',
    custody: 'BUSINESS_LOCATION',
    outboundFulfillmentStatus: 'READY',
    returnIntakeState: 'NOT_STARTED',
    inspectionState: 'PENDING',
    requiresReturn: true,
    returnResolved: false,
  };
}

function input(): BookingStageProjectionInput {
  return {
    decision: 'APPROVED',
    cancelled: false,
    closed: false,
    reopened: false,
    now: new Date('2026-08-18T12:00:00.000Z'),
    timeZone: 'Asia/Dhaka',
    returnDueAt: new Date('2026-08-20T18:00:00.000Z'),
    customerReturnHandoverAt: null,
    items: [item('item-1')],
    financial: {
      customerReceivable: 0,
      customerCredit: 0,
      depositRequired: 0,
      depositHeld: 0,
      depositUnresolved: 0,
      refundDue: 0,
      courierReceivable: 0,
      failedRefundCount: 0,
    },
    exceptions: { blockingCount: 0, openCount: 0, criticalCount: 0, onHold: false },
    tasks: { openCount: 1, overdueCount: 0 },
    close: { unresolvedDamageCount: 0, missingRequiredRecordCount: 0 },
  };
}

describe('BookingStageProjectorService', () => {
  let projector: BookingStageProjectorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BookingStageProjectorService],
    }).compile();
    projector = module.get(BookingStageProjectorService);
  });

  it('keeps a request in Review & Reserve until it is approved', () => {
    const value = input();
    value.decision = 'PENDING';

    expect(projector.project(value)).toMatchObject({
      stage: 'REVIEW_RESERVE',
      dominantAction: { code: 'APPROVE_AND_RESERVE' },
    });
  });

  it('does not hide an impossible approved booking with missing exact assignments', () => {
    const value = input();
    value.items[0].assignmentState = 'UNASSIGNED';

    const result = projector.project(value);

    expect(result.stage).toBe('READY_CHECK');
    expect(result.blockers).toContainEqual(
      expect.objectContaining({ code: 'EXACT_ASSIGNMENT_MISSING' }),
    );
  });

  it('projects a verified customer handover as an active rental', () => {
    const value = input();
    value.items[0].custody = 'CUSTOMER';
    value.items[0].outboundFulfillmentStatus = 'COMPLETED';

    expect(projector.project(value)).toMatchObject({
      stage: 'ACTIVE_RENTAL',
      modifier: null,
      itemProgress: { withCustomer: 1 },
      dominantAction: { code: 'START_RETURN' },
    });
  });

  it('keeps mixed item truth during a partial handover', () => {
    const value = input();
    value.items = [item('item-1'), item('item-2'), item('item-3')];
    value.items[0].custody = 'CUSTOMER';
    value.items[0].outboundFulfillmentStatus = 'COMPLETED';
    value.items[1].custody = 'OUTBOUND_CARRIER';
    value.items[1].outboundFulfillmentStatus = 'IN_TRANSIT';

    expect(projector.project(value)).toMatchObject({
      stage: 'HANDOVER_PROGRESS',
      modifier: 'PARTIAL',
      itemProgress: { total: 3, withCustomer: 1, outbound: 1 },
    });
  });

  it('keeps a partial return in progress until every required item is resolved', () => {
    const value = input();
    value.items = [item('item-1'), item('item-2')];
    value.items[0].custody = 'RECEIVING_AREA';
    value.items[0].returnIntakeState = 'COMPLETED';
    value.items[0].returnResolved = true;
    value.items[1].custody = 'CUSTOMER';
    value.items[1].outboundFulfillmentStatus = 'COMPLETED';

    expect(projector.project(value)).toMatchObject({
      stage: 'RETURN_PROGRESS',
      modifier: 'PARTIAL',
      itemProgress: { unresolvedReturns: 1, received: 1 },
    });
  });

  it('moves received units to return inspection before settlement', () => {
    const value = input();
    value.items[0].custody = 'RECEIVING_AREA';
    value.items[0].returnIntakeState = 'COMPLETED';
    value.items[0].returnResolved = true;

    expect(projector.project(value)).toMatchObject({
      stage: 'RETURN_INSPECTION',
      dominantAction: { code: 'INSPECT_RETURN' },
    });
  });

  it('keeps refund failures in settlement and blocks close', () => {
    const value = input();
    value.items[0].custody = 'BUSINESS_LOCATION';
    value.items[0].returnIntakeState = 'COMPLETED';
    value.items[0].returnResolved = true;
    value.items[0].inspectionState = 'COMPLETED';
    value.financial.refundDue = 500;
    value.financial.failedRefundCount = 1;

    const result = projector.project(value);

    expect(result.stage).toBe('FINAL_SETTLEMENT');
    expect(result.attention.refundDue).toBe(true);
    expect(result.canClose).toBe(false);
    expect(result.closeBlockers).toContainEqual(
      expect.objectContaining({
        code: 'REFUND_FAILED',
        amountMinor: 500,
      }),
    );
  });

  it('puts unknown custody on hold and exposes a recovery action', () => {
    const value = input();
    value.items[0].custody = 'UNKNOWN';

    expect(projector.project(value)).toMatchObject({
      modifier: 'ON_HOLD',
      attention: { needsAttention: true },
      blockers: [expect.objectContaining({ code: 'CUSTODY_UNKNOWN' })],
      recoveryActions: [expect.objectContaining({ code: 'RESOLVE_CUSTODY' })],
    });
  });

  it('derives return-due and overdue conditions without creating stages', () => {
    const dueToday = input();
    dueToday.items[0].custody = 'CUSTOMER';
    dueToday.returnDueAt = new Date('2026-08-18T15:00:00.000Z');
    expect(projector.project(dueToday)).toMatchObject({
      stage: 'ACTIVE_RENTAL',
      attention: { returnDueToday: true, overdue: false },
    });

    const overdue = input();
    overdue.items[0].custody = 'CUSTOMER';
    overdue.returnDueAt = new Date('2026-08-17T18:00:00.000Z');
    expect(projector.project(overdue).attention.overdue).toBe(true);

    overdue.customerReturnHandoverAt = new Date('2026-08-17T17:00:00.000Z');
    expect(projector.project(overdue).attention.overdue).toBe(false);
  });

  it('preserves terminal and reopened close-cycle outcomes', () => {
    const rejected = input();
    rejected.decision = 'REJECTED';
    expect(projector.project(rejected).stage).toBe('REJECTED');

    const cancelled = input();
    cancelled.cancelled = true;
    expect(projector.project(cancelled).stage).toBe('CANCELLED');

    const closed = input();
    closed.closed = true;
    expect(projector.project(closed).stage).toBe('CLOSED');

    closed.reopened = true;
    expect(projector.project(closed)).toMatchObject({
      stage: 'READY_HANDOVER',
      modifier: 'REOPENED',
    });
  });
});

describe('operations domain primitives', () => {
  it('allows only explicit normalized fulfillment transitions', () => {
    expect(canTransitionFulfillment('PLANNED', 'PREPARING')).toBe(true);
    expect(canTransitionFulfillment('PLANNED', 'COMPLETED')).toBe(false);
    expect(canTransitionFulfillment('COMPLETED', 'IN_TRANSIT')).toBe(false);
  });

  it('requires a structured location for location-backed custody', () => {
    expect(custodyRequiresLocation('BUSINESS_LOCATION')).toBe(true);
    expect(custodyRequiresLocation('CUSTOMER')).toBe(false);
  });

  it('produces stable request fingerprints independent of object key order', () => {
    expect(requestFingerprint({ bookingId: 'b-1', items: [1, 2], version: 3 })).toBe(
      requestFingerprint({ version: 3, items: [1, 2], bookingId: 'b-1' }),
    );
  });
});
