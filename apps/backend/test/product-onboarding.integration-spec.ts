import { PrismaClient } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PricingAdminService } from '../src/modules/pricing-engine/pricing-admin.service';
import { ProductOnboardingService } from '../src/modules/product/product-onboarding.service';
import { ProductService } from '../src/modules/product/product.service';

describe('product onboarding database workflow', () => {
  const prisma = new PrismaClient();
  const products = new ProductService(prisma as never, { emit: jest.fn() } as unknown as EventEmitter2);
  const pricing = new PricingAdminService(prisma as never);
  const onboarding = new ProductOnboardingService(prisma as never, products, pricing);

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('persists, resumes, protects revisions, records hybrid opening inventory, and publishes', async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const owner = await prisma.user.create({
      data: {
        fullName: 'Product Onboarding Owner',
        email: `onboarding-${suffix}@example.test`,
        passwordHash: 'integration-only',
      },
    });
    const tenant = await prisma.tenant.create({
      data: {
        businessName: 'Onboarding Integration Store',
        subdomain: `onboarding-${suffix}`,
        ownerUserId: owner.id,
      },
    });
    const category = await prisma.category.create({
      data: { tenantId: tenant.id, name: 'Dresses', slug: `dresses-${suffix}` },
    });
    const schema = await prisma.sizeSchema.create({
      data: {
        tenantId: tenant.id,
        code: `ONBOARD-${suffix}`,
        name: 'Onboarding sizes',
        status: 'active',
      },
    });
    const [medium, large] = await Promise.all([
      prisma.sizeInstance.create({
        data: { sizeSchemaId: schema.id, normalizedKey: 'M', displayLabel: 'M', sortOrder: 1 },
      }),
      prisma.sizeInstance.create({
        data: { sizeSchemaId: schema.id, normalizedKey: 'L', displayLabel: 'L', sortOrder: 2 },
      }),
    ]);
    const productType = await prisma.productType.create({
      data: {
        tenantId: tenant.id,
        name: 'Rental dress',
        slug: `rental-dress-${suffix}`,
        defaultSizeSchemaId: schema.id,
      },
    });
    const color = await prisma.color.create({
      data: { tenantId: tenant.id, name: `Ruby ${suffix}`, hexCode: '#A00020' },
    });
    const location = await prisma.inventoryLocation.create({
      data: {
        tenantId: tenant.id,
        code: 'MAIN',
        name: 'Main warehouse',
        locationType: 'WAREHOUSE',
        isDefault: true,
      },
    });

    const startInput = {
      name: 'Ruby Wedding Dress',
      categoryId: category.id,
      productTypeId: productType.id,
      eventIds: [],
    };
    const [started, replayedStart] = await Promise.all([
      onboarding.start(tenant.id, owner.id, startInput, `start-${suffix}`),
      onboarding.start(tenant.id, owner.id, startInput, `start-${suffix}`),
    ]);
    expect(replayedStart.productId).toBe(started.productId);
    expect(replayedStart.revision).toBe(1);

    const withSkus = await onboarding.saveSkus(
      tenant.id,
      started.productId,
      owner.id,
      {
        expectedRevision: 1,
        variants: [{
          clientKey: 'ruby',
          variantName: 'Ruby',
          mainColorId: color.id,
          identicalColorIds: [color.id],
          sizes: [
            { sizeInstanceId: medium.id, trackingMode: 'POOLED' },
            { sizeInstanceId: large.id, trackingMode: 'SERIALIZED' },
          ],
        }],
      },
      `skus-${suffix}`,
    );
    expect(withSkus.revision).toBe(2);
    expect(withSkus.product.variants[0].onboardingKey).toBe('ruby');

    await expect(onboarding.saveBasics(
      tenant.id,
      started.productId,
      owner.id,
      { ...startInput, expectedRevision: 1 },
      `stale-${suffix}`,
    )).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'STALE_PRODUCT_ONBOARDING' }),
    });

    const variant = withSkus.product.variants[0];
    await prisma.productImage.create({
      data: {
        tenantId: tenant.id,
        variantId: variant.id,
        url: 'https://example.test/ruby-dress.jpg',
        thumbnailUrl: 'https://example.test/ruby-dress-thumb.jpg',
        isFeatured: true,
      },
    });
    const withContent = await onboarding.saveContent(
      tenant.id,
      started.productId,
      owner.id,
      {
        expectedRevision: 2,
        description: 'A complete rental-ready wedding dress.',
        details: [{
          headerName: 'Materials',
          entries: [{ key: 'Fabric', value: 'Silk blend' }],
        }],
        faqs: [{ question: 'Is alteration available?', answer: 'Yes, by appointment.' }],
      },
      `content-${suffix}`,
    );
    const withPricing = await onboarding.savePricing(
      tenant.id,
      started.productId,
      owner.id,
      {
        expectedRevision: withContent.revision,
        pricing: {
          ratePlan: { type: 'PER_DAY', config: { unitPriceMinor: 150_000, minDays: 1 } },
          components: [],
          lateFeePolicy: { enabled: false },
        },
      },
      `pricing-${suffix}`,
    );

    const pooledSku = withPricing.product.variants[0].sizes.find(
      (size: { id: string; trackingMode: string }) => size.trackingMode === 'POOLED',
    )!;
    const serializedSku = withPricing.product.variants[0].sizes.find(
      (size: { id: string; trackingMode: string }) => size.trackingMode === 'SERIALIZED',
    )!;
    const openingInput = {
      expectedRevision: withPricing.revision,
      skipInventory: false,
      lines: [
        { variantSizeId: pooledSku.id, locationId: location.id, pooledQuantity: 3 },
        {
          variantSizeId: serializedSku.id,
          locationId: location.id,
          units: [{ assetCode: `dress-${suffix}-001`, condition: 'EXCELLENT' as const }],
        },
      ],
    };
    const withInventory = await onboarding.saveOpeningInventory(
      tenant.id,
      started.productId,
      owner.id,
      openingInput,
      `inventory-${suffix}`,
    );
    const replayedInventory = await onboarding.saveOpeningInventory(
      tenant.id,
      started.productId,
      owner.id,
      openingInput,
      `inventory-${suffix}`,
    );
    expect(replayedInventory.revision).toBe(withInventory.revision);

    const published = await onboarding.publish(
      tenant.id,
      started.productId,
      owner.id,
      { expectedRevision: withInventory.revision },
      `publish-${suffix}`,
    );
    expect(published.product.status).toBe('published');
    expect(published.completedSections).toEqual(expect.arrayContaining([
      'BASICS', 'SKUS', 'CONTENT', 'PRICING', 'OPENING_INVENTORY', 'REVIEW',
    ]));

    const [pool, unit, movements, commands] = await Promise.all([
      prisma.inventoryPool.findUnique({
        where: { variantSizeId_locationId: { variantSizeId: pooledSku.id, locationId: location.id } },
      }),
      prisma.stockUnit.findFirst({ where: { tenantId: tenant.id, variantSizeId: serializedSku.id } }),
      prisma.inventoryMovement.findMany({ where: { tenantId: tenant.id } }),
      prisma.productOnboardingCommand.count({ where: { tenantId: tenant.id } }),
    ]);
    expect(pool?.onHandQuantity).toBe(3);
    expect(unit).toMatchObject({
      assetCode: `DRESS-${suffix.toUpperCase()}-001`,
      condition: 'EXCELLENT',
    });
    expect(movements.map((movement) => movement.movementType)).toEqual(
      expect.arrayContaining(['INITIAL_STOCK', 'UNIT_REGISTERED']),
    );
    expect(commands).toBe(6);
  });
});
