import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * System color palette — seeded once, available to all tenants.
 */
const SYSTEM_COLORS = [
  { name: 'White', hexCode: '#FFFFFF' },
  { name: 'Black', hexCode: '#000000' },
  { name: 'Red', hexCode: '#E53935' },
  { name: 'Dark Red', hexCode: '#8B0000' },
  { name: 'Pink', hexCode: '#EC407A' },
  { name: 'Hot Pink', hexCode: '#FF69B4' },
  { name: 'Orange', hexCode: '#FF7043' },
  { name: 'Peach', hexCode: '#FFCCBC' },
  { name: 'Yellow', hexCode: '#FDD835' },
  { name: 'Gold', hexCode: '#FFD700' },
  { name: 'Green', hexCode: '#43A047' },
  { name: 'Olive', hexCode: '#808000' },
  { name: 'Blue', hexCode: '#1E88E5' },
  { name: 'Navy', hexCode: '#000080' },
  { name: 'Sky Blue', hexCode: '#03A9F4' },
  { name: 'Teal', hexCode: '#008080' },
  { name: 'Purple', hexCode: '#8E24AA' },
  { name: 'Lavender', hexCode: '#E6E6FA' },
  { name: 'Brown', hexCode: '#6D4C41' },
  { name: 'Beige', hexCode: '#F5F5DC' },
  { name: 'Gray', hexCode: '#9E9E9E' },
  { name: 'Silver', hexCode: '#C0C0C0' },
  { name: 'Ivory', hexCode: '#FFFFF0' },
  { name: 'Cream', hexCode: '#FFFDD0' },
  { name: 'Maroon', hexCode: '#800000' },
  { name: 'Coral', hexCode: '#FF6F61' },
  { name: 'Magenta', hexCode: '#FF00FF' },
  { name: 'Turquoise', hexCode: '#40E0D0' },
];

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
    let created = 0;

    for (const color of SYSTEM_COLORS) {
      const existing = await this.prisma.color.findFirst({
        where: { name: color.name, isSystem: true },
      });

      if (!existing) {
        await this.prisma.color.create({
          data: {
            name: color.name,
            hexCode: color.hexCode,
            isSystem: true,
            tenantId: null,
          },
        });
        created++;
      }
    }

    if (created > 0) {
      this.logger.log(`Seeded ${created} system colors`);
    }

    return created;
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
