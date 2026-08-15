import { describe, expect, it } from 'vitest';
import { getBookingWorkflowState } from './booking-workflow';

describe('booking workflow guidance', () => {
  it('keeps a new booking in review before fulfillment work begins', () => {
    expect(getBookingWorkflowState('pending')).toMatchObject({
      currentStage: 0,
      title: 'Review this new rental request',
      actionHref: '#booking-actions',
    });
  });

  it('maps every lifecycle status to one clear current stage', () => {
    expect(getBookingWorkflowState('confirmed').currentStage).toBe(1);
    expect(getBookingWorkflowState('delivered').currentStage).toBe(2);
    expect(getBookingWorkflowState('overdue').currentStage).toBe(2);
    expect(getBookingWorkflowState('returned').currentStage).toBe(3);
    expect(getBookingWorkflowState('inspected').currentStage).toBe(4);
    expect(getBookingWorkflowState('completed').currentStage).toBe(5);
    expect(getBookingWorkflowState('cancelled').cancelled).toBe(true);
  });
});
