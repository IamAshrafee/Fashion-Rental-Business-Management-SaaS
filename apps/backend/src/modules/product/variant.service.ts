import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InventoryTrackingMode, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateVariantDto,
  ReorderDto,
  UpdateVariantDto,
  VariantSizeInventoryDto,
} from './dto/product.dto';

@Injectable()
export class VariantService {
  constructor(private readonly prisma: PrismaService) {}

  async addVariant(tenantId: string, productId: string, dto: CreateVariantDto) {
    return this.prisma.$transaction(async (tx) => {
      const sizes = this.normalizeSizes(dto.sizes);
      const product = await this.validateReferences(
        tx,
        tenantId,
        productId,
        sizes.map((size) => size.sizeInstanceId),
        [dto.mainColorId, ...(dto.identicalColorIds ?? [])],
      );
      if (product.status === 'published') {
        throw new ConflictException({
          code: 'PUBLISHED_CATALOG_STRUCTURE_LOCKED',
          section: 'variants',
          message: 'Unpublish this product before adding a variant.',
        });
      }

      const maxSeq = await tx.productVariant.aggregate({
        where: { productId, tenantId },
        _max: { sequence: true },
      });
      const sequence = dto.sequence ?? (maxSeq._max.sequence ?? -1) + 1;

      const variant = await tx.productVariant.create({
        data: {
          tenantId,
          productId,
          variantName: dto.variantName?.trim() || null,
          mainColorId: dto.mainColorId,
          sequence,
          sizes: {
            create: sizes.map((size) => ({
              tenantId,
              sizeInstanceId: size.sizeInstanceId,
              trackingMode: size.trackingMode,
            })),
          },
        },
      });

      const colorIds = new Set(dto.identicalColorIds ?? []);
      colorIds.add(dto.mainColorId);
      await tx.variantColor.createMany({
        data: [...colorIds].map((colorId) => ({ variantId: variant.id, colorId })),
      });

      return this.getVariant(tx, variant.id);
    });
  }

