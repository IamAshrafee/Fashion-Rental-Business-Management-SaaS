/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import * as Minio from 'minio';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';

interface UploadResult {
  url: string;
  thumbnailUrl: string;
  fileSize: number;
}

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
  private bucketReady = false;
  private privateBucketReady = false;
  private readonly minioClient: Minio.Client;
  private readonly bucket: string;
  private readonly privateBucket: string;
  private readonly publicUrl: string;
  private readonly maxSizeMb: number;
  private readonly imageQuality: number;
  private readonly thumbnailWidth: number;
  private readonly fullWidth: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    const storageConfig = this.configService.get('storage') as {
      endpoint: string;
      port: number;
      accessKey: string;
      secretKey: string;
      bucket: string;
      region: string;
      useSSL: boolean;
      publicUrl: string;
    };

    this.bucket = storageConfig?.bucket || 'closetrent-dev';
    this.privateBucket = `${this.bucket}-private`;
    this.publicUrl = storageConfig?.publicUrl || `http://localhost:9000/${this.bucket}`;

    try {
      const endpoint = new URL(storageConfig?.endpoint || 'http://localhost:9000');
      this.minioClient = new Minio.Client({
        endPoint: endpoint.hostname,
        port: storageConfig?.port || parseInt(endpoint.port || '9000'),
        useSSL: storageConfig?.useSSL || false,
        accessKey: storageConfig?.accessKey || 'minioadmin',
        secretKey: storageConfig?.secretKey || 'minioadmin',
        region: storageConfig?.region || 'us-east-1',
      });
    } catch (error) {
      this.logger.warn('MinIO client initialization failed — upload endpoints will return 503');
      this.minioClient = null as any;
    }

    const imageConfig = this.configService.get('image') as {
      maxSizeMb: number;
      quality: number;
      thumbnailWidth: number;
      thumbnailHeight: number;
      maxWidth: number;
    };
    this.maxSizeMb = imageConfig?.maxSizeMb || 10;
    this.imageQuality = imageConfig?.quality || 80;
    this.thumbnailWidth = imageConfig?.thumbnailWidth || 400;
    this.fullWidth = imageConfig?.maxWidth || 1200;
  }

  /**
   * Upload a product image: validate → WebP → full + thumbnail → MinIO → DB.
   */
  async uploadProductImage(
    tenantId: string,
    variantId: string,
    file: Express.Multer.File,
    isFeatured = false,
  ) {
    this.ensureMinioAvailable();
    this.validateFile(file);

    // Get variant + product info
    const variant = await this.prisma.productVariant.findFirst({
      where: { id: variantId, tenantId },
      select: { productId: true },
    });
    if (!variant) throw new NotFoundException('Variant not found');

    const hash = uuidv4().slice(0, 8);
    const basePath = `tenant-${tenantId}/products/${variant.productId}/${variantId}`;

    // Process images with Sharp
    const fullBuffer = await sharp(file.buffer)
      .resize(this.fullWidth, null, { withoutEnlargement: true })
      .webp({ quality: this.imageQuality })
      .toBuffer();

    const thumbBuffer = await sharp(file.buffer)
      .resize(this.thumbnailWidth, this.thumbnailWidth, {
        fit: 'cover',
        withoutEnlargement: true,
      })
      .webp({ quality: this.imageQuality })
      .toBuffer();

    // Upload to MinIO
    const fullKey = `${basePath}/full_${hash}.webp`;
    const thumbKey = `${basePath}/thumb_${hash}.webp`;

    await this.ensureBucket();
    try {
      await this.minioClient.putObject(this.bucket, fullKey, fullBuffer, fullBuffer.length, {
        'Content-Type': 'image/webp',
      });
      await this.minioClient.putObject(this.bucket, thumbKey, thumbBuffer, thumbBuffer.length, {
        'Content-Type': 'image/webp',
      });
    } catch (error) {
      await Promise.allSettled([
        this.minioClient.removeObject(this.bucket, fullKey),
        this.minioClient.removeObject(this.bucket, thumbKey),
      ]);
      throw error;
    }

    const url = `${this.publicUrl}/${fullKey}`;
    const thumbnailUrl = `${this.publicUrl}/${thumbKey}`;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const [maxSeq, imageCount] = await Promise.all([
          tx.productImage.aggregate({
            where: { variantId, tenantId },
            _max: { sequence: true },
          }),
          tx.productImage.count({ where: { variantId, tenantId } }),
        ]);
        const shouldBeFeatured = isFeatured || imageCount === 0;
        if (shouldBeFeatured) {
          await tx.productImage.updateMany({
            where: { variantId, tenantId, isFeatured: true },
            data: { isFeatured: false },
          });
        }
        return tx.productImage.create({
          data: {
            tenantId,
            variantId,
            url,
            thumbnailUrl,
            isFeatured: shouldBeFeatured,
            sequence: (maxSeq._max.sequence ?? -1) + 1,
            originalName: file.originalname,
            fileSize: fullBuffer.length,
          },
        });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      await Promise.allSettled([
        this.minioClient.removeObject(this.bucket, fullKey),
        this.minioClient.removeObject(this.bucket, thumbKey),
      ]);
      throw error;
    }
  }

  /**
   * Make a variant's persisted media match the complete client-side list.
   * Database deletion, sequence, and featured selection change together so
   * resumed onboarding and the product editor share identical semantics.
   */
  async syncImages(
    tenantId: string,
    variantId: string,
    imageIds: string[],
    featuredImageId: string,
  ) {
    const uniqueIds = [...new Set(imageIds)];
    if (uniqueIds.length !== imageIds.length) {
      throw new BadRequestException('An image can only appear once in the media list');
    }
    if (!uniqueIds.includes(featuredImageId)) {
      throw new BadRequestException('The featured image must belong to the media list');
    }

    const variant = await this.prisma.productVariant.findFirst({
      where: { id: variantId, tenantId },
      select: { id: true },
    });
    if (!variant) throw new NotFoundException('Variant not found');

    const ownedImages = await this.prisma.productImage.findMany({
      where: { tenantId, variantId },
      select: { id: true, url: true, thumbnailUrl: true },
    });
    const ownedIds = new Set(ownedImages.map((image) => image.id));
    if (uniqueIds.some((id) => !ownedIds.has(id))) {
      throw new BadRequestException('Every image must belong to this product variant');
    }

    const desiredIds = new Set(uniqueIds);
    const removedImages = ownedImages.filter((image) => !desiredIds.has(image.id));
    await this.prisma.$transaction([
      this.prisma.productImage.deleteMany({
        where: { tenantId, variantId, id: { notIn: uniqueIds } },
      }),
      ...uniqueIds.map((id, sequence) =>
        this.prisma.productImage.update({
          where: { id },
          data: { sequence, isFeatured: id === featuredImageId },
        }),
      ),
    ]);

    try {
      await Promise.allSettled(
        removedImages.flatMap((image) =>
          [this.extractKey(image.url), this.extractKey(image.thumbnailUrl)]
            .filter((key): key is string => Boolean(key))
            .map((key) => this.minioClient.removeObject(this.bucket, key)),
        ),
      );
    } catch (error) {
      this.logger.warn(`Failed to clean up synchronized product image objects: ${error}`);
    }

    return { message: 'Product images synchronized' };
  }

  /**
   * Upload store logo.
   */
  async uploadLogo(tenantId: string, file: Express.Multer.File) {
    this.ensureMinioAvailable();
    this.validateFile(file);

    const hash = uuidv4().slice(0, 8);
    const key = `tenant-${tenantId}/branding/logo_${hash}.webp`;

    const buffer = await sharp(file.buffer)
      .resize(400, 400, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .webp({ quality: 90 })
      .toBuffer();

    await this.ensureBucket();
    await this.minioClient.putObject(this.bucket, key, buffer, buffer.length, {
      'Content-Type': 'image/webp',
    });

    const logoUrl = `${this.publicUrl}/${key}`;

    // Persist the logo URL on the Tenant record
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { logoUrl },
    });

    return { logoUrl };
  }

  /**
   * Upload storefront banner.
   */
  async uploadBanner(tenantId: string, file: Express.Multer.File) {
    this.ensureMinioAvailable();
    this.validateFile(file);

    const hash = uuidv4().slice(0, 8);
    const key = `tenant-${tenantId}/branding/banner_${hash}.webp`;

    const buffer = await sharp(file.buffer)
      .resize(1920, 600, { fit: 'cover', withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();

    await this.ensureBucket();
    await this.minioClient.putObject(this.bucket, key, buffer, buffer.length, {
      'Content-Type': 'image/webp',
    });

    const bannerUrl = `${this.publicUrl}/${key}`;

    // Note: StoreSettings model will be created in P05 (Storefront).
    // For now, return the URL for the frontend to persist.

    return { bannerUrl };
  }

  /**
   * Upload damage report photos (up to 4 images).
   * Returns an array of public URLs for storage in DamageReport.photos.
   */
  async uploadDamagePhotos(
    tenantId: string,
    bookingItemId: string,
    files: Express.Multer.File[],
  ): Promise<{ urls: string[] }> {
    this.ensureMinioAvailable();

    if (files.length > 4) {
      throw new BadRequestException('Maximum 4 damage photos allowed');
    }

    await this.ensureBucket();
    const urls: string[] = [];

    for (const file of files) {
      this.validateFile(file);

      const hash = uuidv4().slice(0, 8);
      const key = `tenant-${tenantId}/damage/${bookingItemId}/dmg_${hash}.webp`;

      const buffer = await sharp(file.buffer)
        .resize(1200, null, { withoutEnlargement: true })
        .webp({ quality: this.imageQuality })
        .toBuffer();

      await this.minioClient.putObject(this.bucket, key, buffer, buffer.length, {
        'Content-Type': 'image/webp',
      });

      urls.push(`${this.publicUrl}/${key}`);
    }

    return { urls };
  }

  async uploadInventoryPhotos(
    tenantId: string,
    stockUnitId: string,
    files: Express.Multer.File[],
  ): Promise<{
    files: Array<{ url: string; objectKey: string; mimeType: string }>;
  }> {
    this.ensureMinioAvailable();
    if (!files.length) throw new BadRequestException('At least one inventory photo is required');
    if (files.length > 10) throw new BadRequestException('Maximum 10 inventory photos allowed');

    const unit = await this.prisma.stockUnit.findFirst({
      where: { id: stockUnitId, tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!unit) throw new NotFoundException('Stock unit not found');

    await this.ensurePrivateBucket();
    const uploaded: Array<{ url: string; objectKey: string; mimeType: string }> = [];
    for (const file of files) {
      this.validateFile(file);
      const hash = uuidv4().slice(0, 12);
      const key = `tenant-${tenantId}/inventory/${stockUnitId}/item_${hash}.webp`;
      const buffer = await sharp(file.buffer)
        .resize(1600, null, { withoutEnlargement: true })
        .webp({ quality: this.imageQuality })
        .toBuffer();
      await this.minioClient.putObject(this.privateBucket, key, buffer, buffer.length, {
        'Content-Type': 'image/webp',
      });
      uploaded.push({
        url: `private://${this.privateBucket}/${key}`,
        objectKey: key,
        mimeType: 'image/webp',
      });
    }
    return { files: uploaded };
  }

  async getInventoryMediaUrl(tenantId: string, objectKey: string) {
    this.ensureMinioAvailable();
    const requiredPrefix = `tenant-${tenantId}/inventory/`;
    if (!objectKey.startsWith(requiredPrefix) || objectKey.includes('..')) {
      throw new NotFoundException('Inventory media was not found');
    }
    await this.ensurePrivateBucket();
    const url = await this.minioClient.presignedGetObject(this.privateBucket, objectKey, 15 * 60);
    return { url, expiresInSeconds: 15 * 60 };
  }

  // =========================================================================
  // PRIVATE HELPERS
  // =========================================================================

  private validateFile(file: Express.Multer.File): void {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedMimes.includes(file.mimetype)) {
      throw new BadRequestException('Invalid file type. Allowed: JPEG, PNG, WebP');
    }

    const maxBytes = this.maxSizeMb * 1024 * 1024;
    if (file.size > maxBytes) {
      throw new BadRequestException(`File exceeds maximum size of ${this.maxSizeMb}MB`);
    }
  }

  private ensureMinioAvailable(): void {
    if (!this.minioClient) {
      throw new ServiceUnavailableException('Storage service is not available');
    }
  }

  private async ensureBucket(): Promise<void> {
    if (this.bucketReady) return;

    try {
      const exists = await this.minioClient.bucketExists(this.bucket);
      if (!exists) {
        await this.minioClient.makeBucket(this.bucket);
        this.logger.log(`Created bucket: ${this.bucket}`);
      }

      // Ensure bucket has a public read policy so images are accessible via browser
      await this.ensurePublicReadPolicy();
      this.bucketReady = true;
    } catch (err) {
      this.logger.warn(`Bucket check failed: ${err}`);
    }
  }

  private async ensurePrivateBucket(): Promise<void> {
    if (this.privateBucketReady) return;
    try {
      const exists = await this.minioClient.bucketExists(this.privateBucket);
      if (!exists) {
        await this.minioClient.makeBucket(this.privateBucket);
        this.logger.log(`Created private bucket: ${this.privateBucket}`);
      }
      this.privateBucketReady = true;
    } catch (error) {
      this.logger.error('Failed to initialize private inventory media bucket', error);
      throw new ServiceUnavailableException('Private storage service is not available');
    }
  }

  /**
   * Set a public read-only policy on the bucket.
   * Without this, MinIO returns 403 for all direct image URLs.
   */
  private async ensurePublicReadPolicy(): Promise<void> {
    try {
      const policy = {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: { AWS: ['*'] },
            Action: ['s3:GetObject'],
            Resource: [`arn:aws:s3:::${this.bucket}/*`],
          },
        ],
      };

      await this.minioClient.setBucketPolicy(this.bucket, JSON.stringify(policy));
      this.logger.log(`Public read policy set on bucket: ${this.bucket}`);
    } catch (err) {
      this.logger.warn(`Failed to set bucket policy: ${err}`);
    }
  }

  private extractKey(url: string): string | null {
    try {
      const baseUrl = this.publicUrl.endsWith('/') ? this.publicUrl : `${this.publicUrl}/`;
      if (url.startsWith(baseUrl)) {
        return url.slice(baseUrl.length);
      }
      return null;
    } catch {
      return null;
    }
  }
}
