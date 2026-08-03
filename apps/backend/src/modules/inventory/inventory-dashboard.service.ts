import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { InventoryItemsQueryDto } from './dto/inventory-foundation.dto';

@Injectable()
export class InventoryDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(tenantId: string) {
    const today = this.today();
    const [
      locations,
      pooled,
      unitStates,
      reservationSummary,
      transferStates,
      draftInspections,
      openServiceOrders,
      openIssues,
      overdueRequirements,
      potentialLowStock,
    ] = await Promise.all([
      this.prisma.inventoryLocation.findMany({
        where: { tenantId, isActive: true },
        orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
        select: {
          id: true,
          code: true,
          name: true,
          locationType: true,
          isDefault: true,
          _count: { select: { stockUnits: true, pools: true } },
        },
      }),
      this.prisma.inventoryPool.aggregate({
        where: { tenantId },
        _sum: { onHandQuantity: true },
        _count: { _all: true },
      }),
      this.prisma.stockUnit.groupBy({
        by: ['disposition', 'operationalState'],
        where: { tenantId, deletedAt: null },
        _count: { _all: true },
      }),
      this.prisma.inventoryReservation.aggregate({
        where: {
          tenantId,
          status: { in: ['PENDING', 'CONFIRMED'] },
          blockedEndDate: { gte: today },
          OR: [
            { status: 'CONFIRMED' },
            { status: 'PENDING', OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
          ],
        },
        _sum: { quantity: true },
        _count: { _all: true },
      }),
      this.prisma.inventoryTransfer.groupBy({
        by: ['status'],
        where: { tenantId },
        _count: { _all: true },
      }),
      this.prisma.stockUnitInspection.count({ where: { tenantId, status: 'DRAFT' } }),
      this.prisma.inventoryServiceOrder.count({
        where: { tenantId, status: { in: ['REQUESTED', 'SCHEDULED', 'IN_PROGRESS'] } },
      }),
      this.prisma.stockUnitIssue.count({
        where: { tenantId, status: { in: ['OPEN', 'IN_SERVICE'] } },
      }),
      this.prisma.fulfillmentRequirement.count({ where: { tenantId, status: 'OVERDUE' } }),
      this.prisma.inventoryPool.findMany({
        where: { tenantId, reorderThreshold: { not: null } },
        include: {
          location: { select: { id: true, code: true, name: true } },
          variantSize: {
            select: {
              id: true,
              sizeInstance: { select: { displayLabel: true } },
              variant: { select: { variantName: true, product: { select: { id: true, name: true } } } },
            },
          },
        },
        take: 500,
      }),
    ]);
    return {
      locations,
      pooled: {
        poolCount: pooled._count._all,
        onHandQuantity: pooled._sum.onHandQuantity ?? 0,
      },
      serialized: unitStates,
      reservations: {
        reservationCount: reservationSummary._count._all,
        quantity: reservationSummary._sum.quantity ?? 0,
      },
      transfers: Object.fromEntries(
        transferStates.map((entry) => [entry.status, entry._count._all]),
      ),
      workQueues: {
        draftInspections,
        openServiceOrders,
        openIssues,
        overdueRequirements,
      },
      lowStock: potentialLowStock.filter(
        (pool) => pool.reorderThreshold !== null && pool.onHandQuantity <= pool.reorderThreshold,
      ),
    };
  }

  async listItems(tenantId: string, query: InventoryItemsQueryDto) {
    const where: Prisma.StockUnitWhereInput = {
      tenantId,
      deletedAt: null,
      ...(query.locationId ? { locationId: query.locationId } : {}),
      ...(query.disposition ? { disposition: query.disposition } : {}),
      ...(query.operationalState ? { operationalState: query.operationalState } : {}),
      ...(query.condition ? { condition: query.condition } : {}),
      ...(query.search?.trim()
        ? {
            OR: [
              { assetCode: { contains: query.search.trim(), mode: 'insensitive' } },
              { barcode: { contains: query.search.trim(), mode: 'insensitive' } },
              {
                variantSize: {
                  variant: { product: { name: { contains: query.search.trim(), mode: 'insensitive' } } },
                },
              },
            ],
          }
        : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.stockUnit.findMany({
        where,
        include: {
          location: { select: { id: true, code: true, name: true } },
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
          _count: {
            select: {
              inspections: true,
              issues: { where: { status: { in: ['OPEN', 'IN_SERVICE'] } } },
              serviceOrders: { where: { status: { in: ['REQUESTED', 'SCHEDULED', 'IN_PROGRESS'] } } },
            },
          },
        },
        orderBy: [{ operationalState: 'asc' }, { assetCode: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.stockUnit.count({ where }),
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

  async operations(tenantId: string) {
    const [inspections, serviceOrders, issues] = await Promise.all([
      this.prisma.stockUnitInspection.findMany({
        where: { tenantId, status: 'DRAFT' },
        include: {
          stockUnit: {
            include: {
              location: { select: { id: true, code: true, name: true } },
              variantSize: { select: { variant: { select: { product: { select: { id: true, name: true } } } } } },
            },
          },
          inspectedBy: { select: { id: true, fullName: true } },
        },
        orderBy: { createdAt: 'asc' },
        take: 100,
      }),
      this.prisma.inventoryServiceOrder.findMany({
        where: { tenantId, status: { in: ['REQUESTED', 'SCHEDULED', 'IN_PROGRESS'] } },
        include: {
          stockUnit: { select: { id: true, assetCode: true, variantSize: { select: { variant: { select: { product: { select: { id: true, name: true } } } } } } } },
          serviceLocation: { select: { id: true, code: true, name: true } },
        },
        orderBy: [{ expectedCompletionAt: 'asc' }, { requestedAt: 'asc' }],
        take: 100,
      }),
      this.prisma.stockUnitIssue.findMany({
        where: { tenantId, status: { in: ['OPEN', 'IN_SERVICE'] } },
        include: {
          stockUnit: { select: { id: true, assetCode: true, variantSize: { select: { variant: { select: { product: { select: { id: true, name: true } } } } } } } },
        },
        orderBy: [{ severity: 'desc' }, { createdAt: 'asc' }],
        take: 100,
      }),
    ]);
    return { inspections, serviceOrders, issues };
  }

  private today() {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }
}