  async updateVariant(
    tenantId: string,
    productId: string,
    variantId: string,
    dto: UpdateVariantDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const variant = await tx.productVariant.findFirst({
        where: { id: variantId, productId, tenantId },
        include: { sizes: true },
      });
      if (!variant) throw new NotFoundException('Variant not found');

      const sizesProvided = dto.sizes !== undefined;
      const sizes = sizesProvided
        ? this.normalizeSizes(dto.sizes)
        : variant.sizes.map((size) => ({
            sizeInstanceId: size.sizeInstanceId,
            trackingMode: size.trackingMode,
          }));
      const mainColorId = dto.mainColorId ?? variant.mainColorId;

      const product = await this.validateReferences(
        tx,
        tenantId,
        productId,
        sizes.map((size) => size.sizeInstanceId),
        [mainColorId, ...(dto.identicalColorIds ?? [])],
      );

      const sizeConfigurationChanged = sizesProvided && !this.sameSizeConfiguration(
        variant.sizes,
        sizes,
      );
      if (product.status === 'published' && sizeConfigurationChanged) {
        throw new ConflictException({
          code: 'PUBLISHED_CATALOG_STRUCTURE_LOCKED',
          section: 'variants',
          message: 'Unpublish this product before changing its rentable SKUs.',
        });
      }

      await tx.productVariant.update({
        where: { id: variantId },
        data: {
          ...(dto.variantName !== undefined
            ? { variantName: dto.variantName.trim() || null }
            : {}),
          ...(dto.mainColorId !== undefined ? { mainColorId: dto.mainColorId } : {}),
          ...(dto.sequence !== undefined ? { sequence: dto.sequence } : {}),
        },
      });

      if (sizesProvided) {
        await this.reconcileSizes(tx, tenantId, variantId, variant.sizes, sizes, dto.sizes !== undefined);
      }

      if (dto.identicalColorIds !== undefined || dto.mainColorId !== undefined) {
        await tx.variantColor.deleteMany({ where: { variantId } });
        const colorIds = new Set(dto.identicalColorIds ?? []);
        colorIds.add(mainColorId);
        await tx.variantColor.createMany({
          data: [...colorIds].map((colorId) => ({ variantId, colorId })),
        });
      }

      return this.getVariant(tx, variantId);
    });
  }

  async deleteVariant(tenantId: string, productId: string, variantId: string) {
    const variant = await this.prisma.productVariant.findFirst({
      where: { id: variantId, productId, tenantId },
      select: {
        id: true,
        product: { select: { status: true } },
        sizes: { select: { id: true } },
      },
    });
    if (!variant) throw new NotFoundException('Variant not found');
    if (variant.product.status === 'published') {
      throw new ConflictException({
        code: 'PUBLISHED_CATALOG_STRUCTURE_LOCKED',
        section: 'variants',
        message: 'Unpublish this product before deleting a variant.',
      });
    }
    const bookingItems = await this.prisma.bookingItem.count({ where: { tenantId, variantId } });
    if (bookingItems > 0) {
      throw new ConflictException({
        code: 'SKU_HISTORY_CONFLICT',
        section: 'variants',
        message: 'This variant has rental history and cannot be deleted.',
      });
    }
    for (const size of variant.sizes) {
      await this.assertVariantSizeMutable(this.prisma, tenantId, size.id, 'deleted');
    }

    await this.prisma.productVariant.delete({ where: { id: variantId } });
    return { message: 'Variant deleted' };
  }

  async reorderVariants(tenantId: string, productId: string, dto: ReorderDto) {
    const variants = await this.prisma.productVariant.findMany({
      where: { tenantId, productId, id: { in: dto.ids } },
      select: { id: true },
    });
    if (variants.length !== new Set(dto.ids).size) {
      throw new BadRequestException('Every reordered variant must belong to this product');
    }

    await this.prisma.$transaction(
      dto.ids.map((id, sequence) =>
        this.prisma.productVariant.update({ where: { id }, data: { sequence } }),
      ),
    );
    return { message: 'Variants reordered' };
  }

  private normalizeSizes(
    configured: VariantSizeInventoryDto[] | undefined,
  ): Array<{
    sizeInstanceId: string;
    trackingMode: InventoryTrackingMode;
  }> {
    const values = configured ?? [];
    const unique = new Set<string>();

    return values.map((size) => {
      if (unique.has(size.sizeInstanceId)) {
        throw new BadRequestException('A size can only appear once in a variant');
      }
      unique.add(size.sizeInstanceId);
      return {
        sizeInstanceId: size.sizeInstanceId,
        trackingMode: size.trackingMode ?? InventoryTrackingMode.POOLED,
      };
    });
  }

  private async validateReferences(
    tx: Prisma.TransactionClient,
    tenantId: string,
    productId: string,
    sizeInstanceIds: string[],
    colorIds: string[],
  ) {
    const product = await tx.product.findFirst({
      where: { id: productId, tenantId, deletedAt: null },
      select: {
        status: true,
        sizeSchemaOverrideId: true,
        productType: { select: { defaultSizeSchemaId: true } },
      },
    });
    if (!product) throw new NotFoundException('Product not found');

    const uniqueColorIds = [...new Set(colorIds)];
    const colors = await tx.color.count({
      where: {
        id: { in: uniqueColorIds },
        OR: [{ tenantId: null }, { tenantId }],
      },
    });
    if (colors !== uniqueColorIds.length) {
      throw new BadRequestException('One or more selected colors do not belong to this store');
    }

    if (sizeInstanceIds.length === 0) return product;
    const activeSchemaId = product.sizeSchemaOverrideId ?? product.productType?.defaultSizeSchemaId;
    if (!activeSchemaId) {
      throw new BadRequestException('Configure a size schema before adding variant sizes');
    }

    const sizes = await tx.sizeInstance.count({
      where: {
        id: { in: [...new Set(sizeInstanceIds)] },
        sizeSchemaId: activeSchemaId,
        sizeSchema: { tenantId },
      },
    });
    if (sizes !== new Set(sizeInstanceIds).size) {
      throw new BadRequestException('One or more sizes do not belong to the product size schema');
    }
    return product;
  }

  private async reconcileSizes(
    tx: Prisma.TransactionClient,
    tenantId: string,
    variantId: string,
    existing: Array<{
      id: string;
      sizeInstanceId: string;
      trackingMode: InventoryTrackingMode;
    }>,
    desired: Array<{
      sizeInstanceId: string;
      trackingMode: InventoryTrackingMode;
    }>,
    configurationProvided: boolean,
  ): Promise<void> {
    const desiredIds = new Set(desired.map((size) => size.sizeInstanceId));
    const removed = existing.filter((size) => !desiredIds.has(size.sizeInstanceId));

    for (const size of removed) {
      await this.assertVariantSizeMutable(tx, tenantId, size.id, 'removed');
      await tx.variantSize.delete({ where: { id: size.id } });
    }

    for (const desiredSize of desired) {
      const current = existing.find((size) => size.sizeInstanceId === desiredSize.sizeInstanceId);
      if (!current) {
        await tx.variantSize.create({
          data: {
            tenantId,
            variantId,
            sizeInstanceId: desiredSize.sizeInstanceId,
            trackingMode: desiredSize.trackingMode,
          },
        });
        continue;
      }

      if (!configurationProvided) continue;
      if (current.trackingMode !== desiredSize.trackingMode) {
        await this.assertVariantSizeMutable(tx, tenantId, current.id, 'changed to another tracking mode');
      }

      await tx.variantSize.update({
        where: { id: current.id },
        data: {
          trackingMode: desiredSize.trackingMode,
          inventoryVersion: { increment: 1 },
        },
      });
    }
  }

  private sameSizeConfiguration(
    current: Array<{ sizeInstanceId: string; trackingMode: InventoryTrackingMode }>,
    desired: Array<{ sizeInstanceId: string; trackingMode: InventoryTrackingMode }>,
  ): boolean {
    if (current.length !== desired.length) return false;
    const desiredBySize = new Map(desired.map((size) => [size.sizeInstanceId, size.trackingMode]));
    return current.every(
      (size) => desiredBySize.get(size.sizeInstanceId) === size.trackingMode,
    );
  }

  private async assertVariantSizeMutable(
    tx: Prisma.TransactionClient | PrismaService,
    tenantId: string,
    variantSizeId: string,
    action: string,
  ): Promise<void> {
    const dependencyCounts = await Promise.all([
      tx.stockUnit.count({ where: { tenantId, variantSizeId } }),
      tx.inventoryPool.count({ where: { tenantId, variantSizeId } }),
      tx.inventoryReservation.count({ where: { tenantId, variantSizeId } }),
      tx.bookingItem.count({ where: { tenantId, variantSizeId } }),
      tx.fulfillmentRequirement.count({ where: { tenantId, variantSizeId } }),
      tx.inventoryMovement.count({ where: { tenantId, variantSizeId } }),
      tx.inventoryBlock.count({ where: { tenantId, variantSizeId } }),
      tx.inventoryTransferLine.count({ where: { tenantId, variantSizeId } }),
      tx.skuSetComponentDefinition.count({ where: { tenantId, variantSizeId } }),
      tx.availabilityPolicy.count({ where: { tenantId, variantSizeId } }),
      tx.productCompositionRule.count({ where: { tenantId, fixedVariantSizeId: variantSizeId } }),
      tx.productCompositionAlternative.count({ where: { tenantId, variantSizeId } }),
    ]);
    if (dependencyCounts.some((count) => count > 0)) {
      throw new ConflictException({
        code: 'SKU_HISTORY_CONFLICT',
        section: 'variants',
        variantSizeId,
        message: `This SKU has inventory, rental, composition, or policy history and cannot be ${action}.`,
      });
    }
  }

  private getVariant(tx: Prisma.TransactionClient, variantId: string) {
    return tx.productVariant.findUniqueOrThrow({
      where: { id: variantId },
      include: {
        mainColor: { select: { id: true, name: true, hexCode: true } },
        identicalColors: { include: { color: true } },
        sizes: { include: { sizeInstance: true }, orderBy: { sizeInstance: { sortOrder: 'asc' } } },
      },
    });
  }
}
