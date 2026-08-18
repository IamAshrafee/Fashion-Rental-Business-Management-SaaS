import { BadRequestException } from '@nestjs/common';
import {
  StockConditionGrade,
  StockUnitDisposition,
  StockUnitInspectionDecision,
  StockUnitInspectionStatus,
  StockUnitInspectionType,
  StockUnitOperationalState,
} from '@prisma/client';
import { StockUnitInspectionService } from '../stock-unit-inspection.service';

describe('StockUnitInspectionService', () => {
  const lifecycle = { transitionInTransaction: jest.fn() };
  const operationalEvents = { append: jest.fn() };

  it('applies global issue-queue scope and inclusive date filters', async () => {
    const prisma = {
      stockUnitIssue: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
    };
    const service = new StockUnitInspectionService(
      prisma as never,
      lifecycle as never,
      operationalEvents as never,
    );

    await service.listAttention('tenant-1', {
      kind: 'ISSUE',
      page: 1,
      limit: 25,
      issueStatus: 'OPEN',
      severity: 'SEVERE',
      responsibility: 'CUSTOMER',
      productId: 'product-1',
      locationId: 'location-1',
      dateFrom: '2026-08-01',
      dateTo: '2026-08-10',
    } as never);

    expect(prisma.stockUnitIssue.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          status: 'OPEN',
          severity: 'SEVERE',
          responsibility: 'CUSTOMER',
          createdAt: { gte: new Date('2026-08-01'), lt: new Date('2026-08-11') },
          stockUnit: expect.objectContaining({ locationId: 'location-1' }),
        }),
      }),
    );
  });

  it('requires an exact assignment for return inspections', async () => {
    const tx = {
      stockUnit: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'unit-1',
          tenantId: 'tenant-1',
          disposition: StockUnitDisposition.ACTIVE,
          operationalState: StockUnitOperationalState.OUT_FOR_RENTAL,
          condition: StockConditionGrade.GOOD,
        }),
      },
    };
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) };
    const service = new StockUnitInspectionService(
      prisma as never,
      lifecycle as never,
      operationalEvents as never,
    );

    await expect(
      service.create(
        'tenant-1',
        'unit-1',
        { inspectionType: StockUnitInspectionType.RETURN },
        'user-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('requires every active inseparable-set component to be checked', async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: 'inspection-1' }]),
      stockUnitInspection: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'inspection-1',
          tenantId: 'tenant-1',
          stockUnitId: 'unit-1',
          status: StockUnitInspectionStatus.DRAFT,
          notes: null,
          amendsInspectionId: null,
          assignmentId: null,
          serviceOrderId: null,
          inventoryBlockId: null,
          serviceOrder: null,
          stockUnit: {
            id: 'unit-1',
            variantSizeId: 'sku-1',
            condition: StockConditionGrade.GOOD,
          },
        }),
      },
      skuSetComponentDefinition: {
        findMany: jest.fn().mockResolvedValue([{ id: 'component-1', name: 'Dupatta' }]),
      },
    };
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) };
    const service = new StockUnitInspectionService(
      prisma as never,
      lifecycle as never,
      operationalEvents as never,
    );

    await expect(
      service.complete(
        'tenant-1',
        'inspection-1',
        {
          conditionAfter: StockConditionGrade.GOOD,
          decision: StockUnitInspectionDecision.AVAILABLE,
          checks: [],
        },
        'user-1',
      ),
    ).rejects.toThrow('Inspection is missing set checks: Dupatta');
  });

  it('keeps a released returned assignment visible until its return inspection is created', async () => {
    const prisma = {
      stockUnit: { findFirst: jest.fn().mockResolvedValue({ id: 'unit-1' }) },
      stockUnitInspection: { findMany: jest.fn().mockResolvedValue([]) },
      stockUnitIssue: { findMany: jest.fn().mockResolvedValue([]) },
      stockUnitLifecycleEvent: { findMany: jest.fn().mockResolvedValue([]) },
      $queryRaw: jest.fn().mockResolvedValue([]),
    };
    const service = new StockUnitInspectionService(
      prisma as never,
      lifecycle as never,
      operationalEvents as never,
    );

    await service.listForUnit('tenant-1', 'unit-1');

    expect(prisma.stockUnit.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          assignments: expect.objectContaining({
            where: {
              OR: expect.arrayContaining([
                { releasedAt: null },
                expect.objectContaining({
                  releasedAt: { not: null },
                  reservation: { booking: { status: { in: ['returned', 'inspected'] } } },
                }),
              ]),
            },
          }),
        }),
      }),
    );
  });
});
