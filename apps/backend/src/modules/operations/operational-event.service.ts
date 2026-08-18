import { Injectable } from '@nestjs/common';
import { OperationalEventCategory, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

type OperationalEventClient = Pick<Prisma.TransactionClient, 'operationalEvent'>;

export interface AppendOperationalEventInput {
  tenantId: string;
  bookingId: string;
  category: OperationalEventCategory;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  actorUserId?: string | null;
  reason?: string | null;
  metadata?: Prisma.InputJsonValue;
  idempotencyKey: string;
  occurredAt?: Date;
}

@Injectable()
export class OperationalEventService {
  constructor(private readonly prisma: PrismaService) {}

  async append(input: AppendOperationalEventInput, client: OperationalEventClient = this.prisma) {
    const existing = await client.operationalEvent.findUnique({
      where: {
        tenantId_idempotencyKey: {
          tenantId: input.tenantId,
          idempotencyKey: input.idempotencyKey,
        },
      },
    });
    if (existing) return existing;

    return client.operationalEvent.create({
      data: {
        tenantId: input.tenantId,
        bookingId: input.bookingId,
        category: input.category,
        eventType: input.eventType,
        aggregateType: input.aggregateType,
        aggregateId: input.aggregateId,
        actorUserId: input.actorUserId ?? null,
        reason: input.reason ?? null,
        metadata: input.metadata ?? Prisma.DbNull,
        idempotencyKey: input.idempotencyKey,
        occurredAt: input.occurredAt ?? new Date(),
      },
    });
  }
}
