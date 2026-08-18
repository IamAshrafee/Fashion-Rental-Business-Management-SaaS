import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class OperationsQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async listBookingEvents(tenantId: string, bookingId: string, limit = 100) {
    const boundedLimit = Math.min(200, Math.max(1, limit));
    return this.prisma.operationalEvent.findMany({
      where: { tenantId, bookingId },
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      take: boundedLimit,
      select: {
        id: true,
        category: true,
        eventType: true,
        aggregateType: true,
        aggregateId: true,
        reason: true,
        metadata: true,
        occurredAt: true,
        receivedAt: true,
        actor: { select: { id: true, fullName: true } },
      },
    });
  }
}
