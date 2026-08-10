import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, SizeSchemaStatus } from '@prisma/client';
import {
  CreateSizeSchemaDto,
  UpdateSizeSchemaDto,
  CreateSizeChartDto,
  UpdateSizeChartDto,
} from './dto/size-schema.dto';

const CATALOG_REFERENCE_LIMIT = 500;

@Injectable()
export class SizeSchemaService {
  private readonly logger = new Logger(SizeSchemaService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Schema CRUD ────────────────────────────────────────────────────────────

  async listSchemas(tenantId: string, status?: SizeSchemaStatus) {
    const where: Record<string, unknown> = { tenantId };
    if (status) where.status = status;

    return this.prisma.sizeSchema.findMany({
      where,
      take: CATALOG_REFERENCE_LIMIT,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      include: {
        instances: {
          take: CATALOG_REFERENCE_LIMIT,
          orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        },
        _count: { select: { instances: true, productTypes: true } },
      },
    });
  }

  async getSchema(tenantId: string, id: string) {
    const schema = await this.prisma.sizeSchema.findFirst({
      where: { id, tenantId },
      include: {
        instances: { orderBy: { sortOrder: 'asc' } },
        sizeCharts: {
          include: {
            rows: { orderBy: { sortOrder: 'asc' } },
          },
        },
        _count: { select: { productTypes: true, productSchemaOverrides: true } },
      },
    });
    if (!schema) throw new NotFoundException('Size schema not found');
    return schema;
  }

  async createSchema(tenantId: string, dto: CreateSizeSchemaDto) {
    const code = dto.code.toUpperCase().replace(/[^A-Z0-9_]/g, '_');

    const exists = await this.prisma.sizeSchema.findUnique({
      where: { tenantId_code: { tenantId, code } },
    });
    if (exists) throw new ConflictException(`Schema code "${code}" already exists`);

    return this.prisma.$transaction(async (tx) => {
      const schema = await tx.sizeSchema.create({
        data: {
          tenantId,
          code,
          name: dto.name,
          description: dto.description || null,
          schemaType: (dto.schemaType as any) || 'STANDARD',
          status: 'draft',
          definition: (dto.definition as any) ?? {},
        },
      });

      if (dto.instances?.length) {
        await tx.sizeInstance.createMany({
          data: dto.instances.map((inst, idx) => ({
            sizeSchemaId: schema.id,
            normalizedKey: inst.displayLabel.toLowerCase().replace(/[^a-z0-9]/g, '_'),
            displayLabel: inst.displayLabel,
            sortOrder: inst.sortOrder ?? idx,
            payload: {},
          })),
        });
      }

      return schema;
    });
  }

  async updateSchema(tenantId: string, id: string, dto: UpdateSizeSchemaDto) {
    const schema = await this.prisma.sizeSchema.findFirst({
      where: { id, tenantId },
    });
    if (!schema) throw new NotFoundException('Size schema not found');
    if (schema.status === 'deprecated') {
      throw new BadRequestException('Cannot edit a deprecated schema');
    }
    const changesStructure =
      (dto.schemaType !== undefined && dto.schemaType !== schema.schemaType) ||
      (dto.definition !== undefined &&
        JSON.stringify(dto.definition) !== JSON.stringify(schema.definition));
    if (changesStructure) {
      const configuredSkus = await this.prisma.variantSize.count({
        where: { sizeInstance: { sizeSchemaId: id } },
      });
      if (configuredSkus > 0) {
        throw new BadRequestException(
          'Create a new size schema to change structure after products have configured SKUs.',
        );
      }
    }

    const data: Record<string, unknown> = {};
    if (dto.code !== undefined && dto.code !== schema.code) {
      const newCode = dto.code.toUpperCase().replace(/[^A-Z0-9_]/g, '_');
      if (newCode !== schema.code) {
        const exists = await this.prisma.sizeSchema.findUnique({
          where: { tenantId_code: { tenantId, code: newCode } },
        });
        if (exists) throw new ConflictException(`Schema code "${newCode}" already exists`);
        data.code = newCode;
      }
    }
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.schemaType !== undefined) data.schemaType = dto.schemaType;
    if (dto.definition !== undefined) data.definition = dto.definition as any;

    return this.prisma.sizeSchema.update({
      where: { id },
      data,
    });
  }

  async activateSchema(tenantId: string, id: string) {
    const schema = await this.prisma.sizeSchema.findFirst({
      where: { id, tenantId },
      include: { _count: { select: { instances: true } } },
    });
    if (!schema) throw new NotFoundException('Size schema not found');
    if (schema._count.instances === 0) {
      throw new BadRequestException('Add at least one size before activating this schema');
    }

    return this.prisma.sizeSchema.update({
      where: { id },
      data: { status: 'active' },
    });
  }

  async deprecateSchema(tenantId: string, id: string) {
    const schema = await this.prisma.sizeSchema.findFirst({
      where: { id, tenantId },
    });
    if (!schema) throw new NotFoundException('Size schema not found');
    const publishedProducts = await this.prisma.product.count({
      where: {
        tenantId,
        status: 'published',
        deletedAt: null,
        OR: [
          { sizeSchemaOverrideId: id },
          {
            sizeSchemaOverrideId: null,
            productType: { defaultSizeSchemaId: id },
          },
        ],
      },
    });
    if (publishedProducts > 0) {
      throw new BadRequestException(
        `Unpublish or move ${publishedProducts} published product(s) before deprecating this schema.`,
      );
    }

    return this.prisma.sizeSchema.update({
      where: { id },
      data: { status: 'deprecated' },
    });
  }

