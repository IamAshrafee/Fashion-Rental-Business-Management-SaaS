import { Injectable } from '@nestjs/common';
import type {
  BookingAttentionFlags,
  BookingItemProgress,
  BookingOperationItemInput,
  BookingOperationStage,
  BookingStageAction,
  BookingStageBlocker,
  BookingStageProjection,
  BookingStageProjectionInput,
} from './domain/operations.types';
import { isUncertainCustody } from './domain/transition-rules';

const STAGE_COPY: Record<
  BookingOperationStage,
  { title: string; description: string; action: Omit<BookingStageAction, 'intent'> | null }
> = {
  REVIEW_RESERVE: {
    title: 'Review and reserve this rental',
    description: 'Verify the customer and terms, then reserve every exact physical item.',
    action: { code: 'APPROVE_AND_RESERVE', label: 'Approve & Reserve', href: '#review-reserve' },
  },
  READY_CHECK: {
    title: 'Check the assigned items',
    description: 'Confirm each exact item and its accessories are ready for this customer.',
    action: { code: 'COMPLETE_READY_CHECK', label: 'Complete Ready Check', href: '#ready-check' },
  },
  PREPARING: {
    title: 'Prepare the handover',
    description: 'Pack the ready items in their fulfillment groups.',
    action: { code: 'COMPLETE_PACKING', label: 'Mark Packed', href: '#fulfillment' },
  },
  READY_HANDOVER: {
    title: 'Ready for handover',
    description: 'The required items are ready to move to the next custodian.',
    action: { code: 'START_HANDOVER', label: 'Start Handover', href: '#handover' },
  },
  HANDOVER_PROGRESS: {
    title: 'Handover in progress',
    description:
      'Track or confirm the remaining exact items until customer possession is verified.',
    action: { code: 'MANAGE_HANDOVER', label: 'Manage Handover', href: '#handover' },
  },
  ACTIVE_RENTAL: {
    title: 'Rental active',
    description: 'The customer has the expected rental items.',
    action: { code: 'START_RETURN', label: 'Start Return', href: '#return' },
  },
  RETURN_PROGRESS: {
    title: 'Return in progress',
    description: 'Track the exact items still with the customer or moving back to the business.',
    action: { code: 'MANAGE_RETURN', label: 'Manage Return', href: '#return' },
  },
  RETURN_INSPECTION: {
    title: 'Receive and inspect the return',
    description: 'Reconcile what physically arrived, then inspect every required item.',
    action: { code: 'INSPECT_RETURN', label: 'Inspect Returned Items', href: '#return-inspection' },
  },
  FINAL_SETTLEMENT: {
    title: 'Complete final settlement',
    description: 'Resolve charges, deposits, refunds, and any remaining blocking work.',
    action: { code: 'SETTLE_AND_CLOSE', label: 'Settle & Close', href: '#settlement' },
  },
  CLOSED: {
    title: 'Booking closed',
    description: 'Physical custody, return decisions, and financial obligations are resolved.',
    action: { code: 'VIEW_SUMMARY', label: 'View Summary', href: '#summary' },
  },
  REJECTED: {
    title: 'Booking rejected',
    description: 'The request ended before the business accepted the rental.',
    action: { code: 'VIEW_DECISION', label: 'View Decision', href: '#decision' },
  },
  CANCELLED: {
    title: 'Booking cancelled',
    description: 'The cancellable scope ended without unresolved customer custody.',
    action: { code: 'VIEW_CANCELLATION', label: 'View Cancellation', href: '#cancellation' },
  },
};

function activeItems(items: BookingOperationItemInput[]): BookingOperationItemInput[] {
  return items.filter((item) => item.assignmentState !== 'CANCELLED');
}

function count(
  items: BookingOperationItemInput[],
  predicate: (item: BookingOperationItemInput) => boolean,
): number {
  return items.reduce((total, item) => total + (predicate(item) ? 1 : 0), 0);
}

function recoveryAction(code: string, label: string, href: string): BookingStageAction {
  return { code, label, href, intent: 'RECOVERY' };
}

