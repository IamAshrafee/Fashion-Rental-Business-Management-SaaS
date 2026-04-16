import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateSizeSchemaDto,
  UpdateSizeSchemaDto,
  CreateSizeChartDto,
} from './dto/size-schema.dto';

@Injectable()
export class SizeSchemaService {
  private readonly logger = new Logger(SizeSchemaService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Schema CRUD ────────────────────────────────────────────────────────────

  async listSchemas(tenantId: string, status?: string) {
    const where: Record<string, unknown> = { tenantId };
    if (status) where.status = status;

    return this.prisma.sizeSchema.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        instances: { orderBy: { sortOrder: 'asc' } },
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

    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.schemaType !== undefined) data.schemaType = dto.schemaType;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.definition !== undefined) data.definition = dto.definition as any;

    return this.prisma.sizeSchema.update({
      where: { id },
      data,
    });
  }

  async activateSchema(tenantId: string, id: string) {
    const schema = await this.prisma.sizeSchema.findFirst({
      where: { id, tenantId },
    });
    if (!schema) throw new NotFoundException('Size schema not found');

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

    await this.prisma.$transaction(async (tx) => {
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

  async listSizeCharts(tenantId: string, schemaId?: string) {
    const where: Record<string, unknown> = { tenantId };
    if (schemaId) where.sizeSchemaId = schemaId;

    return this.prisma.sizeChart.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        rows: { orderBy: { sortOrder: 'asc' } },
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
