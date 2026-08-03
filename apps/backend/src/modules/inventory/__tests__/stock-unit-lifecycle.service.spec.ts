import { ConflictException } from '@nestjs/common';
import {
  StockUnitDisposition,
  StockUnitOperationalState,
} from '@prisma/client';
import { StockUnitLifecycleService } from '../stock-unit-lifecycle.service';

describe('StockUnitLifecycleService', () => {
  const prisma = {};
  const service = new StockUnitLifecycleService(prisma as never);

  const unit = {
    id: 'unit-1',
    tenantId: 'tenant-1',
    variantSizeId: 'sku-1',
    disposition: StockUnitDisposition.ACTIVE,
    operationalState: StockUnitOperationalState.AVAILABLE,
    retiredAt: null,
  };

  function transaction(overrides: Record<string, unknown> = {}) {
    return {
      $queryRaw: jest.fn().mockResolvedValue([{ id: unit.id }]),
      stockUnitLifecycleEvent: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'event-1' }),
      },
      stockUnit: {
        findFirst: jest.fn().mockResolvedValue(unit),
        update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...unit, ...data })),
      },
      stockUnitAssignment: { count: jest.fn().mockResolvedValue(0) },
      stockUnitIssue: { count: jest.fn().mockResolvedValue(0) },
      inventoryServiceOrder: { count: jest.fn().mockResolvedValue(0) },
      stockUnitComponentState: { count: jest.fn().mockResolvedValue(0) },
      inventoryMovement: { create: jest.fn().mockResolvedValue({ id: 'movement-1' }) },
      ...overrides,
    };
  }

  it('rejects an invalid direct handout transition', async () => {
    const tx = transaction();
    await expect(
      service.transitionInTransaction(tx as never, {
        tenantId: 'tenant-1',
        stockUnitId: 'unit-1',
        reason: 'Skip preparation',
        targetOperationalState: StockUnitOperationalState.OUT_FOR_RENTAL,
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'LIFECYCLE_TRANSITION_INVALID' }),
    });
    expect(tx.stockUnit.update).not.toHaveBeenCalled();
  });

  it('records a valid return transition', async () => {
    const tx = transaction({
      stockUnit: {
        findFirst: jest.fn().mockResolvedValue({
          ...unit,
          operationalState: StockUnitOperationalState.OUT_FOR_RENTAL,
        }),
        update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...unit, ...data })),
      },
    });

    await expect(
      service.transitionInTransaction(tx as never, {
        tenantId: 'tenant-1',
        stockUnitId: 'unit-1',
        reason: 'Returned by customer',
        targetOperationalState: StockUnitOperationalState.AWAITING_INSPECTION,
      }),
    ).resolves.toMatchObject({ idempotent: false });

    expect(tx.stockUnit.update).toHaveBeenCalledWith({
      where: { id: 'unit-1' },
      data: expect.objectContaining({
        operationalState: StockUnitOperationalState.AWAITING_INSPECTION,
      }),
    });
    expect(tx.stockUnitLifecycleEvent.create).toHaveBeenCalled();
    expect(tx.inventoryMovement.create).toHaveBeenCalled();
  });

  it('does not make a unit available while a blocking issue remains open', async () => {
    const tx = transaction({
      stockUnit: {
        findFirst: jest.fn().mockResolvedValue({
          ...unit,
          operationalState: StockUnitOperationalState.AWAITING_INSPECTION,
        }),
        update: jest.fn(),
      },
      stockUnitIssue: { count: jest.fn().mockResolvedValue(1) },
    });

    await expect(
      service.transitionInTransaction(tx as never, {
        tenantId: 'tenant-1',
        stockUnitId: 'unit-1',
        reason: 'Inspection passed',
        targetOperationalState: StockUnitOperationalState.AVAILABLE,
        inspectionId: 'inspection-1',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.stockUnit.update).not.toHaveBeenCalled();
  });

  it('prevents retirement when another active assignment exists', async () => {
    const tx = transaction({
      stockUnitAssignment: { count: jest.fn().mockResolvedValue(1) },
    });
    await expect(
      service.transitionInTransaction(tx as never, {
        tenantId: 'tenant-1',
        stockUnitId: 'unit-1',
        reason: 'End of useful life',
        targetDisposition: StockUnitDisposition.RETIRED,
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'LIFECYCLE_TRANSITION_INVALID' }),
    });
  });

  it('requires an inspection to reactivate a quarantined unit', async () => {
    const tx = transaction({
      stockUnit: {
        findFirst: jest.fn().mockResolvedValue({
          ...unit,
          disposition: StockUnitDisposition.QUARANTINED,
          operationalState: StockUnitOperationalState.AWAITING_INSPECTION,
        }),
        update: jest.fn(),
      },
    });

    await expect(
      service.transitionInTransaction(tx as never, {
        tenantId: 'tenant-1',
        stockUnitId: 'unit-1',
        reason: 'Manual reactivation',
        targetDisposition: StockUnitDisposition.ACTIVE,
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'INSPECTION_REQUIRED' }),
    });
    expect(tx.stockUnit.update).not.toHaveBeenCalled();
  });
});
