import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { InventoryReservationService } from '../inventory/inventory-reservation.service';

@Injectable()
export class InventoryHoldSchedulerService {
  private readonly logger = new Logger(InventoryHoldSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryReservations: InventoryReservationService,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async expirePendingInventoryHolds() {
    const tenants = await this.prisma.tenant.findMany({
      where: { status: 'active' },
      select: { id: true },
    });
    let processed = 0;
    for (const tenant of tenants) {
      processed += await this.prisma.$transaction((tx) =>
        this.inventoryReservations.expirePending(tx, tenant.id),
      );
    }
    if (processed > 0) {
      this.logger.log(`Expired ${processed} abandoned inventory hold(s).`);
    }
    return { processed };
  }
}
