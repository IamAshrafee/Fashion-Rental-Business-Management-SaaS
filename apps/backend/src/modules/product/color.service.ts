import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ColorService {
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
