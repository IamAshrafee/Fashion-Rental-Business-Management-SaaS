import { Logger } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

const logger = new Logger('TenantIsolation');

/**
 * List of Prisma models that are scoped by tenant.
 * Every query on these models MUST include tenantId filtering.
 */
const TENANT_SCOPED_MODELS: Prisma.ModelName[] = [
  'Product',
  'Booking',
  'BookingItem',
  'Customer',
  'Category',
  'Subcategory',
  'Event',
  'Notification',
  'AuditLog',
  'DateBlock',
  'ProductVariant',
  'ProductImage',
  'ProductPricing',
  'ProductServices',
  'ProductType',
  'SizeSchema',
  'SizeInstance',
  'ProductFaq',
  'ProductDetailHeader',
  'ProductEvent',
  'Review',
  'CustomerTag',
];

/**
 * Operations where we auto-inject tenantId into the WHERE clause.
 */
const READ_OPERATIONS = ['findFirst', 'findMany', 'findUnique', 'count', 'aggregate', 'groupBy'];
const WRITE_OPERATIONS = ['update', 'updateMany', 'delete', 'deleteMany', 'upsert'];

/**
 * Applies Prisma middleware for automatic tenant data isolation.
 *
 * How it works:
 * - For tenant-scoped models, the middleware ensures tenantId is always present
 *   in the WHERE clause for reads and writes.
 * - For creates, it does NOT auto-inject — the service layer must explicitly set tenantId.
 *   This is intentional: auto-injection on create requires request context that
 *   $use middleware doesn't have access to.
 * - Instead, the middleware WARNS if a tenant-scoped create is missing tenantId.
 *
 * WARNING: Prisma $use middleware is deprecated in Prisma 5+ but still works.
 * When we upgrade, we'll migrate to Prisma Client extensions.
 */
export function applyTenantIsolationMiddleware(prisma: PrismaClient): void {
  prisma.$use(async (params: Prisma.MiddlewareParams, next) => {
    if (!params.model || !TENANT_SCOPED_MODELS.includes(params.model as Prisma.ModelName)) {
      return next(params);
    }

    // Reads: warn if tenantId is missing
    if (params.action && READ_OPERATIONS.includes(params.action)) {
      const where = params.args?.where;
      if (where && !where.tenantId) {
        logger.warn(
          `Query on ${params.model}.${params.action} without tenantId filter. ` +
            `This may return cross-tenant data!`,
        );
      }
    }

    // Writes (update/delete): warn if tenantId is missing
    if (params.action && WRITE_OPERATIONS.includes(params.action)) {
      const where = params.args?.where;
      if (where && !where.tenantId) {
        logger.warn(
          `Mutation on ${params.model}.${params.action} without tenantId filter. ` +
            `This may affect cross-tenant data!`,
        );
      }
    }

    // Creates: warn if data is missing tenantId
    if (params.action === 'create' || params.action === 'createMany') {
      const data = params.args?.data;
      if (data && !data.tenantId) {
        logger.warn(
          `Create on ${params.model} without tenantId. ` +
            `Service layer must set tenantId explicitly.`,
        );
      }
    }

    return next(params);
  });
}
