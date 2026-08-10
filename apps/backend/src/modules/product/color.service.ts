import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SYSTEM_COLORS } from './system-colors';

@Injectable()
export class ColorService {
  private readonly logger = new Logger(ColorService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all available colors (system + tenant custom).
   */
  async listColors(tenantId?: string) {
    const where = tenantId
      ? { OR: [{ isSystem: true }, { tenantId }] }
      : { isSystem: true };

    return this.prisma.color.findMany({
      where,
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        hexCode: true,
        isSystem: true,
      },
    });
  }

  /**
   * Seed system colors if they don't exist.
   * Called on application startup or first color list request.
   */
  async seedSystemColors(): Promise<number> {
    for (const color of SYSTEM_COLORS) {
      await this.prisma.color.upsert({
        where: { systemKey: color.key },
        update: { name: color.name, hexCode: color.hexCode },
        create: {
          systemKey: color.key,
          name: color.name,
          hexCode: color.hexCode,
          isSystem: true,
          tenantId: null,
        },
      });
    }
    this.logger.log(`Synchronized ${SYSTEM_COLORS.length} system colors`);
    return SYSTEM_COLORS.length;
  }

  /**
   * Get a color by ID.
   */
  async findById(colorId: string) {
    return this.prisma.color.findUnique({
      where: { id: colorId },
      select: {
        id: true,
        name: true,
        hexCode: true,
        isSystem: true,
      },
    });
  }
}
