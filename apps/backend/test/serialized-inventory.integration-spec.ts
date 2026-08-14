import { InventoryLocationType, PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { InventoryCountService } from '../src/modules/inventory/inventory-count.service';
import { InventoryLocationService } from '../src/modules/inventory/inventory-location.service';
import { InventoryManagementService } from '../src/modules/inventory/inventory-management.service';
import { StockUnitLifecycleService } from '../src/modules/inventory/stock-unit-lifecycle.service';

describe('serialized inventory PostgreSQL contracts', () => {
  const prisma = new PrismaClient();
  const locations = new InventoryLocationService(prisma as never);
  const lifecycle = new StockUnitLifecycleService(prisma as never);
  const inventory = new InventoryManagementService(prisma as never, lifecycle, locations);
  const counts = new InventoryCountService(prisma as never);

  afterAll(async () => prisma.$disconnect());

  it('registers exact physical pieces and reconciles count findings by identity', async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const owner = await prisma.user.create({
      data: {
        fullName: 'Serialized Inventory Owner',
        email: `serialized-owner-${suffix}@example.test`,
        passwordHash: 'integration-only',
      },
    });
    const tenant = await prisma.tenant.create({
      data: {
        businessName: 'Serialized Inventory Store',
        subdomain: `serialized-${suffix}`,
        ownerUserId: owner.id,
      },
    });
    const mainLocation = await locations.create(
      tenant.id,
      {
        code: 'MAIN',
        name: 'Main warehouse',
        locationType: InventoryLocationType.WAREHOUSE,
      },
      owner.id,
    );
    const otherLocation = await locations.create(
      tenant.id,
      {
        code: 'SHOW',
        name: 'Showroom',
        locationType: InventoryLocationType.SHOWROOM,
      },
      owner.id,
    );
    const [category, color, sizeSchema] = await Promise.all([
      prisma.category.create({
        data: { tenantId: tenant.id, name: 'Dresses', slug: `dresses-${suffix}` },
      }),
      prisma.color.create({
        data: { tenantId: tenant.id, name: 'Inventory Red', hexCode: '#aa1122' },
      }),
      prisma.sizeSchema.create({
        data: {
          tenantId: tenant.id,
          code: `SER-${suffix}`,
          name: 'Serialized size',
          status: 'active',
        },
      }),
    ]);
    const size = await prisma.sizeInstance.create({
      data: {
        sizeSchemaId: sizeSchema.id,
        normalizedKey: 'M',
        displayLabel: 'Medium',
      },
    });
    const product = await prisma.product.create({
      data: {
        tenantId: tenant.id,
        name: 'Identity Count Dress',
        slug: `identity-count-dress-${suffix}`,
        categoryId: category.id,
      },
    });
    const variant = await prisma.productVariant.create({
      data: {
        tenantId: tenant.id,
        productId: product.id,
        variantName: 'Red',
        mainColorId: color.id,
      },
    });
    const sku = await prisma.variantSize.create({
      data: {
        tenantId: tenant.id,
        variantId: variant.id,
        sizeInstanceId: size.id,
      },
    });

    const registration = await inventory.createStockUnitBatch(
      tenant.id,
      sku.id,
      {
        locationId: mainLocation.id,
        rows: [
          { assetCode: `DRS-${suffix}-001`, barcode: `BC-${suffix}-001` },
          { assetCode: `DRS-${suffix}-002`, barcode: `BC-${suffix}-002` },
        ],
        acquisitionCost: 18000,
        acquisitionSource: 'Integration supplier',
        idempotencyKey: randomUUID(),
      },
      owner.id,
    );
    expect(registration.units).toHaveLength(2);
    expect(registration.units.every((unit) => unit.acquisitionCost === 18000)).toBe(true);

    const wrongLocationItem = await prisma.stockUnit.create({
      data: {
        tenantId: tenant.id,
        variantSizeId: sku.id,
        locationId: otherLocation.id,
        assetCode: `DRS-${suffix}-003`,
      },
    });
    const result = await counts.reconcile(
      tenant.id,
      {
        locationId: mainLocation.id,
        identities: [
          registration.units[0].assetCode,
          registration.units[0].assetCode,
          wrongLocationItem.assetCode,
          `UNKNOWN-${suffix}`,
        ],
        reason: 'Integration identity reconciliation',
        idempotencyKey: randomUUID(),
      },
      owner.id,
    );

    expect(result.session).toMatchObject({
      expectedCount: 2,
      observedUniqueCount: 2,
      missingCount: 1,
      unexpectedCount: 1,
      duplicateScanCount: 1,
      unknownScanCount: 1,
      wrongLocationCount: 1,
    });
    expect(result.session.observations).toHaveLength(4);
    expect(result.session.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ stockUnitId: registration.units[1].id, missing: true }),
        expect.objectContaining({
          stockUnitId: wrongLocationItem.id,
          unexpected: true,
          wrongLocation: true,
        }),
      ]),
    );
    await expect(
      prisma.inventoryMovement.count({
        where: { tenantId: tenant.id, countSessionId: result.session.id },
      }),
    ).resolves.toBe(2);
    await expect(
      prisma.stockUnit.findUniqueOrThrow({ where: { id: wrongLocationItem.id } }),
    ).resolves.toMatchObject({ locationId: otherLocation.id, operationalState: 'AVAILABLE' });
  });
});