  async deleteSchema(tenantId: string, id: string) {
    const schema = await this.prisma.sizeSchema.findFirst({
      where: { id, tenantId },
      include: { _count: { select: { instances: true, productTypes: true, productSchemaOverrides: true } } },
    });
    if (!schema) throw new NotFoundException('Size schema not found');
    if (schema._count.productTypes > 0 || schema._count.productSchemaOverrides > 0) {
      throw new BadRequestException(
        'Cannot delete schema — it is still referenced by product types or products',
      );
    }
    const variantSizeCount = await this.prisma.variantSize.count({
      where: { sizeInstance: { sizeSchemaId: id } },
    });
    if (variantSizeCount > 0) {
      throw new BadRequestException(
        `Cannot delete schema — ${variantSizeCount} product SKU(s) use its sizes`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.sizeChart.deleteMany({ where: { sizeSchemaId: id, tenantId } });
      await tx.sizeInstance.deleteMany({ where: { sizeSchemaId: id } });
      await tx.sizeSchema.delete({ where: { id } });
    });

    return { message: 'Schema deleted' };
  }

  // ─── Size Chart CRUD ────────────────────────────────────────────────────────

  async createSizeChart(tenantId: string, dto: CreateSizeChartDto) {
    const schema = await this.prisma.sizeSchema.findFirst({
      where: { id: dto.sizeSchemaId, tenantId },
    });
    if (!schema) throw new NotFoundException('Size schema not found');
    if (dto.productId) {
      const product = await this.prisma.product.findFirst({
        where: { id: dto.productId, tenantId, deletedAt: null },
        select: {
          sizeSchemaOverrideId: true,
          productType: { select: { defaultSizeSchemaId: true } },
        },
      });
      if (!product) throw new NotFoundException('Product not found');
      const resolvedSchemaId =
        product.sizeSchemaOverrideId ?? product.productType?.defaultSizeSchemaId ?? null;
      if (resolvedSchemaId !== dto.sizeSchemaId) {
        throw new BadRequestException(
          'A product-specific size chart must use the product’s resolved size schema.',
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const chart = await tx.sizeChart.create({
        data: {
          tenantId,
          sizeSchemaId: dto.sizeSchemaId,
          productId: dto.productId ?? null,
          title: dto.title || 'Size Guide',
          chartMeta: (dto.chartMeta as any) ?? {},
        },
      });

      if (dto.rows?.length) {
        await tx.sizeChartRow.createMany({
          data: dto.rows.map((row, idx) => ({
            sizeChartId: chart.id,
            sizeLabel: row.sizeLabel,
            measurements: row.measurements as any,
            sortOrder: row.sortOrder ?? idx,
          })),
        });
      }

      return chart;
    });
  }

  async getSizeChart(tenantId: string, chartId: string) {
    const chart = await this.prisma.sizeChart.findFirst({
      where: { id: chartId, tenantId },
      include: {
        rows: { orderBy: { sortOrder: 'asc' } },
        sizeSchema: { select: { id: true, code: true, name: true } },
      },
    });
    if (!chart) throw new NotFoundException('Size chart not found');
    return chart;
  }

  async updateSizeChart(tenantId: string, chartId: string, dto: UpdateSizeChartDto) {
    return this.prisma.$transaction(async (tx) => {
      const chart = await tx.sizeChart.findFirst({
        where: { id: chartId, tenantId },
        select: { id: true },
      });
      if (!chart) throw new NotFoundException('Size chart not found');

      if (dto.rows !== undefined) {
        await tx.sizeChartRow.deleteMany({ where: { sizeChartId: chartId } });
        if (dto.rows.length > 0) {
          await tx.sizeChartRow.createMany({
            data: dto.rows.map((row, index) => ({
              sizeChartId: chartId,
              sizeLabel: row.sizeLabel,
              measurements: row.measurements as Prisma.InputJsonValue,
              sortOrder: row.sortOrder ?? index,
            })),
          });
        }
      }

      return tx.sizeChart.update({
        where: { id: chartId },
        data: {
          ...(dto.title !== undefined ? { title: dto.title } : {}),
          ...(dto.chartMeta !== undefined
            ? { chartMeta: dto.chartMeta as Prisma.InputJsonValue }
            : {}),
        },
        include: { rows: { orderBy: { sortOrder: 'asc' } } },
      });
    });
  }

  async listSizeCharts(tenantId: string, schemaId?: string) {
    const where: Record<string, unknown> = { tenantId };
    if (schemaId) where.sizeSchemaId = schemaId;

    return this.prisma.sizeChart.findMany({
      where,
      take: CATALOG_REFERENCE_LIMIT,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      include: {
        rows: {
          take: CATALOG_REFERENCE_LIMIT,
          orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        },
        sizeSchema: { select: { id: true, code: true, name: true } },
      },
    });
  }

  async deleteSizeChart(tenantId: string, chartId: string) {
    const chart = await this.prisma.sizeChart.findFirst({
      where: { id: chartId, tenantId },
    });
    if (!chart) throw new NotFoundException('Size chart not found');

    await this.prisma.sizeChart.delete({ where: { id: chartId } });
    return { message: 'Size chart deleted' };
  }
}
