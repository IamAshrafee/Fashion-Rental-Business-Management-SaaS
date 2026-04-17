import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

/**
 * M6 FIX: Automated overdue detection.
 *
 * Runs daily at midnight to find delivered bookings where any item's
 * endDate has passed. Transitions them to 'overdue' status automatically
 * instead of requiring manual intervention.
 */
@Injectable()
export class BookingSchedulerService {
  private readonly logger = new Logger(BookingSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async detectOverdueBookings() {
    this.logger.log('Running automated overdue detection...');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find all tenants with delivered bookings that have overdue items
    const overdueBookings = await this.prisma.booking.findMany({
      where: {
        status: 'delivered',
        deletedAt: null,
        items: {
          some: {
            endDate: { lt: today },
          },
        },
      },
      select: {
        id: true,
        tenantId: true,
        bookingNumber: true,
      },
    });

    if (overdueBookings.length === 0) {
      this.logger.log('No overdue bookings detected.');
      return { processed: 0 };
    }

    let transitioned = 0;

    for (const booking of overdueBookings) {
      try {
        await this.prisma.booking.update({
          where: { id: booking.id },
          data: { status: 'overdue' },
        });

        this.eventEmitter.emit('booking.overdue', {
          tenantId: booking.tenantId,
          bookingId: booking.id,
          bookingNumber: booking.bookingNumber,
        });

        transitioned++;
      } catch (error) {
        this.logger.error(
          `Failed to mark booking ${booking.bookingNumber} as overdue: ${error}`,
        );
      }
    }

    this.logger.log(
      `Overdue detection complete: ${transitioned}/${overdueBookings.length} bookings transitioned to overdue.`,
    );

    return { processed: transitioned, total: overdueBookings.length };
  }
}
