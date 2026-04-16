import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSizeInstanceDto } from '../size-schema/dto/size-schema.dto';

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

  async listBySchema(schemaId: string) {
    return this.prisma.sizeInstance.findMany({
      where: { sizeSchemaId: schemaId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async create(dto: CreateSizeInstanceDto) {
    // Verify schema exists
    const schema = await this.prisma.sizeSchema.findUnique({
      where: { id: dto.sizeSchemaId },
    });
    if (!schema) throw new NotFoundException('Size schema not found');

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

  async createBulk(schemaId: string, labels: string[]) {
    const schema = await this.prisma.sizeSchema.findUnique({
      where: { id: schemaId },
    });
    if (!schema) throw new NotFoundException('Size schema not found');

    const maxSort = await this.prisma.sizeInstance.aggregate({
      where: { sizeSchemaId: schemaId },
      _max: { sortOrder: true },
    });
    let nextSort = (maxSort._max.sortOrder ?? -1) + 1;

    const results = [];
    for (const label of labels) {
      const normalizedKey = this.normalizeKey(label);
      const existing = await this.prisma.sizeInstance.findUnique({
        where: {
          sizeSchemaId_normalizedKey: {
            sizeSchemaId: schemaId,
            normalizedKey,
          },
        },
      });

      if (existing) {
        results.push(existing); // Skip, return existing
        continue;
      }

      const instance = await this.prisma.sizeInstance.create({
        data: {
          sizeSchemaId: schemaId,
          normalizedKey,
          displayLabel: label,
          payload: {},
          sortOrder: nextSort++,
        },
      });
      results.push(instance);
    }

    return results;
  }

  async delete(id: string) {
    const instance = await this.prisma.sizeInstance.findUnique({
      where: { id },
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
}
