import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CustodyEventReason, Prisma, StockUnitCustodyType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { custodyRequiresLocation } from './domain/transition-rules';

interface InitializeCustodyInput {
  tenantId: string;
  stockUnitId: string;
  locationId: string;
  actorUserId?: string | null;
  idempotencyKey: string;
  occurredAt?: Date;
  evidence?: Prisma.InputJsonValue;
}

interface TransitionCustodyInput {
  tenantId: string;
  stockUnitId: string;
  expectedVersion: number;
  toCustodyType: StockUnitCustodyType;
  toLocationId?: string | null;
  toCustodianRef?: string | null;
  reason: CustodyEventReason;
  actorUserId?: string | null;
  fulfillmentId?: string | null;
  handoverId?: string | null;
  idempotencyKey: string;
  occurredAt?: Date;
  evidence?: Prisma.InputJsonValue;
}

@Injectable()
export class StockUnitCustodyService {
  constructor(private readonly prisma: PrismaService) {}

  transition(input: TransitionCustodyInput) {
    return this.prisma.$transaction((tx) => this.transitionInTransaction(tx, input), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  }

  async initializeBusinessLocation(tx: Prisma.TransactionClient, input: InitializeCustodyInput) {
    const existing = await tx.stockUnitCustody.findUnique({
      where: { stockUnitId: input.stockUnitId },
    });
    if (existing) {
      if (
        existing.tenantId !== input.tenantId ||
        existing.custodyType !== 'BUSINESS_LOCATION' ||
        existing.locationId !== input.locationId
      ) {
        throw new ConflictException({
          code: 'CUSTODY_ALREADY_INITIALIZED',
          message: 'This physical item already has a different custody record',
        });
      }
      return { custody: existing, idempotent: true };
    }

    const occurredAt = input.occurredAt ?? new Date();
    const custody = await tx.stockUnitCustody.create({
      data: {
        tenantId: input.tenantId,
        stockUnitId: input.stockUnitId,
        custodyType: 'BUSINESS_LOCATION',
        locationId: input.locationId,
        custodianRef: input.locationId,
        evidence: input.evidence ?? Prisma.DbNull,
        lastConfirmedAt: occurredAt,
      },
    });
    const event = await tx.custodyEvent.create({
      data: {
        tenantId: input.tenantId,
        stockUnitId: input.stockUnitId,
        fromCustodyType: 'UNKNOWN',
        toCustodyType: 'BUSINESS_LOCATION',
        toLocationId: input.locationId,
        toCustodianRef: input.locationId,
        reason: 'REGISTERED',
        actorUserId: input.actorUserId ?? null,
        idempotencyKey: input.idempotencyKey,
        evidence: input.evidence ?? Prisma.DbNull,
        occurredAt,
      },
    });
    return { custody, event, idempotent: false };
  }

  async transitionInTransaction(tx: Prisma.TransactionClient, input: TransitionCustodyInput) {
    const existingEvent = await tx.custodyEvent.findUnique({
      where: {
        tenantId_idempotencyKey: {
          tenantId: input.tenantId,
          idempotencyKey: input.idempotencyKey,
        },
      },
    });
    if (existingEvent) {
      if (
        existingEvent.stockUnitId !== input.stockUnitId ||
        existingEvent.toCustodyType !== input.toCustodyType ||
        existingEvent.toLocationId !== (input.toLocationId ?? null)
      ) {
        throw new ConflictException({
          code: 'IDEMPOTENCY_KEY_REUSED',
          message: 'This custody command key was already used with different details',
        });
      }
      const custody = await tx.stockUnitCustody.findUnique({
        where: { stockUnitId: input.stockUnitId },
      });
      if (!custody) throw new NotFoundException('Physical-item custody was not found');
      return { custody, event: existingEvent, idempotent: true };
    }

    if (custodyRequiresLocation(input.toCustodyType) && !input.toLocationId) {
      throw new ConflictException({
        code: 'CUSTODY_LOCATION_REQUIRED',
        message: `${input.toCustodyType.toLowerCase().replaceAll('_', ' ')} custody requires a structured location`,
      });
    }

    await tx.$queryRaw(Prisma.sql`
      SELECT id
      FROM stock_unit_custodies
      WHERE tenant_id = ${input.tenantId} AND stock_unit_id = ${input.stockUnitId}
      FOR UPDATE
    `);
    const current = await tx.stockUnitCustody.findFirst({
      where: { tenantId: input.tenantId, stockUnitId: input.stockUnitId },
    });
    if (!current) throw new NotFoundException('Physical-item custody was not found');
    if (current.version !== input.expectedVersion) {
      throw new ConflictException({
        code: 'STALE_CUSTODY_VERSION',
        message: 'Physical-item custody changed while this action was open. Refresh and retry.',
        currentVersion: current.version,
      });
    }

    const occurredAt = input.occurredAt ?? new Date();
    const updated = await tx.stockUnitCustody.updateMany({
      where: {
        tenantId: input.tenantId,
        stockUnitId: input.stockUnitId,
        version: input.expectedVersion,
      },
      data: {
        custodyType: input.toCustodyType,
        locationId: input.toLocationId ?? null,
        custodianRef: input.toCustodianRef ?? null,
        evidence: input.evidence ?? Prisma.DbNull,
        lastConfirmedAt: occurredAt,
        version: { increment: 1 },
      },
    });
    if (updated.count !== 1) {
      throw new ConflictException({
        code: 'STALE_CUSTODY_VERSION',
        message:
          'Physical-item custody changed while this action was being saved. Refresh and retry.',
      });
    }
    const event = await tx.custodyEvent.create({
      data: {
        tenantId: input.tenantId,
        stockUnitId: input.stockUnitId,
        fulfillmentId: input.fulfillmentId ?? null,
        handoverId: input.handoverId ?? null,
        fromCustodyType: current.custodyType,
        toCustodyType: input.toCustodyType,
        fromLocationId: current.locationId,
        toLocationId: input.toLocationId ?? null,
        fromCustodianRef: current.custodianRef,
        toCustodianRef: input.toCustodianRef ?? null,
        reason: input.reason,
        actorUserId: input.actorUserId ?? null,
        idempotencyKey: input.idempotencyKey,
        evidence: input.evidence ?? Prisma.DbNull,
        occurredAt,
      },
    });
    const custody = await tx.stockUnitCustody.findUniqueOrThrow({
      where: { stockUnitId: input.stockUnitId },
    });
    return { custody, event, idempotent: false };
  }
}
