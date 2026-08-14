import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InventoryCountIdentityMatch,
  InventoryMovementType,
  Prisma,
  StockUnitDisposition,
  StockUnitOperationalState,
} from '@prisma/client';
import { createHash } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import {
  InventoryMovementsQueryDto,
  ReconcileInventoryCountDto,
} from './dto/inventory-foundation.dto';

const PHYSICALLY_EXPECTED_DISPOSITIONS = [
  StockUnitDisposition.ACTIVE,
  StockUnitDisposition.QUARANTINED,
] as const;

const AWAY_FROM_RECORDED_LOCATION_STATES = [
  StockUnitOperationalState.OUT_FOR_RENTAL,
  StockUnitOperationalState.IN_TRANSFER,
] as const;

@Injectable()
export class InventoryCountService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string, query: InventoryMovementsQueryDto) {
    const search = query.search?.trim();
    const where: Prisma.InventoryCountSessionWhereInput = {
      tenantId,
      ...(query.locationId ? { locationId: query.locationId } : {}),
      ...(query.actorUserId
        ? {
            OR: [{ createdByUserId: query.actorUserId }, { completedByUserId: query.actorUserId }],
          }
        : {}),
      ...(query.dateFrom || query.dateTo
        ? {
            completedAt: {
              ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
              ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
            },
          }
        : {}),
      ...(search
        ? {
            AND: [
              {
                OR: [
                  { reason: { contains: search, mode: 'insensitive' } },
                  { notes: { contains: search, mode: 'insensitive' } },
                  { location: { name: { contains: search, mode: 'insensitive' } } },
                  { location: { code: { contains: search, mode: 'insensitive' } } },
                  {
                    observations: {
                      some: { scannedIdentity: { contains: search, mode: 'insensitive' } },
                    },
                  },
                ],
              },
            ],
          }
        : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.inventoryCountSession.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: [{ completedAt: 'desc' }, { id: 'desc' }],
        include: {
          location: { select: { id: true, code: true, name: true } },
          createdBy: { select: { id: true, fullName: true } },
          completedBy: { select: { id: true, fullName: true } },
        },
      }),
      this.prisma.inventoryCountSession.count({ where }),
    ]);

    return {
      data,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  }

  get(tenantId: string, countSessionId: string) {
    return this.getSession(this.prisma, tenantId, countSessionId);
  }

  async reconcile(tenantId: string, dto: ReconcileInventoryCountDto, actorUserId: string) {
    const identities = dto.identities.map((identity) => identity.trim()).filter(Boolean);
    if (identities.length === 0) {
      throw new BadRequestException('At least one non-empty asset code or barcode is required');
    }
    const requestHash = createHash('sha256')
      .update(
        JSON.stringify({
          locationId: dto.locationId,
          identities,
          reason: dto.reason.trim(),
          notes: dto.notes?.trim() || null,
        }),
      )
      .digest('hex');

    return this.prisma.$transaction(
      async (tx) => {
        const replay = await tx.inventoryCountSession.findUnique({
          where: {
            tenantId_idempotencyKey: { tenantId, idempotencyKey: dto.idempotencyKey },
          },
          select: { id: true, requestHash: true },
        });
        if (replay) {
          if (replay.requestHash !== requestHash) {
            throw new ConflictException(
              'This stock-count idempotency key was already used for different scan data',
            );
          }
          return { replayed: true, session: await this.getSession(tx, tenantId, replay.id) };
        }

        const location = await tx.inventoryLocation.findFirst({
          where: { id: dto.locationId, tenantId, isActive: true, canStoreInventory: true },
          select: { id: true },
        });
        if (!location) {
          throw new NotFoundException('Active inventory storage location not found');
        }

        const uppercaseIdentities = [
          ...new Set(identities.map((identity) => identity.toUpperCase())),
        ];
        const exactIdentities = [...new Set(identities)];
        const [matchedUnits, expectedUnits] = await Promise.all([
          tx.stockUnit.findMany({
            where: {
              tenantId,
              deletedAt: null,
              OR: [
                { assetCode: { in: uppercaseIdentities, mode: 'insensitive' } },
                { barcode: { in: exactIdentities } },
              ],
            },
            select: {
              id: true,
              assetCode: true,
              barcode: true,
              variantSizeId: true,
              locationId: true,
              disposition: true,
              operationalState: true,
            },
          }),
          tx.stockUnit.findMany({
            where: {
              tenantId,
              locationId: dto.locationId,
              deletedAt: null,
              disposition: { in: [...PHYSICALLY_EXPECTED_DISPOSITIONS] },
              operationalState: { notIn: [...AWAY_FROM_RECORDED_LOCATION_STATES] },
            },
            select: {
              id: true,
              assetCode: true,
              barcode: true,
              variantSizeId: true,
              locationId: true,
              disposition: true,
              operationalState: true,
            },
          }),
        ]);

        const byAssetCode = new Map(
          matchedUnits.map((unit) => [unit.assetCode.toUpperCase(), unit]),
        );
        const byBarcode = new Map(
          matchedUnits.filter((unit) => unit.barcode).map((unit) => [unit.barcode!, unit]),
        );
        const seenUnitIds = new Set<string>();
        const seenUnknownIdentities = new Set<string>();
        const scanCounts = new Map<string, number>();
        const observations = identities.map((identity, sequence) => {
          const assetMatch = byAssetCode.get(identity.toUpperCase());
          const barcodeMatch = byBarcode.get(identity);
          if (assetMatch && barcodeMatch && assetMatch.id !== barcodeMatch.id) {
            throw new BadRequestException(
              `Identity “${identity}” ambiguously matches one asset code and another barcode`,
            );
          }
          const unit = assetMatch ?? barcodeMatch;
          const unknownKey = identity.toUpperCase();
          const isDuplicate = unit
            ? seenUnitIds.has(unit.id)
            : seenUnknownIdentities.has(unknownKey);
          if (unit) {
            seenUnitIds.add(unit.id);
            scanCounts.set(unit.id, (scanCounts.get(unit.id) ?? 0) + 1);
          } else {
            seenUnknownIdentities.add(unknownKey);
          }
          return {
            tenantId,
            sequence,
            scannedIdentity: identity,
            identityMatch: assetMatch
              ? InventoryCountIdentityMatch.ASSET_CODE
              : barcodeMatch
                ? InventoryCountIdentityMatch.BARCODE
                : InventoryCountIdentityMatch.UNKNOWN,
            stockUnitId: unit?.id ?? null,
            isDuplicate,
          };
        });

        const expectedById = new Map(expectedUnits.map((unit) => [unit.id, unit]));
        const knownObservedUnits = matchedUnits.filter((unit) => seenUnitIds.has(unit.id));
        const union = new Map(expectedUnits.map((unit) => [unit.id, unit]));
        for (const unit of knownObservedUnits) union.set(unit.id, unit);

        const items = [...union.values()]
          .sort((left, right) => left.assetCode.localeCompare(right.assetCode))
          .map((unit) => {
            const expectedAtLocation = expectedById.has(unit.id);
            const observed = seenUnitIds.has(unit.id);
            const wrongLocation = observed && unit.locationId !== dto.locationId;
            const requiresOperationalReview =
              observed &&
              (unit.disposition === StockUnitDisposition.LOST ||
                unit.disposition === StockUnitDisposition.RETIRED ||
                AWAY_FROM_RECORDED_LOCATION_STATES.includes(
                  unit.operationalState as (typeof AWAY_FROM_RECORDED_LOCATION_STATES)[number],
                ));
            return {
              tenantId,
              stockUnitId: unit.id,
              expectedAtLocation,
              observed,
              scanCount: scanCounts.get(unit.id) ?? 0,
              missing: expectedAtLocation && !observed,
              unexpected: observed && !expectedAtLocation,
              wrongLocation,
              requiresOperationalReview,
              recordedLocationId: unit.locationId,
              recordedDisposition: unit.disposition,
              recordedOperationalState: unit.operationalState,
              variantSizeId: unit.variantSizeId,
              assetCode: unit.assetCode,
            };
          });

        const session = await tx.inventoryCountSession.create({
          data: {
            tenantId,
            locationId: dto.locationId,
            reason: dto.reason.trim(),
            notes: dto.notes?.trim() || null,
            expectedCount: expectedUnits.length,
            observedUniqueCount: seenUnitIds.size,
            missingCount: items.filter((item) => item.missing).length,
            unexpectedCount: items.filter((item) => item.unexpected).length,
            duplicateScanCount: observations.filter((observation) => observation.isDuplicate)
              .length,
            unknownScanCount: observations.filter(
              (observation) => observation.identityMatch === InventoryCountIdentityMatch.UNKNOWN,
            ).length,
            wrongLocationCount: items.filter((item) => item.wrongLocation).length,
            operationalReviewCount: items.filter((item) => item.requiresOperationalReview).length,
            idempotencyKey: dto.idempotencyKey,
            requestHash,
            createdByUserId: actorUserId,
            completedByUserId: actorUserId,
          },
        });

        await tx.inventoryCountObservation.createMany({
          data: observations.map((observation) => ({
            ...observation,
            countSessionId: session.id,
          })),
        });
        await tx.inventoryCountItem.createMany({
          data: items.map(({ variantSizeId: _variantSizeId, assetCode: _assetCode, ...item }) => ({
            ...item,
            countSessionId: session.id,
          })),
        });

        const discrepancies = items.filter(
          (item) =>
            item.missing || item.unexpected || item.wrongLocation || item.requiresOperationalReview,
        );
        for (const item of discrepancies) {
          const findings = [
            item.missing ? 'missing' : null,
            item.unexpected ? 'unexpected' : null,
            item.wrongLocation ? 'wrong location' : null,
            item.requiresOperationalReview ? 'operational state requires review' : null,
          ].filter(Boolean);
          await tx.inventoryMovement.create({
            data: {
              tenantId,
              variantSizeId: item.variantSizeId,
              stockUnitId: item.stockUnitId,
              originLocationId: item.recordedLocationId,
              destinationLocationId: dto.locationId,
              countSessionId: session.id,
              movementType: InventoryMovementType.COUNT_CORRECTION,
              beforeState: {
                recordedLocationId: item.recordedLocationId,
                disposition: item.recordedDisposition,
                operationalState: item.recordedOperationalState,
              },
              afterState: {
                countSessionId: session.id,
                expectedAtLocation: item.expectedAtLocation,
                observed: item.observed,
                scanCount: item.scanCount,
                findings,
              },
              reason: `Stock count investigation for ${item.assetCode}: ${findings.join(', ')}. ${dto.reason.trim()}`,
              actorUserId,
            },
          });
        }

        return { replayed: false, session: await this.getSession(tx, tenantId, session.id) };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  private async getSession(
    client: PrismaService | Prisma.TransactionClient,
    tenantId: string,
    countSessionId: string,
  ) {
    const session = await client.inventoryCountSession.findFirst({
      where: { id: countSessionId, tenantId },
      include: {
        location: { select: { id: true, code: true, name: true } },
        createdBy: { select: { id: true, fullName: true } },
        completedBy: { select: { id: true, fullName: true } },
        observations: {
          orderBy: { sequence: 'asc' },
          include: { stockUnit: { select: { id: true, assetCode: true, barcode: true } } },
        },
        items: {
          orderBy: { stockUnit: { assetCode: 'asc' } },
          include: {
            stockUnit: {
              select: {
                id: true,
                assetCode: true,
                barcode: true,
                variantSize: {
                  select: {
                    id: true,
                    sizeInstance: { select: { displayLabel: true } },
                    variant: {
                      select: {
                        variantName: true,
                        product: { select: { id: true, name: true } },
                      },
                    },
                  },
                },
              },
            },
            recordedLocation: { select: { id: true, code: true, name: true } },
          },
        },
      },
    });
    if (!session) throw new NotFoundException('Stock-count session not found');
    return session;
  }
}
