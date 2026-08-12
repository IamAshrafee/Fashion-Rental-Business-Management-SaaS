import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { UploadService } from './upload.service';

describe('UploadService product media safety', () => {
  const prisma = {
    productVariant: { findFirst: jest.fn() },
    productImage: {
      findFirst: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
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

  it('rejects image IDs from another tenant or variant during reorder', async () => {
    prisma.productVariant.findFirst.mockResolvedValue({ id: 'variant-1' });
    prisma.productImage.count
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2);

    await expect(service.reorderImages('tenant-1', 'variant-1', [
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
    ])).rejects.toThrow('The reorder request must contain every image from this variant exactly once');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('protects the final image of a published variant', async () => {
    prisma.productImage.findFirst.mockResolvedValue({
      id: 'image-1',
      tenantId: 'tenant-1',
      variantId: 'variant-1',
      isFeatured: true,
      url: 'http://localhost/full.webp',
      thumbnailUrl: 'http://localhost/thumb.webp',
      variant: { product: { status: 'published' } },
    });
    prisma.productImage.count.mockResolvedValue(1);

    await expect(service.deleteProductImage('tenant-1', 'image-1')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'PUBLISHED_CATALOG_STRUCTURE_LOCKED' }),
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
