import { EventEmitter2 } from '@nestjs/event-emitter';
import { InventoryTrackingMode } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ProductService } from './product.service';

describe('ProductService owner catalog list', () => {
  const product = {
    id: 'product-1',
    name: 'Red Designer Dress',
    slug: 'red-designer-dress',
    status: 'draft' as const,
    storefrontItemMode: 'INTERNAL_ONLY' as const,
    targetRentals: 20,
    totalBookings: 4,
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    updatedAt: new Date('2026-08-02T00:00:00.000Z'),
    deletedAt: null,
    category: { id: 'category-1', name: 'Dresses', slug: 'dresses', isActive: true },
    productType: {
      id: 'type-1',
      name: 'Apparel',
      slug: 'apparel',
      defaultSizeSchema: { id: 'schema-1', status: 'active' as const },
    },
    sizeSchemaOverride: null,
    pricingProfile: {
      headlinePriceMinor: 150000,
      headlineLabel: 'From',
      policyVersions: [{ ratePlans: [{ type: 'PER_DAY' as const }] }],
    },
    variants: [
      {
        id: 'variant-1',
        mainColor: { name: 'Red', hexCode: '#FF0000' },
        images: [
          {
            id: 'image-1',
            url: 'https://example.test/dress.jpg',
            thumbnailUrl: 'https://example.test/dress-thumb.jpg',
            isFeatured: true,
          },
        ],
        sizes: [
          {
            id: 'sku-1',
            trackingMode: InventoryTrackingMode.POOLED,
            sizeInstance: { sizeSchemaId: 'schema-1' },
            inventoryPools: [{ onHandQuantity: 2 }],
            _count: { stockUnits: 0 },
          },
          {
            id: 'sku-2',
            trackingMode: InventoryTrackingMode.SERIALIZED,
            sizeInstance: { sizeSchemaId: 'schema-1' },
            inventoryPools: [],
            _count: { stockUnits: 1 },
          },
        ],
      },
    ],
    compositionRules: [],
    deletedBy: null,
    _count: { bookingItems: 4 },
  };

  const productDelegate = {
    findMany: jest.fn(),
    count: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  };
  const prisma = { product: productDelegate };
  const service = new ProductService(
    prisma as unknown as PrismaService,
    { emit: jest.fn() } as unknown as EventEmitter2,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    productDelegate.findMany.mockResolvedValue([product]);
    productDelegate.count.mockResolvedValue(21);
    productDelegate.findFirst.mockResolvedValue(null);
  });

  it('returns stable pagination, readiness, tracking, and inventory projections', async () => {
    const result = await service.listOwner('tenant-1', { page: 2, limit: 20 });

    expect(result.meta).toEqual({ page: 2, limit: 20, total: 21, totalPages: 2 });
    expect(result.data[0]).toMatchObject({
      id: 'product-1',
      rentalPrice: 150000,
      thumbnailUrl: 'https://example.test/dress-thumb.jpg',
      variantCount: 1,
      skuCount: 2,
      trackingMode: 'MIXED',
      inventory: {
        onHand: 3,
        pooledOnHand: 2,
        serializedUnits: 1,
        hasStock: true,
      },
      readiness: { ready: true, blockers: [] },
    });
    expect(productDelegate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 20,
        take: 20,
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
        where: { tenantId: 'tenant-1', deletedAt: null },
      }),
    );
  });

  it('builds tenant-scoped owner filters without client-side filtering', async () => {
    productDelegate.findMany.mockResolvedValue([]);
    productDelegate.count.mockResolvedValue(0);

    const result = await service.listOwner('tenant-1', {
      search: 'red dress',
      status: 'draft',
      categoryId: 'category-1',
      productTypeId: 'type-1',
      trackingMode: InventoryTrackingMode.SERIALIZED,
      readiness: 'needs_attention',
      stockState: 'no_stock',
      sort: 'name',
      order: 'asc',
    });

    expect(result.meta.totalPages).toBe(1);
    const call = productDelegate.findMany.mock.calls[0][0];
    expect(call.orderBy).toEqual([{ name: 'asc' }, { id: 'asc' }]);
    expect(call.where).toMatchObject({
      tenantId: 'tenant-1',
      deletedAt: null,
      status: 'draft',
      categoryId: 'category-1',
      productTypeId: 'type-1',
      variants: {
        some: { sizes: { some: { trackingMode: InventoryTrackingMode.SERIALIZED } } },
      },
      OR: [
        { name: { contains: 'red dress', mode: 'insensitive' } },
        { slug: { contains: 'red dress', mode: 'insensitive' } },
      ],
    });
    expect(call.where.AND).toEqual([
      expect.objectContaining({ NOT: expect.any(Object) }),
      expect.objectContaining({ NOT: expect.any(Object) }),
    ]);
  });

  it('reports exact publication blockers without treating zero stock as invalid catalog data', async () => {
    productDelegate.findMany.mockResolvedValue([
      {
        ...product,
        productType: null,
        pricingProfile: null,
        variants: [
          {
            ...product.variants[0],
            images: [],
            sizes: [],
          },
        ],
      },
    ]);

    const result = await service.listOwner('tenant-1', {});

    expect(result.data[0].readiness).toMatchObject({
      ready: false,
      blockers: expect.arrayContaining([
        expect.objectContaining({ code: 'PRODUCT_TYPE', section: 'sizing' }),
        expect.objectContaining({ code: 'SIZE_SCHEMA', section: 'sizing' }),
        expect.objectContaining({ code: 'RENTABLE_SKU', section: 'variants' }),
        expect.objectContaining({ code: 'VARIANT_MEDIA', section: 'variants' }),
        expect.objectContaining({ code: 'ACTIVE_PRICING', section: 'pricing' }),
      ]),
    });
    expect(result.data[0].inventory).toEqual({
      onHand: 0,
      pooledOnHand: 0,
      serializedUnits: 0,
      hasStock: false,
    });
  });

  it('returns the same draft for a matching product creation key', async () => {
    productDelegate.findFirst.mockResolvedValue({
      id: 'saved-draft-1',
      name: 'Red Designer Dress',
      categoryId: 'category-1',
      productTypeId: 'type-1',
      creationKey: 'create-request-1',
    });

    const result = await service.create(
      'tenant-1',
      {
        name: 'Red Designer Dress',
        categoryId: 'category-1',
        productTypeId: 'type-1',
      },
      'create-request-1',
    );

    expect(result).toMatchObject({ id: 'saved-draft-1' });
    expect(productDelegate.findFirst).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1', creationKey: 'create-request-1' },
    });
  });

  it('rejects reuse of a product creation key for different basics', async () => {
    productDelegate.findFirst.mockResolvedValue({
      id: 'saved-draft-1',
      name: 'Red Designer Dress',
      categoryId: 'category-1',
      productTypeId: 'type-1',
    });

    await expect(service.create(
      'tenant-1',
      {
        name: 'Blue Designer Dress',
        categoryId: 'category-1',
        productTypeId: 'type-1',
      },
      'create-request-1',
    )).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'IDEMPOTENCY_KEY_REUSED' }),
    });
  });

  it('maps owner detail pricing and resolved sizing onto the frontend contract', async () => {
    productDelegate.findFirst.mockResolvedValue({
      ...product,
      sizeSchemaOverride: {
        id: 'schema-1',
        code: 'APPAREL_ALPHA',
        name: 'Standard apparel',
        schemaType: 'STANDARD',
        definition: {},
        instances: [],
        sizeCharts: [],
      },
      pricingProfile: {
        id: 'pricing-1',
        currency: 'BDT',
        policyVersions: [{
          id: 'policy-1',
          ratePlans: [{ type: 'PER_DAY', config: { unitPriceMinor: 150000 } }],
          priceComponents: [],
          lateFeePolicy: null,
        }],
      },
    });

    const result = await service.getById('tenant-1', 'product-1');

    expect(result).toMatchObject({
      pricing: {
        profileId: 'pricing-1',
        policyVersionId: 'policy-1',
        ratePlanType: 'PER_DAY',
      },
      sizing: {
        schema: { id: 'schema-1', code: 'APPAREL_ALPHA' },
      },
    });
  });

  it('returns section-addressable publication blockers from the authoritative readiness query', async () => {
    productDelegate.findFirst.mockResolvedValue({
      category: { isActive: true },
      productType: { defaultSizeSchema: { id: 'schema-1', status: 'active' } },
      sizeSchemaOverride: null,
      storefrontItemMode: 'SPECIFIC_ITEM_SELECTION',
      pricingProfile: null,
      variants: [{
        id: 'variant-1',
        variantName: 'Red',
        images: [],
        sizes: [{
          id: 'sku-1',
          trackingMode: InventoryTrackingMode.POOLED,
          sizeInstance: { sizeSchemaId: 'schema-1' },
        }],
      }],
      compositionRules: [{
        id: 'rule-1',
        name: 'Jewellery set',
        componentProduct: { id: 'component-1', status: 'draft', deletedAt: null },
        alternatives: [],
      }],
    });

    const readiness = await service.getReadiness('tenant-1', 'product-1');

    expect(readiness.ready).toBe(false);
    expect(readiness.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'VARIANT_MEDIA', section: 'variants', entityId: 'variant-1' }),
      expect.objectContaining({ code: 'STOREFRONT_ITEM_MODE', field: 'storefrontItemMode' }),
      expect.objectContaining({ code: 'ACTIVE_PRICING', section: 'pricing' }),
      expect.objectContaining({ code: 'COMPOSITION', section: 'composition', entityId: 'rule-1' }),
    ]));
  });

  it('rejects publication with the same blocker contract returned by readiness', async () => {
    productDelegate.findFirst
      .mockResolvedValueOnce({ id: 'product-1', tenantId: 'tenant-1', status: 'draft', deletedAt: null })
      .mockResolvedValueOnce({
        category: { isActive: true },
        productType: null,
        sizeSchemaOverride: null,
        storefrontItemMode: 'INTERNAL_ONLY',
        pricingProfile: null,
        variants: [],
        compositionRules: [],
      });

    await expect(service.updateStatus('tenant-1', 'product-1', 'published')).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'PRODUCT_NOT_READY_TO_PUBLISH',
        blockers: expect.arrayContaining([
          expect.objectContaining({ code: 'PRODUCT_TYPE', section: 'sizing' }),
        ]),
      }),
    });
    expect(productDelegate.update).not.toHaveBeenCalled();
  });
});
