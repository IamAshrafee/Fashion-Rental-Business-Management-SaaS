import { BadRequestException, ConflictException } from '@nestjs/common';
import { StockUnitRevenueAllocationKind } from '@prisma/client';
import { StockUnitRevenueService } from '../stock-unit-revenue.service';

const tenantId = 'tenant-1';
const stockUnitId = '11111111-1111-4111-8111-111111111111';
const assignmentId = '22222222-2222-4222-8222-222222222222';
const actorUserId = '33333333-3333-4333-8333-333333333333';
const idempotencyKey = '44444444-4444-4444-8444-444444444444';

function makeService(overrides: Record<string, unknown> = {}) {
  const tx = {
    $queryRaw: jest.fn(),
    stockUnitAssignment: {
      findFirst: jest.fn().mockResolvedValue({
        id: assignmentId,
        stockUnitId,
        reservation: {
          bookingId: 'booking-1',
          bookingItemId: 'booking-item-1',
          fulfillmentRequirementId: 'requirement-1',
        },
      }),
    },
    stockUnitRevenueAllocation: {
      findFirst: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'original-1' }),
      create: jest
        .fn()
        .mockImplementation(({ data }) => Promise.resolve({ id: 'adjustment-1', ...data })),
    },
    ...overrides,
  };
  const prisma = {
    $transaction: jest.fn((callback) => callback(tx)),
  };
  return { service: new StockUnitRevenueService(prisma as never), tx };
}

describe('StockUnitRevenueService', () => {
  it('appends a signed adjustment without changing the original allocation', async () => {
    const { service, tx } = makeService();

    const result = await service.createAdjustment(
      tenantId,
      stockUnitId,
      { assignmentId, amount: -2500, reason: ' Partial refund ', idempotencyKey },
      actorUserId,
    );

    expect(result.replayed).toBe(false);
    expect(tx.stockUnitRevenueAllocation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        stockUnitId,
        assignmentId,
        allocationKind: StockUnitRevenueAllocationKind.ADJUSTMENT,
        amount: -2500,
        reason: 'Partial refund',
        sourceKey: `adjustment:${idempotencyKey}`,
        actorUserId,
      }),
    });
  });

  it('returns an identical replay and rejects a changed command using the same key', async () => {
    const existing = {
      id: 'adjustment-1',
      tenantId,
      stockUnitId,
      assignmentId,
      amount: -2500,
      reason: 'Partial refund',
    };
    const revenue = {
      findFirst: jest.fn().mockResolvedValue(existing),
      create: jest.fn(),
    };
    const { service } = makeService({ stockUnitRevenueAllocation: revenue });

    await expect(
      service.createAdjustment(tenantId, stockUnitId, {
        assignmentId,
        amount: -2500,
        reason: 'Partial refund',
        idempotencyKey,
      }),
    ).resolves.toEqual({ allocation: existing, replayed: true });

    await expect(
      service.createAdjustment(tenantId, stockUnitId, {
        assignmentId,
        amount: -3000,
        reason: 'Partial refund',
        idempotencyKey,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(revenue.create).not.toHaveBeenCalled();
  });

  it('rejects zero adjustments before opening a transaction', async () => {
    const { service } = makeService();
    await expect(
      service.createAdjustment(tenantId, stockUnitId, {
        assignmentId,
        amount: 0,
        reason: 'No change',
        idempotencyKey,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
