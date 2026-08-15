import type { BookingStatus } from '../types';

export const BOOKING_WORKFLOW_STAGES = [
  'Review request',
  'Prepare handoff',
  'Rental active',
  'Receive return',
  'Inspect & settle',
  'Completed',
] as const;

export interface BookingWorkflowState {
  currentStage: number;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  cancelled?: boolean;
}

export function getBookingWorkflowState(status: BookingStatus): BookingWorkflowState {
  switch (status) {
    case 'pending':
      return {
        currentStage: 0,
        title: 'Review and reserve this rental request',
        description: 'Check the customer, rental dates, delivery plan, and payment arrangement. Assign every exact physical item before approving the rental.',
        actionLabel: 'Open review workspace',
        actionHref: '#fulfillment-workspace',
      };
    case 'confirmed':
      return {
        currentStage: 1,
        title: 'Prepare the rental for handoff',
        description: 'The exact physical items are reserved. Prepare each component, then record the real handout.',
        actionLabel: 'Open fulfillment workspace',
        actionHref: '#fulfillment-workspace',
      };
    case 'delivered':
    case 'overdue':
      return {
        currentStage: 2,
        title: status === 'overdue' ? 'Arrange this overdue return' : 'Rental is active',
        description: 'When the items return, record every physical item as returned or lost before finalizing the return.',
        actionLabel: 'Open fulfillment workspace',
        actionHref: '#fulfillment-workspace',
      };
    case 'returned':
      return {
        currentStage: 3,
        title: 'Inspect the returned physical items',
        description: 'Complete the return inspection for every item before commercial closeout.',
        actionLabel: 'Open fulfillment workspace',
        actionHref: '#fulfillment-workspace',
      };
    case 'inspected':
      return {
        currentStage: 4,
        title: 'Finish the commercial closeout',
        description: 'Resolve return issues, settle deposits, collect any remaining balance, then complete the booking.',
        actionLabel: 'Open booking actions',
        actionHref: '#booking-actions',
      };
    case 'completed':
      return {
        currentStage: 5,
        title: 'Booking completed',
        description: 'Rental operations and commercial closeout are complete. The full record remains available below.',
      };
    case 'cancelled':
      return {
        currentStage: 0,
        title: 'Booking cancelled',
        description: 'This request is closed. Its customer, payment, and operational history remain available for reference.',
        cancelled: true,
      };
  }
}
