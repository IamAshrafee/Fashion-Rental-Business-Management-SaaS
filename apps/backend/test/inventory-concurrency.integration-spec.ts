import {
  FulfillmentRequirementStatus,
  FulfillmentSelectionSource,
  InventoryLocationType,
  InventoryReservationStatus,
  InventoryTrackingMode,
  PaymentMethod,
  ProductCompositionRole,
  PrismaClient,
} from '@prisma/client';
import { AuthService } from '../src/modules/auth/auth.service';
import { InventoryAssignmentService } from '../src/modules/inventory/inventory-assignment.service';

describe('rental inventory database concurrency', () => {
  const prisma = new PrismaClient();
  const assignmentService = new InventoryAssignmentService(prisma as never);

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('bootstraps every new tenant with an operational rental foundation', async () => {
    const suffix = `${Date.now()}${Math.floor(Math.random() * 10_000)}`;
    const jwtService = { sign: jest.fn(() => `token-${suffix}`) };
    const configService = { get: jest.fn((_key: string, fallback: unknown) => fallback) };
    const eventEmitter = { emit: jest.fn() };
    const tenantService = { isSubdomainAvailable: jest.fn().mockResolvedValue(true) };
    const authService = new AuthService(
      prisma as never,
      jwtService as never,
      configService as never,
      eventEmitter as never,
      tenantService as never,
    );

    const registration = await authService.register(
      {
        fullName: 'Rental Foundation Owner',
        email: `foundation-${suffix}@example.test`,
        phone: `017${suffix.slice(-8)}`,
        password: 'Integration123',
        businessName: 'Rental Foundation Store',
        subdomain: `foundation-${suffix}`,
      },
      {
        ua: {
          browser: 'Integration',
          os: 'Integration',
          deviceType: 'desktop',
          deviceName: 'Integration test',
        },
        ip: '127.0.0.1',
      },
    );

    const [locations, policies, sizeSchemas, productTypes] = await Promise.all([
      prisma.inventoryLocation.findMany({ where: { tenantId: registration.tenant.id } }),
      prisma.availabilityPolicy.findMany({ where: { tenantId: registration.tenant.id } }),
      prisma.sizeSchema.findMany({ where: { tenantId: registration.tenant.id } }),
      prisma.productType.findMany({ where: { tenantId: registration.tenant.id } }),
    ]);

    expect(locations).toHaveLength(1);
    expect(locations[0]).toMatchObject({ code: 'MAIN', isDefault: true, isActive: true });
    expect(policies).toHaveLength(1);
    expect(policies[0]).toMatchObject({
      scope: 'TENANT',
      scopeKey: 'TENANT',
      preparationBufferMinutes: 1_440,
      cleaningBufferMinutes: 1_440,
    });
    expect(sizeSchemas.map((schema) => schema.code).sort()).toEqual([
      'APPAREL_ALPHA',
      'FOOTWEAR_EU',
      'FREE_SIZE',
    ]);
    expect(productTypes).toHaveLength(3);
  });

  it('allows only one overlapping assignment for the same physical item', async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const rentalStart = new Date('2026-10-10T00:00:00.000Z');
    const rentalEnd = new Date('2026-10-12T00:00:00.000Z');
    const blockedStart = new Date('2026-10-09T00:00:00.000Z');
    const blockedEnd = new Date('2026-10-13T00:00:00.000Z');

    const owner = await prisma.user.create({
      data: {
        fullName: 'Inventory Integration Owner',
        email: `inventory-integration-${suffix}@example.test`,
        passwordHash: 'integration-only',
      },
    });
    const tenant = await prisma.tenant.create({
      data: {
        businessName: 'Inventory Integration Store',
        subdomain: `inventory-${suffix}`,
        ownerUserId: owner.id,
      },
    });
    const category = await prisma.category.create({
      data: { tenantId: tenant.id, name: 'Integration Apparel', slug: `apparel-${suffix}` },
    });
    const color = await prisma.color.create({
      data: { tenantId: tenant.id, name: `Integration Red ${suffix}`, hexCode: '#AA0000' },
    });
    const sizeSchema = await prisma.sizeSchema.create({
      data: {
        tenantId: tenant.id,
        code: `INTEGRATION-${suffix}`,
        name: 'Integration sizing',
        status: 'active',
      },
    });
    const size = await prisma.sizeInstance.create({
      data: {
        sizeSchemaId: sizeSchema.id,
        normalizedKey: 'M',
        displayLabel: 'M',
      },
    });
    const product = await prisma.product.create({
      data: {
        tenantId: tenant.id,
        categoryId: category.id,
        name: 'Serialized Integration Dress',
        slug: `serialized-dress-${suffix}`,
        status: 'published',
      },
    });
    const variant = await prisma.productVariant.create({
      data: {
        tenantId: tenant.id,
        productId: product.id,
        mainColorId: color.id,
        variantName: 'Red',
      },
    });
    const sku = await prisma.variantSize.create({
      data: {
        tenantId: tenant.id,
        variantId: variant.id,
        sizeInstanceId: size.id,
        trackingMode: InventoryTrackingMode.SERIALIZED,
      },
    });
    const pooledSize = await prisma.sizeInstance.create({
      data: {
        sizeSchemaId: sizeSchema.id,
        normalizedKey: 'FREE',
        displayLabel: 'Free size',
      },
    });
    const pooledSku = await prisma.variantSize.create({
      data: {
        tenantId: tenant.id,
        variantId: variant.id,
        sizeInstanceId: pooledSize.id,
        trackingMode: InventoryTrackingMode.POOLED,
      },
    });
    const location = await prisma.inventoryLocation.create({
      data: {
        tenantId: tenant.id,
        code: 'MAIN',
        name: 'Main warehouse',
        locationType: InventoryLocationType.WAREHOUSE,
        isDefault: true,
      },
    });
    const pool = await prisma.inventoryPool.create({
      data: {
        tenantId: tenant.id,
        variantSizeId: pooledSku.id,
        locationId: location.id,
        onHandQuantity: 1,
      },
    });
    const unit = await prisma.stockUnit.create({
      data: {
        tenantId: tenant.id,
        variantSizeId: sku.id,
        locationId: location.id,
        assetCode: `DRESS-${suffix}`,
      },
    });
    const customer = await prisma.customer.create({
      data: {
        tenantId: tenant.id,
        fullName: 'Integration Customer',
        phone: `01${Date.now().toString().slice(-9)}`,
      },
    });
    const booking = await prisma.booking.create({
      data: {
        tenantId: tenant.id,
        bookingNumber: `INT-${suffix}`,
        customerId: customer.id,
        status: 'confirmed',
        paymentMethod: PaymentMethod.cod,
        subtotal: 1000,
        grandTotal: 1000,
        deliveryName: customer.fullName,
        deliveryPhone: customer.phone,
        deliveryAddressLine1: 'Integration address',
        deliveryCity: 'Dhaka',
        deliveryCountry: 'BD',
      },
    });

    const reservations = [];
    for (const ordinal of [1, 2]) {
      const bookingItem = await prisma.bookingItem.create({
        data: {
          tenantId: tenant.id,
          bookingId: booking.id,
          productId: product.id,
          variantId: variant.id,
          variantSizeId: sku.id,
          productName: product.name,
          variantName: variant.variantName,
          colorName: color.name,
          sizeInfo: size.displayLabel,
          featuredImageUrl: 'https://example.test/item.jpg',
          startDate: rentalStart,
          endDate: rentalEnd,
          rentalDays: 3,
          baseRental: 1000,
          itemTotal: 1000,
        },
      });
      const requirement = await prisma.fulfillmentRequirement.create({
        data: {
          tenantId: tenant.id,
          bookingId: booking.id,
          bookingItemId: bookingItem.id,
          requirementKey: `main-${ordinal}`,
          role: ProductCompositionRole.MAIN,
          selectionSource: FulfillmentSelectionSource.MAIN_PRODUCT,
          status: FulfillmentRequirementStatus.RESERVED,
          productId: product.id,
          variantSizeId: sku.id,
          sourceLocationId: location.id,
          trackingModeSnapshot: InventoryTrackingMode.SERIALIZED,
          availabilityPolicySnapshot: {
            eligibleConditionGrades: ['NEW', 'EXCELLENT', 'GOOD', 'FAIR'],
            eligibleOperationalStates: ['AVAILABLE'],
          },
          quantity: 1,
          productNameSnapshot: product.name,
          variantNameSnapshot: variant.variantName,
          sizeSnapshot: size.displayLabel,
          rentalStartDate: rentalStart,
          rentalEndDate: rentalEnd,
          blockedStartDate: blockedStart,
          blockedEndDate: blockedEnd,
        },
      });
      reservations.push(
        await prisma.inventoryReservation.create({
          data: {
            tenantId: tenant.id,
            bookingId: booking.id,
            bookingItemId: bookingItem.id,
            fulfillmentRequirementId: requirement.id,
            productId: product.id,
            variantSizeId: sku.id,
            sourceLocationId: location.id,
            quantity: 1,
            rentalStartDate: rentalStart,
            rentalEndDate: rentalEnd,
            blockedStartDate: blockedStart,
            blockedEndDate: blockedEnd,
            status: InventoryReservationStatus.CONFIRMED,
          },
        }),
      );
    }

    const competingAssignments = await Promise.allSettled(
      reservations.map((reservation) =>
        assignmentService.assign(
          tenant.id,
          booking.id,
          reservation.bookingItemId,
          [unit.id],
          owner.id,
          reservation.fulfillmentRequirementId,
        ),
      ),
    );

    expect(competingAssignments.map((result) => result.status).sort()).toEqual([
      'fulfilled',
      'rejected',
    ]);
    await expect(
      prisma.stockUnitAssignment.count({
        where: { tenantId: tenant.id, stockUnitId: unit.id, releasedAt: null },
      }),
    ).resolves.toBe(1);

    await expect(
      prisma.inventoryPool.update({
        where: { id: pool.id },
        data: { onHandQuantity: -1 },
      }),
    ).rejects.toBeDefined();
  });
});
