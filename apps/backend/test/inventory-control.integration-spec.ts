import { randomUUID } from 'crypto';
import {
  InventoryLocationType,
  InventoryBlockType,
  InventoryServiceOrderType,
  InventoryTrackingMode,
  PrismaClient,
} from '@prisma/client';
import { AvailabilityPolicyService } from '../src/modules/inventory/availability-policy.service';
import { InventoryAvailabilityService } from '../src/modules/inventory/inventory-availability.service';
import { InventoryBlockService } from '../src/modules/inventory/inventory-block.service';
import { InventoryDashboardService } from '../src/modules/inventory/inventory-dashboard.service';
import { InventoryLocationService } from '../src/modules/inventory/inventory-location.service';
import { InventoryManagementService } from '../src/modules/inventory/inventory-management.service';
import { InventoryPoolService } from '../src/modules/inventory/inventory-pool.service';
import { InventoryServiceOrderService } from '../src/modules/inventory/inventory-service-order.service';
import { StockUnitLifecycleService } from '../src/modules/inventory/stock-unit-lifecycle.service';

describe('inventory control PostgreSQL contracts', () => {
  const prisma = new PrismaClient();
  const locations = new InventoryLocationService(prisma as never);
  const lifecycle = new StockUnitLifecycleService(prisma as never);
  const pools = new InventoryPoolService(prisma as never, locations);
  const management = new InventoryManagementService(prisma as never, lifecycle, locations);
  const policies = new AvailabilityPolicyService(prisma as never);
  const availability = new InventoryAvailabilityService(prisma as never, policies);
  const blocks = new InventoryBlockService(prisma as never);
  const dashboard = new InventoryDashboardService(prisma as never, availability);
  const serviceOrders = new InventoryServiceOrderService(prisma as never, lifecycle, locations);
  let tenantId: string;
  let ownerId: string;
  let productId: string;
  let locationId: string;
  let pooledSkuId: string;
  let serializedSkuId: string;

  beforeAll(async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const owner = await prisma.user.create({
      data: { fullName: 'Inventory Control Owner', email: `inventory-control-${suffix}@example.test`, passwordHash: 'integration-only' },
    });
    ownerId = owner.id;
    const tenant = await prisma.tenant.create({
      data: { businessName: 'Inventory Control Store', subdomain: `inventory-control-${suffix}`, ownerUserId: owner.id },
    });
    tenantId = tenant.id;
    const [category, color, sizeSchema] = await Promise.all([
      prisma.category.create({ data: { tenantId, name: 'Control Apparel', slug: `control-apparel-${suffix}` } }),
      prisma.color.create({ data: { tenantId, name: `Control Red ${suffix}`, hexCode: '#AA0000' } }),
      prisma.sizeSchema.create({ data: { tenantId, code: `CONTROL-${suffix}`, name: 'Control sizing', status: 'active' } }),
    ]);
    const [serializedSize, pooledSize] = await Promise.all([
      prisma.sizeInstance.create({ data: { sizeSchemaId: sizeSchema.id, normalizedKey: 'M', displayLabel: 'M' } }),
      prisma.sizeInstance.create({ data: { sizeSchemaId: sizeSchema.id, normalizedKey: 'FREE', displayLabel: 'Free size' } }),
    ]);
    const product = await prisma.product.create({
      data: { tenantId, categoryId: category.id, name: 'Control Dress', slug: `control-dress-${suffix}`, status: 'published' },
    });
    productId = product.id;
    const variant = await prisma.productVariant.create({
      data: { tenantId, productId, mainColorId: color.id, variantName: 'Red' },
    });
    const [serializedSku, pooledSku, location] = await Promise.all([
      prisma.variantSize.create({ data: { tenantId, variantId: variant.id, sizeInstanceId: serializedSize.id, trackingMode: InventoryTrackingMode.SERIALIZED } }),
      prisma.variantSize.create({ data: { tenantId, variantId: variant.id, sizeInstanceId: pooledSize.id, trackingMode: InventoryTrackingMode.POOLED } }),
      prisma.inventoryLocation.create({ data: { tenantId, code: 'MAIN', name: 'Main workroom', locationType: InventoryLocationType.WAREHOUSE, isDefault: true, canClean: true, canRepair: true } }),
    ]);
    serializedSkuId = serializedSku.id;
    pooledSkuId = pooledSku.id;
    locationId = location.id;
    await prisma.inventoryPool.create({ data: { tenantId, variantSizeId: pooledSkuId, locationId, onHandQuantity: 10 } });
  });

  afterAll(async () => prisma.$disconnect());

  it('serializes optimistic pooled adjustments and records count corrections', async () => {
    const competing = await Promise.allSettled([
      pools.adjust(tenantId, pooledSkuId, { locationId, adjustmentType: 'ADD', quantity: 2, expectedVersion: 0, reason: 'First receipt' }, ownerId),
      pools.adjust(tenantId, pooledSkuId, { locationId, adjustmentType: 'ADD', quantity: 3, expectedVersion: 0, reason: 'Competing receipt' }, ownerId),
    ]);
    expect(competing.map((result) => result.status).sort()).toEqual(['fulfilled', 'rejected']);
    const current = await prisma.inventoryPool.findUniqueOrThrow({ where: { variantSizeId_locationId: { variantSizeId: pooledSkuId, locationId } } });
    expect([12, 13]).toContain(current.onHandQuantity);
    const counted = await pools.count(tenantId, pooledSkuId, { locationId, observedQuantity: 11, expectedVersion: current.version, reason: 'Physical cycle count' }, ownerId);
    expect(counted.pool.onHandQuantity).toBe(11);
    await expect(prisma.inventoryMovement.count({ where: { tenantId, inventoryPoolId: current.id, movementType: 'COUNT_CORRECTION' } })).resolves.toBe(1);
  });

  it('registers a physical-item batch atomically and replays the same request safely', async () => {
    const idempotencyKey = randomUUID();
    const request = {
      locationId,
      rows: [{ assetCode: `CTL-${idempotencyKey.slice(0, 8)}-001` }, { assetCode: `CTL-${idempotencyKey.slice(0, 8)}-002` }],
      idempotencyKey,
    };
    const first = await management.createStockUnitBatch(tenantId, serializedSkuId, request, ownerId);
    const replay = await management.createStockUnitBatch(tenantId, serializedSkuId, request, ownerId);
    expect(first.replayed).toBe(false);
    expect(replay.replayed).toBe(true);
    expect(replay.units.map((unit) => unit.id)).toEqual(first.units.map((unit) => unit.id));

    const duplicateCode = `DUP-${idempotencyKey.slice(0, 8)}`;
    await expect(management.createStockUnitBatch(tenantId, serializedSkuId, {
      locationId,
      rows: [{ assetCode: duplicateCode }, { assetCode: duplicateCode }],
      idempotencyKey: randomUUID(),
    }, ownerId)).rejects.toBeDefined();
    await expect(prisma.stockUnit.count({ where: { tenantId, assetCode: duplicateCode } })).resolves.toBe(0);
  });

  it('enforces manual and service-owned blocks in authoritative availability', async () => {
    const registered = await management.createStockUnitBatch(tenantId, serializedSkuId, {
      locationId,
      rows: [{ assetCode: `BLOCK-${randomUUID().slice(0, 8)}` }],
      idempotencyKey: randomUUID(),
    }, ownerId);
    const unit = registered.units[0];
    await blocks.create(tenantId, {
      stockUnitId: unit.id,
      startDate: '2026-09-10',
      endDate: '2026-09-12',
      blockType: InventoryBlockType.MANUAL,
      reason: 'Reserved for editorial use',
    }, ownerId);
    const manuallyBlocked = await availability.check({
      tenantId, productId, variantSizeId: serializedSkuId, sourceLocationId: locationId,
      startDate: '2026-09-10', endDate: '2026-09-12', quantity: 3,
    });
    expect(manuallyBlocked.available).toBe(false);

    const serviceUnit = (await management.createStockUnitBatch(tenantId, serializedSkuId, {
      locationId,
      rows: [{ assetCode: `SERVICE-${randomUUID().slice(0, 8)}` }],
      idempotencyKey: randomUUID(),
    }, ownerId)).units[0];
    const service = await serviceOrders.create(tenantId, serviceUnit.id, {
      serviceType: InventoryServiceOrderType.CLEANING,
      serviceLocationId: locationId,
      expectedCompletionAt: '2026-10-20T00:00:00.000Z',
      notes: 'Deep cleaning before next rental',
      isAvailabilityBlocking: true,
      idempotencyKey: randomUUID(),
    }, ownerId);
    const duringService = await availability.check({
      tenantId, productId, variantSizeId: serializedSkuId, sourceLocationId: locationId,
      startDate: '2026-10-10', endDate: '2026-10-12', quantity: 4,
    });
    expect(service.inventoryBlockId).toBeTruthy();
    expect(duringService.available).toBe(false);
    const availableItems = await dashboard.listItems(tenantId, {
      page: 1,
      limit: 25,
      productId,
      availableFrom: '2026-09-10',
      availableTo: '2026-09-12',
    });
    expect(availableItems.meta.total).toBe(2);
    expect(availableItems.data.map((item) => item.id)).not.toContain(unit.id);
    expect(availableItems.data.map((item) => item.id)).not.toContain(serviceUnit.id);
  });
});
