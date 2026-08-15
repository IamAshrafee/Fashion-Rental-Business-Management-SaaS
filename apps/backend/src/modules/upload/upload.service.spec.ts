import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { UploadService } from './upload.service';

describe('UploadService product media safety', () => {
  const prisma = {
    productVariant: { findFirst: jest.fn() },
    productImage: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const config = {
    get: jest.fn((key: string) => key === 'storage'
      ? {
          endpoint: 'http://localhost:9000',
          port: 9000,
          accessKey: 'test',
          secretKey: 'test',
          bucket: 'test-bucket',
          region: 'us-east-1',
          useSSL: false,
          publicUrl: 'http://localhost:9000/test-bucket',
        }
      : { maxSizeMb: 10, quality: 80, thumbnailWidth: 400, maxWidth: 1200 }),
  };
  const service = new UploadService(
    prisma as unknown as PrismaService,
    config as unknown as ConfigService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not provision object storage during application startup', () => {
    expect(Object.prototype.hasOwnProperty.call(UploadService.prototype, 'onModuleInit')).toBe(
      false,
    );
  });

  it('synchronizes removal, order, and featured selection in one transaction', async () => {
    const firstId = '11111111-1111-4111-8111-111111111111';
    const secondId = '22222222-2222-4222-8222-222222222222';
    const removedId = '33333333-3333-4333-8333-333333333333';
    prisma.productVariant.findFirst.mockResolvedValue({ id: 'variant-1' });
    prisma.productImage.findMany.mockResolvedValue([
      { id: firstId, url: '', thumbnailUrl: '' },
      { id: secondId, url: '', thumbnailUrl: '' },
      { id: removedId, url: '', thumbnailUrl: '' },
    ]);
    prisma.$transaction.mockResolvedValue([]);

    await service.syncImages('tenant-1', 'variant-1', [secondId, firstId], firstId);

    expect(prisma.productImage.deleteMany).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        variantId: 'variant-1',
        id: { notIn: [secondId, firstId] },
      },
    });
    expect(prisma.productImage.update).toHaveBeenNthCalledWith(1, {
      where: { id: secondId },
      data: { sequence: 0, isFeatured: false },
    });
    expect(prisma.productImage.update).toHaveBeenNthCalledWith(2, {
      where: { id: firstId },
      data: { sequence: 1, isFeatured: true },
    });
  });

  it('rejects a synchronized image list containing an image from outside the variant', async () => {
    const ownedId = '11111111-1111-4111-8111-111111111111';
    const foreignId = '22222222-2222-4222-8222-222222222222';
    prisma.productVariant.findFirst.mockResolvedValue({ id: 'variant-1' });
    prisma.productImage.findMany.mockResolvedValue([
      { id: ownedId, url: '', thumbnailUrl: '' },
    ]);

    await expect(
      service.syncImages('tenant-1', 'variant-1', [ownedId, foreignId], ownedId),
    ).rejects.toThrow('Every image must belong to this product variant');

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

});
