/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ServiceUnavailableException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import * as Minio from 'minio';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';

interface UploadResult {
  url: string;
  thumbnailUrl: string;
  fileSize: number;
}

@Injectable()
export class UploadService implements OnModuleInit {
  private readonly logger = new Logger(UploadService.name);
  private bucketReady = false;
  private readonly minioClient: Minio.Client;
  private readonly bucket: string;
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
   * Called once when the module initializes.
   * Ensures bucket exists and has public read policy.
   */
  async onModuleInit(): Promise<void> {
    if (this.minioClient) {
      await this.ensureBucket();
    }
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
    await this.minioClient.putObject(this.bucket, fullKey, fullBuffer, fullBuffer.length, {
      'Content-Type': 'image/webp',
    });
    await this.minioClient.putObject(this.bucket, thumbKey, thumbBuffer, thumbBuffer.length, {
      'Content-Type': 'image/webp',
    });

    const url = `${this.publicUrl}/${fullKey}`;
    const thumbnailUrl = `${this.publicUrl}/${thumbKey}`;

    // Get next sequence
    const maxSeq = await this.prisma.productImage.aggregate({
      where: { variantId },
      _max: { sequence: true },
    });
    const sequence = (maxSeq._max.sequence ?? -1) + 1;

    // If this is the first image or marked as featured, handle featured logic
    if (isFeatured) {
      await this.prisma.productImage.updateMany({
        where: { variantId, isFeatured: true },
        data: { isFeatured: false },
      });
    }

    // Check if this is the first image for this variant
    const imageCount = await this.prisma.productImage.count({ where: { variantId } });
    const shouldBeFeatured = isFeatured || imageCount === 0;

    // Create DB record
    const image = await this.prisma.productImage.create({
      data: {
        tenantId,
        variantId,
        url,
        thumbnailUrl,
        isFeatured: shouldBeFeatured,
        sequence,
        originalName: file.originalname,
        fileSize: fullBuffer.length,
      },
    });

    return image;
  }

  /**
   * Bulk upload images.
   */
  async uploadProductImages(
    tenantId: string,
    variantId: string,
    files: Express.Multer.File[],
  ) {
    const results = [];
    for (const file of files) {
      const result = await this.uploadProductImage(tenantId, variantId, file, false);
      results.push(result);
    }
    return results;
  }

  /**
   * Delete a product image from MinIO and DB.
   */
  async deleteProductImage(tenantId: string, imageId: string) {
    const image = await this.prisma.productImage.findFirst({
      where: { id: imageId, tenantId },
    });
    if (!image) throw new NotFoundException('Image not found');

    // Remove from MinIO
    try {
      const fullKey = this.extractKey(image.url);
      const thumbKey = this.extractKey(image.thumbnailUrl);
      if (fullKey) await this.minioClient.removeObject(this.bucket, fullKey);
      if (thumbKey) await this.minioClient.removeObject(this.bucket, thumbKey);
    } catch (err) {
      this.logger.warn(`Failed to delete MinIO object: ${err}`);
    }

    // Delete DB record
    await this.prisma.productImage.delete({ where: { id: imageId } });

    // If deleted was featured, make the next image featured
    if (image.isFeatured) {
      const next = await this.prisma.productImage.findFirst({
        where: { variantId: image.variantId },
        orderBy: { sequence: 'asc' },
      });
      if (next) {
        await this.prisma.productImage.update({
          where: { id: next.id },
          data: { isFeatured: true },
        });
      }
    }

    return { message: 'Image deleted' };
  }

  /**
   * Reorder images within a variant.
   */
  async reorderImages(tenantId: string, variantId: string, imageIds: string[]) {
    const updates = imageIds.map((id, index) =>
      this.prisma.productImage.update({
        where: { id },
        data: { sequence: index },
      }),
    );

    await this.prisma.$transaction(updates);
    return { message: 'Images reordered' };
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
