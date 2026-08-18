import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { OperationalEventService } from './operational-event.service';

export interface CreateInitialBookingVersionInput {
  tenantId: string;
  bookingId: string;
  snapshot: Prisma.InputJsonValue;
  reason: string;
  actorUserId?: string | null;
  occurredAt?: Date;
}

@Injectable()
export class BookingVersionService {
  constructor(private readonly operationalEvents: OperationalEventService) {}

  async createInitial(tx: Prisma.TransactionClient, input: CreateInitialBookingVersionInput) {
    const existing = await tx.bookingVersion.findUnique({
      where: { bookingId_version: { bookingId: input.bookingId, version: 1 } },
    });
    if (existing) return existing;

    const version = await tx.bookingVersion.create({
      data: {
        tenantId: input.tenantId,
        bookingId: input.bookingId,
        version: 1,
        decision: 'PENDING',
        snapshot: input.snapshot,
        reason: input.reason.trim(),
        actorUserId: input.actorUserId ?? null,
      },
    });
    await this.operationalEvents.append(
      {
        tenantId: input.tenantId,
        bookingId: input.bookingId,
        category: 'BOOKING',
        eventType: 'BOOKING_CREATED',
        aggregateType: 'Booking',
        aggregateId: input.bookingId,
        actorUserId: input.actorUserId ?? null,
        reason: version.reason,
        metadata: { bookingVersionId: version.id, version: 1 },
        idempotencyKey: `booking-created:${input.bookingId}`,
        occurredAt: input.occurredAt,
      },
      tx,
    );
    return version;
  }
}
