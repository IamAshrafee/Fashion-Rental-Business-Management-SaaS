import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSizeInstanceDto } from '../size-schema/dto/size-schema.dto';

const SIZE_INSTANCE_LIMIT = 500;

@Injectable()
export class SizeInstanceService {
  private readonly logger = new Logger(SizeInstanceService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generate a normalized key from the display label.
   * E.g. "US 9 / Wide" → "us_9_wide"
   */
  private normalizeKey(label: string): string {
    return label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  async listBySchema(tenantId: string, schemaId: string) {
    await this.findSchemaOrFail(tenantId, schemaId);
    return this.prisma.sizeInstance.findMany({
      where: { sizeSchemaId: schemaId },
      take: SIZE_INSTANCE_LIMIT,
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });
  }

  async create(tenantId: string, dto: CreateSizeInstanceDto) {
    await this.findSchemaOrFail(tenantId, dto.sizeSchemaId, true);

    const normalizedKey = this.normalizeKey(dto.displayLabel);

    // Dedup check
    const exists = await this.prisma.sizeInstance.findUnique({
      where: {
        sizeSchemaId_normalizedKey: {
          sizeSchemaId: dto.sizeSchemaId,
          normalizedKey,
        },
      },
    });
    if (exists) {
      throw new ConflictException(
        `Size "${dto.displayLabel}" already exists in this schema (key: ${normalizedKey})`,
      );
    }

    // Get next sort order
    const maxSort = await this.prisma.sizeInstance.aggregate({
      where: { sizeSchemaId: dto.sizeSchemaId },
      _max: { sortOrder: true },
    });

    return this.prisma.sizeInstance.create({
      data: {
        sizeSchemaId: dto.sizeSchemaId,
        normalizedKey,
        displayLabel: dto.displayLabel,
        payload: (dto.payload as any) ?? {},
        sortOrder: dto.sortOrder ?? ((maxSort._max.sortOrder ?? -1) + 1),
      },
    });
  }

  async createBulk(tenantId: string, schemaId: string, labels: string[]) {
    await this.findSchemaOrFail(tenantId, schemaId, true);
    const normalized = labels.map((label) => ({
      label: label.trim(),
      key: this.normalizeKey(label),
    }));
    if (normalized.some(({ key }) => !key)) {
      throw new BadRequestException('Every size label must contain letters or numbers');
    }
    if (new Set(normalized.map(({ key }) => key)).size !== normalized.length) {
      throw new BadRequestException('Bulk size labels must be unique after normalization');
    }

    return this.prisma.$transaction(async (tx) => {
      const maxSort = await tx.sizeInstance.aggregate({
        where: { sizeSchemaId: schemaId },
        _max: { sortOrder: true },
      });
      let nextSort = (maxSort._max.sortOrder ?? -1) + 1;
      const results = [];

      for (const { label, key } of normalized) {
        const existing = await tx.sizeInstance.findUnique({
          where: {
            sizeSchemaId_normalizedKey: { sizeSchemaId: schemaId, normalizedKey: key },
          },
        });
        if (existing) {
          results.push(existing);
          continue;
        }
        results.push(await tx.sizeInstance.create({
          data: {
            sizeSchemaId: schemaId,
            normalizedKey: key,
            displayLabel: label,
            payload: {},
            sortOrder: nextSort++,
          },
        }));
      }
      return results;
    });
  }

  async delete(tenantId: string, id: string) {
    const instance = await this.prisma.sizeInstance.findFirst({
      where: { id, sizeSchema: { tenantId } },
      include: { _count: { select: { variantSizes: true } } },
    });
    if (!instance) throw new NotFoundException('Size instance not found');
    if (instance._count.variantSizes > 0) {
      throw new BadRequestException(
        `Cannot delete — ${instance._count.variantSizes} variant(s) are using this size`,
      );
    }

    await this.prisma.sizeInstance.delete({ where: { id } });
    return { message: 'Size instance deleted' };
  }

  private async findSchemaOrFail(
    tenantId: string,
    schemaId: string,
    requireEditable = false,
  ) {
    const schema = await this.prisma.sizeSchema.findFirst({
      where: { id: schemaId, tenantId },
      select: { id: true, status: true },
    });
    if (!schema) throw new NotFoundException('Size schema not found');
    if (requireEditable && schema.status === 'deprecated') {
      throw new BadRequestException('Cannot add sizes to a deprecated schema');
    }
    return schema;
  }
}
