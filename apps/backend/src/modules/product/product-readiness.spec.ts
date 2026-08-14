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
});
