import { BadRequestException } from '@nestjs/common';
import {
  InventoryTransferLineKind,
  InventoryTransferStatus,
  InventoryTransferUnitOutcome,
} from '@prisma/client';
import { InventoryTransferService } from '../inventory-transfer.service';

describe('InventoryTransferService', () => {
  const locations = { getActiveOrThrow: jest.fn() };
  const lifecycle = { transitionInTransaction: jest.fn() };

  beforeEach(() => jest.clearAllMocks());

  it('rejects a transfer whose origin and destination are the same', async () => {
    const service = new InventoryTransferService({} as never, locations as never, lifecycle as never);

    await expect(service.create('tenant-1', {
      originLocationId: 'b4ed5208-eb36-4f95-8a35-1f089e91c0cc',
      destinationLocationId: 'b4ed5208-eb36-4f95-8a35-1f089e91c0cc',
      lines: [{
        lineKind: InventoryTransferLineKind.POOLED,
        variantSizeId: '5906dbf4-8261-411f-b3b7-763bd03dbb09',
        quantity: 1,
      }],
    }, 'user-1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('reserves pooled capacity before marking a transfer ready', async () => {
    const transfer = {
      id: 'transfer-1',
      tenantId: 'tenant-1',
      transferNumber: 'TRF-1',
      originLocationId: 'origin-1',
      destinationLocationId: 'destination-1',
      status: InventoryTransferStatus.DRAFT,
      lines: [{
        id: 'line-1',
        lineKind: InventoryTransferLineKind.POOLED,
        variantSizeId: 'sku-1',
        inventoryPoolId: 'pool-1',
        requestedQuantity: 2,
        units: [],
      }],
    };
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: 'transfer-1' }]),
      inventoryTransferEvent: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
      },
      inventoryTransfer: {
        findFirst: jest.fn().mockResolvedValue(transfer),
        update: jest.fn().mockResolvedValue({}),
        findFirstOrThrow: jest.fn().mockResolvedValue({ ...transfer, status: InventoryTransferStatus.READY }),
      },
      inventoryPool: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'pool-1',
          tenantId: 'tenant-1',
          locationId: 'origin-1',
          onHandQuantity: 5,
        }),
      },
      inventoryBlock: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { quantity: 0 } }),
        create: jest.fn().mockResolvedValue({ id: 'block-1' }),
      },
      inventoryReservation: { findMany: jest.fn().mockResolvedValue([]) },
      inventoryMovement: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) };
    const service = new InventoryTransferService(prisma as never, locations as never, lifecycle as never);

    await service.markReady(
      'tenant-1',
      'transfer-1',
      { reason: 'Approved for relocation' },
      'user-1',
    );

    expect(tx.inventoryBlock.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        transferLineId: 'line-1',
        inventoryPoolId: 'pool-1',
        quantity: 2,
        blockType: 'TRANSFER',
      }),
    });
    expect(tx.inventoryTransfer.update).toHaveBeenCalledWith({
      where: { id: 'transfer-1' },
      data: expect.objectContaining({ status: InventoryTransferStatus.READY }),
    });
  });

  it('receives a serialized unit at the destination and completes a clean transfer', async () => {
    const transfer = {
      id: 'transfer-1',
      tenantId: 'tenant-1',
      originLocationId: 'origin-1',
      destinationLocationId: 'destination-1',
      status: InventoryTransferStatus.DISPATCHED,
      lines: [{
        id: 'line-1',
        lineKind: InventoryTransferLineKind.SERIALIZED,
        variantSizeId: 'sku-1',
        dispatchedQuantity: 1,
        receivedQuantity: 0,
        damagedQuantity: 0,
        lostQuantity: 0,
        units: [{
          id: 'transfer-unit-1',
          stockUnitId: 'unit-1',
          outcome: InventoryTransferUnitOutcome.PENDING,
        }],
      }],
    };
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: 'transfer-1' }]),
      inventoryTransferEvent: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
      },
      inventoryTransfer: {
        findFirst: jest.fn().mockResolvedValue(transfer),
        update: jest.fn().mockResolvedValue({}),
        findFirstOrThrow: jest.fn().mockResolvedValue({ ...transfer, status: InventoryTransferStatus.RECEIVED }),
      },
      stockUnit: { update: jest.fn().mockResolvedValue({}) },
      inventoryTransferUnit: { update: jest.fn().mockResolvedValue({}) },
      inventoryTransferLine: {
        update: jest.fn().mockResolvedValue({}),
        findMany: jest.fn().mockResolvedValue([{
          dispatchedQuantity: 1,
          receivedQuantity: 1,
          damagedQuantity: 0,
          lostQuantity: 0,
        }]),
      },
      inventoryMovement: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) };
    lifecycle.transitionInTransaction.mockResolvedValue({});
    const service = new InventoryTransferService(prisma as never, locations as never, lifecycle as never);

    await service.receive('tenant-1', 'transfer-1', {
      reason: 'Received and counted',
      lines: [{
        transferLineId: 'line-1',
        units: [{ stockUnitId: 'unit-1', outcome: InventoryTransferUnitOutcome.RECEIVED }],
      }],
    }, 'user-1');

    expect(tx.stockUnit.update).toHaveBeenCalledWith({
      where: { id: 'unit-1' },
      data: { locationId: 'destination-1' },
    });
    expect(lifecycle.transitionInTransaction).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        stockUnitId: 'unit-1',
        targetOperationalState: 'AVAILABLE',
      }),
    );
    expect(tx.inventoryTransfer.update).toHaveBeenCalledWith({
      where: { id: 'transfer-1' },
      data: expect.objectContaining({ status: InventoryTransferStatus.RECEIVED }),
    });
  });

  it('closes a fully accounted damaged or lost receipt through an explicit reconciliation', async () => {
    const transfer = {
      id: 'transfer-1',
      tenantId: 'tenant-1',
      status: InventoryTransferStatus.RECONCILIATION_REQUIRED,
      lines: [{
        dispatchedQuantity: 3,
        receivedQuantity: 2,
        damagedQuantity: 1,
        lostQuantity: 0,
        units: [],
      }],
    };
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: transfer.id }]),
      inventoryTransferEvent: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
      },
      inventoryTransfer: {
        findFirst: jest.fn().mockResolvedValue(transfer),
        update: jest.fn().mockResolvedValue({}),
        findFirstOrThrow: jest.fn().mockResolvedValue({
          ...transfer,
          status: InventoryTransferStatus.RECONCILED,
        }),
      },
    };
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) };
    const service = new InventoryTransferService(prisma as never, locations as never, lifecycle as never);

    await service.reconcile('tenant-1', transfer.id, {
      reason: 'Damage report accepted and repair issue assigned',
      idempotencyKey: 'reconcile-1',
    }, 'user-1');

    expect(tx.inventoryTransfer.update).toHaveBeenCalledWith({
      where: { id: transfer.id },
      data: expect.objectContaining({
        status: InventoryTransferStatus.RECONCILED,
        reconciliationReason: 'Damage report accepted and repair issue assigned',
      }),
    });
    expect(tx.inventoryTransferEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        fromStatus: InventoryTransferStatus.RECONCILIATION_REQUIRED,
        toStatus: InventoryTransferStatus.RECONCILED,
      }),
    });
  });
});
