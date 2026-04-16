import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateVariantDto, UpdateVariantDto, ReorderDto } from './dto/product.dto';

@Injectable()
export class VariantService {
  private readonly logger = new Logger(VariantService.name);

  constructor(private readonly prisma: PrismaService) {}

  async addVariant(tenantId: string, productId: string, dto: CreateVariantDto) {
    // Verify product belongs to tenant
    const product = await this.prisma.product.findFirst({
      where: { id: productId, tenantId, deletedAt: null },
    });
    if (!product) throw new NotFoundException('Product not found');

    // Get next sequence
    const maxSeq = await this.prisma.productVariant.aggregate({
      where: { productId },
      _max: { sequence: true },
    });
    const sequence = dto.sequence ?? ((maxSeq._max.sequence ?? -1) + 1);

    // Create variant
    const variant = await this.prisma.productVariant.create({
      data: {
        tenantId,
        productId,
        variantName: dto.variantName || null,
        mainColorId: dto.mainColorId,
        sequence,
        sizes: {
          create: dto.sizeInstanceIds 
            ? (await this.prisma.sizeInstance.findMany({
                where: { id: { in: dto.sizeInstanceIds } },
                select: { id: true }
              })).map(si => ({
                tenantId,
                sizeInstanceId: si.id,
                stockLevel: 1,
              }))
            : [],
        },
      },
      include: {
        mainColor: { select: { id: true, name: true, hexCode: true } },
        sizes: {
          include: { sizeInstance: true }
        }
      },
    });

    // Create identical color associations (always include main color)
    const colorIds = new Set(dto.identicalColorIds || []);
    colorIds.add(dto.mainColorId); // Auto-include main color

    await this.prisma.variantColor.createMany({
      data: Array.from(colorIds).map((colorId) => ({
        variantId: variant.id,
        colorId,
      })),
    });

    return variant;
  }

  async updateVariant(
    tenantId: string,
    productId: string,
    variantId: string,
    dto: UpdateVariantDto,
  ) {
    const variant = await this.prisma.productVariant.findFirst({
      where: { id: variantId, productId, tenantId },
    });
    if (!variant) throw new NotFoundException('Variant not found');

    const data: Record<string, unknown> = {};
    if (dto.variantName !== undefined) data.variantName = dto.variantName;
    if (dto.mainColorId !== undefined) data.mainColorId = dto.mainColorId;
    if (dto.sequence !== undefined) data.sequence = dto.sequence;

    const updated = await this.prisma.productVariant.update({
      where: { id: variantId },
      data,
      include: {
        mainColor: { select: { id: true, name: true, hexCode: true } },
      },
    });

    // Update sizes if provided
    if (dto.sizeInstanceIds !== undefined) {
      await this.prisma.variantSize.deleteMany({ where: { variantId } });
      const validIds = dto.sizeInstanceIds.filter((id) => id && id.length > 5);
      
      if (validIds.length > 0) {
        // Double check against DB to prevent foreign key violations from cached 'ghost' IDs
        const existingSizes = await this.prisma.sizeInstance.findMany({
          where: { id: { in: validIds } },
          select: { id: true }
        });
        
        if (existingSizes.length > 0) {
          await this.prisma.variantSize.createMany({
            data: existingSizes.map((si) => ({
              tenantId,
              variantId,
              sizeInstanceId: si.id,
              stockLevel: 1,
            }))
          });
        }
      }
    }

    // Update identical colors if provided
    if (dto.identicalColorIds !== undefined) {
      await this.prisma.variantColor.deleteMany({ where: { variantId } });

      const colorIds = new Set(dto.identicalColorIds);
      colorIds.add(dto.mainColorId || variant.mainColorId);

      await this.prisma.variantColor.createMany({
        data: Array.from(colorIds).map((colorId) => ({
          variantId,
          colorId,
        })),
      });
    }

    return updated;
  }

  async deleteVariant(tenantId: string, productId: string, variantId: string) {
    const variant = await this.prisma.productVariant.findFirst({
      where: { id: variantId, productId, tenantId },
    });
    if (!variant) throw new NotFoundException('Variant not found');

    // Cascade handled by DB (onDelete: Cascade in schema)
    await this.prisma.productVariant.delete({ where: { id: variantId } });
    return { message: 'Variant deleted' };
  }

  async reorderVariants(tenantId: string, productId: string, dto: ReorderDto) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, tenantId, deletedAt: null },
    });
    if (!product) throw new NotFoundException('Product not found');

    const updates = dto.ids.map((id, index) =>
      this.prisma.productVariant.update({
        where: { id },
        data: { sequence: index },
      }),
    );

    await this.prisma.$transaction(updates);
    return { message: 'Variants reordered' };
  }
}
