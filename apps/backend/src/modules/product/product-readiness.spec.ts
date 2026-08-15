import { ProductService } from './product.service';

describe('Product publication readiness', () => {
  it('allows a complete catalog listing to be ready with zero registered physical items', async () => {
    const prisma = {
      product: {
        findFirst: jest.fn().mockResolvedValue({
          category: { isActive: true },
          productType: {
            defaultSizeSchema: { id: 'schema-1', status: 'active' },
          },
          sizeSchemaOverride: null,
          storefrontItemMode: 'INTERNAL_ONLY',
          pricingProfile: {
            policyVersions: [{ ratePlans: [{ id: 'rate-plan-1' }] }],
          },
          variants: [
            {
              id: 'variant-1',
              variantName: 'Black',
              images: [{ id: 'image-1' }],
              sizes: [
                {
                  id: 'sku-1',
                  sizeInstance: { sizeSchemaId: 'schema-1' },
                },
              ],
            },
          ],
          compositionRules: [],
        }),
      },
    };
    const service = new ProductService(prisma as never, { emit: jest.fn() } as never);

    await expect(service.getReadiness('tenant-1', 'product-1')).resolves.toEqual({
      ready: true,
      blockers: [],
    });

    expect(prisma.product.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'product-1', tenantId: 'tenant-1', deletedAt: null },
      }),
    );
    const selection = prisma.product.findFirst.mock.calls[0][0].select;
    expect(selection).not.toHaveProperty('stockUnits');
  });

  it('uses the category active state when mapping a product detail response', async () => {
    const prisma = {
      product: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'product-1',
          category: { id: 'category-1', name: 'Saree', slug: 'saree', isActive: true },
          productType: {
            id: 'type-1',
            name: 'Apparel',
            slug: 'apparel',
            defaultSizeSchema: {
              id: 'schema-1',
              status: 'active',
              code: 'apparel',
              name: 'Standard apparel',
              schemaType: 'STANDARD',
              definition: {},
              instances: [],
              sizeCharts: [],
            },
          },
          sizeSchemaOverride: null,
          storefrontItemMode: 'INTERNAL_ONLY',
          pricingProfile: {
            id: 'profile-1',
            currency: 'BDT',
            policyVersions: [{ ratePlans: [{ id: 'rate-plan-1' }], priceComponents: [] }],
          },
          variants: [
            {
              id: 'variant-1',
              images: [{ id: 'image-1' }],
              sizes: [{ id: 'sku-1', sizeInstance: { sizeSchemaId: 'schema-1' } }],
            },
          ],
          events: [],
          faqs: [],
          detailHeaders: [],
          compositionRules: [],
        }),
      },
    };
    const service = new ProductService(prisma as never, { emit: jest.fn() } as never);

    await expect(service.getById('tenant-1', 'product-1')).resolves.toMatchObject({
      readiness: { ready: true, blockers: [] },
    });

    const query = prisma.product.findFirst.mock.calls[0][0];
    expect(query.include.category.select).toMatchObject({ isActive: true });
  });
});
