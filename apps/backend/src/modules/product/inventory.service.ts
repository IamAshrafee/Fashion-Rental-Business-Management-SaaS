import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateDateBlockDto } from './dto/product.dto';

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Check product availability for a date range.
   */
  async checkAvailability(tenantId: string, productId: string, startDate: string, endDate: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, tenantId, deletedAt: null },
    });
    if (!product) throw new NotFoundException('Product not found');

    const start = new Date(startDate);
    const end = new Date(endDate);

    const conflicts = await this.prisma.dateBlock.findMany({
      where: {
        productId,
        tenantId,
        OR: [
          { startDate: { lte: end }, endDate: { gte: start } },
        ],
      },
      select: {
        startDate: true,
        endDate: true,
        blockType: true,
      },
    });

    return {
      productId,
      available: conflicts.length === 0,
      requestedRange: { start: startDate, end: endDate },
      conflicts: conflicts.map((c) => ({
        start: c.startDate.toISOString().split('T')[0],
        end: c.endDate.toISOString().split('T')[0],
        type: c.blockType,
      })),
    };
  }

  /**
   * Get availability calendar for N months.
   */
  async getCalendar(tenantId: string, productId: string, months = 3) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, tenantId, deletedAt: null },
    });
    if (!product) throw new NotFoundException('Product not found');

    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + months);

    // Get all date blocks in range
    const blocks = await this.prisma.dateBlock.findMany({
      where: {
        productId,
        tenantId,
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
      include: {
        booking: {
          select: { status: true },
        },
      },
    });

    // Generate day-by-day calendar
    const calendar: Array<{ date: string; status: string }> = [];
    const current = new Date(startDate);

    while (current <= endDate) {
      const dateStr = current.toISOString().split('T')[0];
      let status = 'available';

      for (const block of blocks) {
        const blockStart = new Date(block.startDate);
        const blockEnd = new Date(block.endDate);

        if (current >= blockStart && current <= blockEnd) {
          if (block.blockType === 'manual') {
            status = 'blocked';
          } else if (block.booking) {
            status = block.booking.status === 'pending' ? 'pending' : 'booked';
          } else {
            status = 'booked';
          }
          break;
        }
      }

      calendar.push({ date: dateStr, status });
      current.setDate(current.getDate() + 1);
    }

    return { productId, calendar };
  }

  /**
   * Block dates manually (owner action).
   */
  async blockDates(tenantId: string, productId: string, dto: CreateDateBlockDto) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, tenantId, deletedAt: null },
    });
    if (!product) throw new NotFoundException('Product not found');

    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);

    // Check for conflicts with existing bookings
    const conflicts = await this.prisma.dateBlock.findMany({
      where: {
        productId,
        tenantId,
        blockType: 'booking',
        startDate: { lte: end },
        endDate: { gte: start },
      },
    });

    if (conflicts.length > 0) {
      throw new ConflictException('Dates overlap with existing booking(s)');
    }

    return this.prisma.dateBlock.create({
      data: {
        tenantId,
        productId,
        startDate: start,
        endDate: end,
        blockType: 'manual',
        reason: dto.reason || null,
      },
    });
  }

  /**
   * Remove a manual date block.
   */
  async unblockDates(tenantId: string, productId: string, blockId: string) {
    const block = await this.prisma.dateBlock.findFirst({
      where: {
        id: blockId,
        productId,
        tenantId,
        blockType: 'manual',
      },
    });

    if (!block) throw new NotFoundException('Date block not found');

    await this.prisma.dateBlock.delete({ where: { id: blockId } });
    return { message: 'Date block removed' };
  }

  /**
   * List all date blocks for a product.
   */
  async listBlocks(tenantId: string, productId: string) {
    return this.prisma.dateBlock.findMany({
      where: { productId, tenantId },
      orderBy: { startDate: 'asc' },
      include: {
        booking: {
          select: {
            bookingNumber: true,
          },
        },
      },
    });
  }
}
