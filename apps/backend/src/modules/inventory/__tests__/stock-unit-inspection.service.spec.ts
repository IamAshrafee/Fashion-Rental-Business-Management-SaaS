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
    const service = new StockUnitInspectionService(prisma as never, lifecycle as never);

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
    const service = new StockUnitInspectionService(prisma as never, lifecycle as never);

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
});