function calendarDateKey(value: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((candidate) => candidate.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

@Injectable()
export class BookingStageProjectorService {
  project(input: BookingStageProjectionInput): BookingStageProjection {
    const items = activeItems(input.items);
    const progress = this.itemProgress(items);
    const closeBlockers = this.closeBlockers(input, progress);
    const canClose = closeBlockers.length === 0;
    const stage = this.stage(input, items, progress);
    const copy = STAGE_COPY[stage];
    const attention = this.attention(input, progress);
    const blockers = this.stageBlockers(stage, input, progress);
    const recoveryActions = this.recoveryActions(input, progress, attention);
    const modifier = input.reopened
      ? 'REOPENED'
      : input.exceptions.onHold || input.exceptions.blockingCount > 0 || progress.unknownCustody > 0
        ? 'ON_HOLD'
        : this.isPartial(stage, progress)
          ? 'PARTIAL'
          : null;

    return {
      stage,
      modifier,
      title: copy.title,
      description: copy.description,
      dominantAction: copy.action ? { ...copy.action, intent: 'PRIMARY' } : null,
      recoveryActions,
      blockers,
      closeBlockers,
      canClose,
      itemProgress: progress,
      financial: input.financial,
      attention,
      exceptions: input.exceptions,
      tasks: input.tasks,
    };
  }

  private stage(
    input: BookingStageProjectionInput,
    items: BookingOperationItemInput[],
    progress: BookingItemProgress,
  ): BookingOperationStage {
    if (input.cancelled) return 'CANCELLED';
    if (input.decision === 'REJECTED') return 'REJECTED';
    if (input.closed && !input.reopened) return 'CLOSED';
    if (input.decision === 'PENDING') return 'REVIEW_RESERVE';

    if (items.length === 0 || progress.assigned < progress.total) return 'READY_CHECK';
    if (items.some((item) => !['PASSED', 'NOT_REQUIRED'].includes(item.readyCheckState))) {
      return 'READY_CHECK';
    }
    if (items.some((item) => item.packingState !== 'READY')) return 'PREPARING';

    const returnStarted = items.some(
      (item) =>
        item.returnIntakeState !== 'NOT_STARTED' ||
        item.custody === 'RETURN_CARRIER' ||
        item.returnResolved,
    );
    if (returnStarted) {
      if (progress.unresolvedReturns > 0 || progress.returning > 0) return 'RETURN_PROGRESS';
      if (items.some((item) => item.inspectionState === 'PENDING')) return 'RETURN_INSPECTION';
      return 'FINAL_SETTLEMENT';
    }

    const handoverStarted =
      progress.withCustomer > 0 ||
      progress.outbound > 0 ||
      items.some((item) =>
        [
          'IN_CUSTODY',
          'IN_TRANSIT',
          'ATTEMPTED',
          'FAILED',
          'RETURNED_TO_ORIGIN',
          'COMPLETED',
        ].includes(item.outboundFulfillmentStatus ?? ''),
      );
    if (handoverStarted && progress.withCustomer < progress.total) return 'HANDOVER_PROGRESS';
    if (progress.total > 0 && progress.withCustomer === progress.total) return 'ACTIVE_RENTAL';
    return 'READY_HANDOVER';
  }

  private itemProgress(items: BookingOperationItemInput[]): BookingItemProgress {
    return {
      total: items.length,
      assigned: count(items, (item) => item.assignmentState === 'ASSIGNED'),
      readyChecked: count(items, (item) =>
        ['PASSED', 'NOT_REQUIRED'].includes(item.readyCheckState),
      ),
      packed: count(items, (item) => item.packingState === 'READY'),
      withCustomer: count(items, (item) => item.custody === 'CUSTOMER'),
      outbound: count(items, (item) =>
        ['INTERNAL_TRANSFER', 'OUTBOUND_CARRIER'].includes(item.custody ?? ''),
      ),
      returning: count(items, (item) => item.custody === 'RETURN_CARRIER'),
      received: count(items, (item) => item.returnIntakeState === 'COMPLETED'),
      inspected: count(items, (item) => item.inspectionState === 'COMPLETED'),
      lost: count(items, (item) => item.custody === 'LOST'),
      unknownCustody: count(items, (item) => isUncertainCustody(item.custody)),
      unresolvedReturns: count(items, (item) => item.requiresReturn && !item.returnResolved),
    };
  }

  private attention(
    input: BookingStageProjectionInput,
    progress: BookingItemProgress,
  ): BookingAttentionFlags {
    const due = input.returnDueAt;
    const returnStartedOnTime = input.customerReturnHandoverAt !== null;
    const returnDueToday = Boolean(
      due &&
      !returnStartedOnTime &&
      calendarDateKey(due, input.timeZone) === calendarDateKey(input.now, input.timeZone) &&
      progress.unresolvedReturns > 0,
    );
    const overdue = Boolean(
      due && !returnStartedOnTime && due < input.now && progress.unresolvedReturns > 0,
    );
    const courierIssue = input.items.some((item) =>
      ['FAILED', 'RETURNED_TO_ORIGIN'].includes(item.outboundFulfillmentStatus ?? ''),
    );
    const needsAttention =
      input.exceptions.openCount > 0 ||
      progress.unknownCustody > 0 ||
      input.financial.failedRefundCount > 0 ||
      courierIssue;

    return {
      paymentDue: input.financial.customerReceivable > 0,
      refundDue: input.financial.refundDue > 0 || input.financial.failedRefundCount > 0,
      depositDue: input.financial.depositRequired > input.financial.depositHeld,
      returnDueToday,
      overdue,
      courierIssue,
      needsAttention,
    };
  }

  private closeBlockers(
    input: BookingStageProjectionInput,
    progress: BookingItemProgress,
  ): BookingStageBlocker[] {
    const pendingInspections = count(
      activeItems(input.items),
      (item) => item.returnResolved && item.inspectionState === 'PENDING',
    );
    return [
      ...(progress.unresolvedReturns > 0
        ? [
            {
              code: 'PHYSICAL_RETURN_UNRESOLVED',
              message: `${progress.unresolvedReturns} physical item${progress.unresolvedReturns === 1 ? '' : 's'} still require return or loss resolution`,
              count: progress.unresolvedReturns,
              recoveryAction: recoveryAction('MANAGE_RETURN', 'Manage Return', '#return'),
            },
          ]
        : []),
      ...(progress.unknownCustody > 0
        ? [
            {
              code: 'CUSTODY_UNKNOWN',
              message: `${progress.unknownCustody} physical item${progress.unknownCustody === 1 ? '' : 's'} have unknown custody`,
              count: progress.unknownCustody,
              recoveryAction: recoveryAction('RESOLVE_CUSTODY', 'Resolve Custody', '#exceptions'),
            },
          ]
        : []),
      ...(pendingInspections > 0
        ? [
            {
              code: 'RETURN_INSPECTION_PENDING',
              message: `${pendingInspections} returned physical item${pendingInspections === 1 ? '' : 's'} await inspection`,
              count: pendingInspections,
              recoveryAction: recoveryAction(
                'INSPECT_RETURN',
                'Inspect Returned Items',
                '#return-inspection',
              ),
            },
          ]
        : []),
      ...(input.close.unresolvedDamageCount > 0
        ? [
            {
              code: 'DAMAGE_DECISION_UNRESOLVED',
              message: `${input.close.unresolvedDamageCount} damage decision${input.close.unresolvedDamageCount === 1 ? '' : 's'} remain unresolved`,
              count: input.close.unresolvedDamageCount,
              recoveryAction: recoveryAction('REVIEW_CHARGES', 'Review Charges', '#settlement'),
            },
          ]
        : []),
      ...(input.financial.customerReceivable > 0
        ? [
            {
              code: 'CUSTOMER_BALANCE_DUE',
              message: 'The customer still has an outstanding balance',
              amountMinor: input.financial.customerReceivable,
              recoveryAction: recoveryAction('RECORD_PAYMENT', 'Record Payment', '#payments'),
            },
          ]
        : []),
      ...(input.financial.depositUnresolved > 0
        ? [
            {
              code: 'DEPOSIT_UNRESOLVED',
              message: 'The security deposit is not fully resolved',
              amountMinor: input.financial.depositUnresolved,
              recoveryAction: recoveryAction('RESOLVE_DEPOSIT', 'Resolve Deposit', '#settlement'),
            },
          ]
        : []),
      ...(input.financial.refundDue > 0 || input.financial.failedRefundCount > 0
        ? [
            {
              code: input.financial.failedRefundCount > 0 ? 'REFUND_FAILED' : 'REFUND_PENDING',
              message:
                input.financial.failedRefundCount > 0
                  ? 'A required customer refund failed and must be retried or waived'
                  : 'A required customer refund is still pending',
              amountMinor: input.financial.refundDue,
              recoveryAction: recoveryAction('PROCESS_REFUND', 'Process Refund', '#refunds'),
            },
          ]
        : []),
      ...(input.exceptions.blockingCount > 0
        ? [
            {
              code: 'BLOCKING_EXCEPTION_OPEN',
              message: `${input.exceptions.blockingCount} blocking exception${input.exceptions.blockingCount === 1 ? '' : 's'} remain open`,
              count: input.exceptions.blockingCount,
              recoveryAction: recoveryAction(
                'RESOLVE_EXCEPTIONS',
                'Resolve Exceptions',
                '#exceptions',
              ),
            },
          ]
        : []),
      ...(input.close.missingRequiredRecordCount > 0
        ? [
            {
              code: 'REQUIRED_RECORD_MISSING',
              message: `${input.close.missingRequiredRecordCount} required operational record${input.close.missingRequiredRecordCount === 1 ? '' : 's'} are missing`,
              count: input.close.missingRequiredRecordCount,
              recoveryAction: recoveryAction(
                'REPAIR_RECORDS',
                'Review Missing Records',
                '#exceptions',
              ),
            },
          ]
        : []),
    ];
  }

  private stageBlockers(
    stage: BookingOperationStage,
    input: BookingStageProjectionInput,
    progress: BookingItemProgress,
  ): BookingStageBlocker[] {
    const blockers: BookingStageBlocker[] = [];
    if (stage === 'READY_CHECK' && progress.assigned < progress.total) {
      blockers.push({
        code: 'EXACT_ASSIGNMENT_MISSING',
        message: `${progress.total - progress.assigned} exact physical-item assignment${progress.total - progress.assigned === 1 ? '' : 's'} are missing`,
        count: progress.total - progress.assigned,
        recoveryAction: recoveryAction('ASSIGN_ITEMS', 'Assign Physical Items', '#assignments'),
      });
    }
    if (progress.unknownCustody > 0) {
      blockers.push({
        code: 'CUSTODY_UNKNOWN',
        message: 'Operations are paused for physical items whose custody is unknown',
        count: progress.unknownCustody,
        recoveryAction: recoveryAction('RESOLVE_CUSTODY', 'Resolve Custody', '#exceptions'),
      });
    }
    if (input.exceptions.blockingCount > 0) {
      blockers.push({
        code: 'BLOCKING_EXCEPTION_OPEN',
        message: 'Resolve or explicitly override the blocking exception before continuing',
        count: input.exceptions.blockingCount,
        recoveryAction: recoveryAction('RESOLVE_EXCEPTIONS', 'Resolve Exceptions', '#exceptions'),
      });
    }
    return blockers;
  }

  private recoveryActions(
    input: BookingStageProjectionInput,
    progress: BookingItemProgress,
    attention: BookingAttentionFlags,
  ): BookingStageAction[] {
    return [
      ...(progress.unknownCustody > 0
        ? [recoveryAction('RESOLVE_CUSTODY', 'Resolve Custody', '#exceptions')]
        : []),
      ...(attention.paymentDue
        ? [recoveryAction('RECORD_PAYMENT', 'Record Payment', '#payments')]
        : []),
      ...(attention.refundDue
        ? [recoveryAction('PROCESS_REFUND', 'Process Refund', '#refunds')]
        : []),
      ...(input.exceptions.openCount > 0
        ? [recoveryAction('RESOLVE_EXCEPTIONS', 'Resolve Exceptions', '#exceptions')]
        : []),
    ];
  }

  private isPartial(stage: BookingOperationStage, progress: BookingItemProgress): boolean {
    if (progress.total <= 1) return false;
    if (stage === 'HANDOVER_PROGRESS') return progress.withCustomer > 0 || progress.outbound > 0;
    if (stage === 'RETURN_PROGRESS') {
      return progress.unresolvedReturns > 0 && progress.unresolvedReturns < progress.total;
    }
    return false;
  }
}
