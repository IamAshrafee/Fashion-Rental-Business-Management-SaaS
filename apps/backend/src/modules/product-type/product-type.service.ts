import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProductTypeDto, UpdateProductTypeDto } from '../size-schema/dto/size-schema.dto';

@Injectable()
export class ProductTypeService {
  private readonly logger = new Logger(ProductTypeService.name);

  constructor(private readonly prisma: PrismaService) {}

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  async list(tenantId: string) {
    return this.prisma.productType.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
      include: {
        defaultSizeSchema: {
          select: { id: true, code: true, name: true, status: true },
        },
        _count: { select: { products: true } },
      },
    });
  }

  async getById(tenantId: string, id: string) {
    const pt = await this.prisma.productType.findFirst({
      where: { id, tenantId },
      include: {
        defaultSizeSchema: {
          include: {
            instances: { orderBy: { sortOrder: 'asc' } },
            sizeCharts: {
              include: { rows: { orderBy: { sortOrder: 'asc' } } },
            },
          },
        },
        _count: { select: { products: true } },
      },
    });
    if (!pt) throw new NotFoundException('Product type not found');
    return pt;
  }

  async create(tenantId: string, dto: CreateProductTypeDto) {
    const slug = this.generateSlug(dto.name);

    const exists = await this.prisma.productType.findUnique({
      where: { tenantId_slug: { tenantId, slug } },
    });
    if (exists) throw new ConflictException(`Product type "${dto.name}" already exists`);

    // Validate schema if provided
    if (dto.defaultSizeSchemaId) {
      const schema = await this.prisma.sizeSchema.findFirst({
        where: { id: dto.defaultSizeSchemaId, tenantId },
      });
      if (!schema) throw new NotFoundException('Default size schema not found');
    }

    return this.prisma.productType.create({
      data: {
        tenantId,
        name: dto.name,
        slug,
        description: dto.description || null,
        defaultSizeSchemaId: dto.defaultSizeSchemaId || null,
      },
      include: {
        defaultSizeSchema: {
          select: { id: true, code: true, name: true, status: true },
        },
      },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateProductTypeDto) {
    const pt = await this.prisma.productType.findFirst({
      where: { id, tenantId },
    });
    if (!pt) throw new NotFoundException('Product type not found');

    const data: Record<string, unknown> = {};

    if (dto.name !== undefined) {
      data.name = dto.name;
      data.slug = this.generateSlug(dto.name);
      // Check slug conflict
      const conflict = await this.prisma.productType.findFirst({
        where: {
          tenantId,
          slug: data.slug as string,
          id: { not: id },
        },
      });
      if (conflict) throw new ConflictException(`Product type name "${dto.name}" is taken`);
    }

    if (dto.defaultSizeSchemaId !== undefined) {
      if (dto.defaultSizeSchemaId) {
        const schema = await this.prisma.sizeSchema.findFirst({
          where: { id: dto.defaultSizeSchemaId, tenantId },
        });
        if (!schema) throw new NotFoundException('Size schema not found');
      }
      data.defaultSizeSchemaId = dto.defaultSizeSchemaId || null;
    }

    if (dto.description !== undefined) {
      data.description = dto.description;
    }

    return this.prisma.productType.update({
      where: { id },
      data,
      include: {
        defaultSizeSchema: {
          select: { id: true, code: true, name: true, status: true },
        },
      },
    });
  }

  async delete(tenantId: string, id: string) {
    const pt = await this.prisma.productType.findFirst({
      where: { id, tenantId },
      include: { _count: { select: { products: true } } },
    });
    if (!pt) throw new NotFoundException('Product type not found');
    if (pt._count.products > 0) {
      throw new BadRequestException(
        `Cannot delete — ${pt._count.products} product(s) use this type`,
      );
    }

    await this.prisma.productType.delete({ where: { id } });
    return { message: 'Product type deleted' };
  }
}
