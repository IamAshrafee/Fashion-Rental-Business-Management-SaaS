import { PrismaService } from '../../prisma/prisma.service';
import { PricingAdminService } from './pricing-admin.service';

describe('PricingAdminService configuration authority', () => {
  const tx = {
    product: { findFirst: jest.fn() },
    pricingProfile: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
    pricePolicyVersion: {
      updateMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    ratePlan: { create: jest.fn() },
    priceComponent: { createMany: jest.fn() },
  };
  const prisma = {
    ...tx,
    $transaction: jest.fn(async (callback: (database: typeof tx) => unknown) => callback(tx)),
  };
  const service = new PricingAdminService(prisma as unknown as PrismaService);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(
      async (callback: (database: typeof tx) => unknown) => callback(tx),
    );
    tx.product.findFirst.mockResolvedValue({ id: 'product-1', purchasePrice: 500_000 });
    tx.pricingProfile.findUnique.mockResolvedValue({ id: 'profile-1' });
    tx.pricePolicyVersion.updateMany.mockResolvedValue({ count: 1 });
    tx.pricePolicyVersion.findFirst.mockResolvedValue({ version: 2 });
    tx.pricePolicyVersion.create.mockResolvedValue({ id: 'policy-3' });
    tx.ratePlan.create.mockResolvedValue({ id: 'rate-1' });
    tx.priceComponent.createMany.mockResolvedValue({ count: 0 });
    tx.pricingProfile.update.mockResolvedValue({ id: 'profile-1' });
  });

  it('rejects a rate plan that can produce a zero rental price before version writes', async () => {
    await expect(service.savePricing('tenant-1', 'product-1', {
      ratePlan: { type: 'PER_DAY', config: { unitPriceMinor: 0, minDays: 1 } },
    })).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'INVALID_PRICING_CONFIGURATION',
        field: 'ratePlan.config.unitPriceMinor',
      }),
    });
    expect(tx.pricePolicyVersion.updateMany).not.toHaveBeenCalled();
  });

  it('rejects tier gaps and overlapping open-ended tiers', async () => {
    await expect(service.savePricing('tenant-1', 'product-1', {
      ratePlan: {
        type: 'TIERED_DAILY',
        config: {
          tiers: [
            { fromDay: 1, toDay: 3, pricePerDayMinor: 100_000 },
            { fromDay: 5, toDay: null, pricePerDayMinor: 80_000 },
          ],
        },
      },
    })).rejects.toMatchObject({
      response: expect.objectContaining({ field: 'ratePlan.config.tiers.1.fromDay' }),
    });
  });

  it('requires acquisition value for percentage-of-retail pricing', async () => {
    tx.product.findFirst.mockResolvedValue({ id: 'product-1', purchasePrice: null });

    await expect(service.savePricing('tenant-1', 'product-1', {
      ratePlan: {
        type: 'PERCENT_RETAIL',
        config: { percent: 10, basis: 'PER_RENTAL', minPriceMinor: 50_000 },
      },
    })).rejects.toMatchObject({
      response: expect.objectContaining({ field: 'purchasePrice' }),
    });
  });

  it('enforces refundable deposit semantics', async () => {
    await expect(service.savePricing('tenant-1', 'product-1', {
      ratePlan: { type: 'PER_DAY', config: { unitPriceMinor: 100_000, minDays: 1 } },
      components: [{
        type: 'DEPOSIT',
        refundable: false,
        config: { label: 'Security deposit', pricing: { mode: 'FLAT', amountMinor: 200_000 } },
      }],
    })).rejects.toMatchObject({
      response: expect.objectContaining({ field: 'components.0.refundable' }),
    });
  });

  it('publishes a validated immutable version and updates the storefront headline', async () => {
    const result = await service.savePricing('tenant-1', 'product-1', {
      ratePlan: { type: 'FLAT_PERIOD', config: { flatPriceMinor: 400_000, includedDays: 3, extraDayPriceMinor: 90_000 } },
      components: [{
        type: 'DEPOSIT',
        refundable: true,
        config: { label: 'Security deposit', pricing: { mode: 'FLAT', amountMinor: 200_000 } },
      }],
      lateFeePolicy: { enabled: true, graceHours: 12, mode: 'PER_DAY', amountMinor: 50_000 },
    });

    expect(result).toEqual({ profileId: 'profile-1', policyVersionId: 'policy-3', version: 3 });
    expect(tx.pricePolicyVersion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ version: 3, status: 'ACTIVE' }),
    });
    expect(tx.pricingProfile.update).toHaveBeenCalledWith({
      where: { id: 'profile-1' },
      data: expect.objectContaining({
        activePolicyVersionId: 'policy-3',
        headlinePriceMinor: 400_000,
        headlineLabel: '/3 days',
      }),
    });
  });

  it('does not allow pricing removal to invalidate a published product', async () => {
    prisma.product.findFirst.mockResolvedValue({
      status: 'published',
      pricingProfile: { id: 'profile-1' },
    });

    await expect(service.deletePricingProfile('tenant-1', 'product-1')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'PUBLISHED_PRICING_LOCKED' }),
    });
    expect(prisma.pricingProfile.delete).not.toHaveBeenCalled();
  });
});
