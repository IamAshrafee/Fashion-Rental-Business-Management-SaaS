import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { InventoryMovementsQueryDto } from './dto/inventory-foundation.dto';

@Injectable()
export class InventoryLedgerService {
  constructor(private readonly prisma: PrismaService) {}

  listMovements(tenantId: string, query: InventoryMovementsQueryDto) {
    return this.list(tenantId, query);
  }

  private async list(tenantId: string, query: InventoryMovementsQueryDto) {
    const search = query.search?.trim();
    const where: Prisma.InventoryMovementWhereInput = {
      tenantId,
      movementType: query.movementType,
      ...(query.productId ? { variantSize: { variant: { productId: query.productId } } } : {}),
      ...(query.variantSizeId ? { variantSizeId: query.variantSizeId } : {}),
      ...(query.stockUnitId ? { stockUnitId: query.stockUnitId } : {}),
      ...(query.actorUserId ? { actorUserId: query.actorUserId } : {}),
      ...(query.bookingId ? { reservation: { bookingId: query.bookingId } } : {}),
      ...(query.transferId ? { transferId: query.transferId } : {}),
      ...(query.locationId
        ? {
            OR: [
              { originLocationId: query.locationId },
              { destinationLocationId: query.locationId },
              { stockUnit: { locationId: query.locationId } },
            ],
          }
        : {}),
      ...(query.dateFrom || query.dateTo
        ? {
            createdAt: {
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
                  { stockUnit: { assetCode: { contains: search, mode: 'insensitive' } } },
                  {
                    variantSize: {
                      variant: {
                        product: { name: { contains: search, mode: 'insensitive' } },
                      },
                    },
                  },
                ],
              },
            ],
          }
        : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.inventoryMovement.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        include: {
          variantSize: {
            select: {
              id: true,
              sizeInstance: { select: { displayLabel: true } },
              variant: {
                select: {
                  id: true,
                  variantName: true,
                  product: { select: { id: true, name: true } },
                },
              },
            },
          },
          stockUnit: { select: { id: true, assetCode: true } },
          originLocation: { select: { id: true, code: true, name: true } },
          destinationLocation: { select: { id: true, code: true, name: true } },
          actor: { select: { id: true, fullName: true } },
          transfer: { select: { id: true, transferNumber: true } },
          reservation: {
            select: {
              id: true,
              booking: { select: { id: true, bookingNumber: true } },
            },
          },
        },
      }),
      this.prisma.inventoryMovement.count({ where }),
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
}
