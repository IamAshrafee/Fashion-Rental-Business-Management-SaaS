import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, StockUnitRevenueAllocationKind } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateStockUnitRevenueAdjustmentDto } from './dto/inventory.dto';

@Injectable()
export class StockUnitRevenueService {
  constructor(private readonly prisma: PrismaService) {}

  async createAdjustment(
    tenantId: string,
    stockUnitId: string,
    dto: CreateStockUnitRevenueAdjustmentDto,
    actorUserId?: string,
  ) {
    if (dto.amount === 0) {
      throw new BadRequestException({
        code: 'REVENUE_ADJUSTMENT_ZERO',
        message: 'A revenue adjustment must be a non-zero signed amount.',
      });
    }

    const reason = dto.reason.trim();
    const sourceKey = `adjustment:${dto.idempotencyKey}`;

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw(Prisma.sql`
            SELECT id
            FROM stock_unit_assignments
            WHERE tenant_id = ${tenantId}
              AND id = ${dto.assignmentId}
            FOR UPDATE
          `);

          const assignment = await tx.stockUnitAssignment.findFirst({
            where: {
              id: dto.assignmentId,
              tenantId,
              stockUnitId,
            },
            select: {
              id: true,
              stockUnitId: true,
              reservation: {
                select: {
                  bookingId: true,
                  bookingItemId: true,
                  fulfillmentRequirementId: true,
                },
              },
            },
          });
          if (!assignment) {
            throw new NotFoundException({
              code: 'STOCK_UNIT_ASSIGNMENT_NOT_FOUND',
              message: 'The selected item assignment was not found.',
            });
          }

          const existing = await tx.stockUnitRevenueAllocation.findFirst({
            where: { tenantId, sourceKey },
          });
          if (existing) {
            const sameCommand =
              existing.stockUnitId === stockUnitId &&
              existing.assignmentId === assignment.id &&
              existing.amount === dto.amount &&
              existing.reason === reason;
            if (!sameCommand) {
              throw new ConflictException({
                code: 'REVENUE_ADJUSTMENT_KEY_REUSED',
                message: 'This adjustment key belongs to a different financial correction.',
              });
            }
            return { allocation: existing, replayed: true };
          }

          const originalAllocation = await tx.stockUnitRevenueAllocation.findFirst({
            where: {
              tenantId,
              assignmentId: assignment.id,
              stockUnitId,
              allocationKind: StockUnitRevenueAllocationKind.RENTAL_REVENUE,
            },
            select: { id: true },
          });
          if (!originalAllocation) {
            throw new ConflictException({
              code: 'REVENUE_ADJUSTMENT_ORIGINAL_MISSING',
              message:
                'Revenue can only be adjusted after this physical item has received completed-rental revenue.',
            });
          }

          const allocation = await tx.stockUnitRevenueAllocation.create({
            data: {
              tenantId,
              stockUnitId,
              assignmentId: assignment.id,
              bookingId: assignment.reservation.bookingId,
              bookingItemId: assignment.reservation.bookingItemId,
              fulfillmentRequirementId: assignment.reservation.fulfillmentRequirementId,
              allocationKind: StockUnitRevenueAllocationKind.ADJUSTMENT,
              amount: dto.amount,
              sourceKey,
              reason,
              actorUserId: actorUserId ?? null,
            },
          });

          return { allocation, replayed: false };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException({
          code: 'REVENUE_ADJUSTMENT_KEY_REUSED',
          message: 'This adjustment key is already in use.',
        });
      }
      throw error;
    }
  }
}
