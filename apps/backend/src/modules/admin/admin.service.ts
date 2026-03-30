import { Injectable, NotFoundException, BadRequestException, ConflictException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { UpdateTenantStatusDto } from './dto/update-tenant-status.dto';
import { UpdateTenantPlanDto } from './dto/update-tenant-plan.dto';

/** Allowed sort columns for tenant listing — prevents sort-parameter injection */
const ALLOWED_SORT_FIELDS = ['createdAt', 'businessName', 'subdomain', 'status', 'updatedAt'] as const;
type AllowedSortField = typeof ALLOWED_SORT_FIELDS[number];

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // =========================================================================
  // TENANT MANAGEMENT
  // =========================================================================

  /**
   * List all tenants with pagination, search, status/plan filters.
   * Point 6: sort parameter validated against allowlist.
   * Point 9: totalRevenue computed from Payment table.
   * Point 11: handles orphaned tenants with null owner gracefully.
   */
  async getTenants(params: { status?: string; plan?: string; search?: string; page: number; limit: number; sort?: string }) {
    const { status, plan, search, page, limit, sort } = params;

    const where: any = {};
    if (status) where.status = status;
    if (plan) where.plan = { slug: plan };
    if (search) {
      where.OR = [
        { businessName: { contains: search, mode: 'insensitive' } },
        { subdomain: { contains: search, mode: 'insensitive' } },
      ];
    }

    const skip = (page - 1) * limit;

    // Point 6: Validate sort field against allowlist
    let orderBy: any = { createdAt: 'desc' };
    if (sort && ALLOWED_SORT_FIELDS.includes(sort as AllowedSortField)) {
      orderBy = { [sort]: 'desc' };
    }

    const [tenants, total] = await Promise.all([
      this.prisma.tenant.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          plan: { select: { name: true, slug: true } },
          owner: { select: { fullName: true, phone: true } },
          _count: {
            select: { products: true, bookings: true }
          }
        },
      }),
      this.prisma.tenant.count({ where }),
    ]);

    // Point 9: Compute real totalRevenue per tenant from Payment table
    const tenantIds = tenants.map(t => t.id);
    const revenueResults = await this.prisma.payment.groupBy({
      by: ['tenantId'],
      where: {
        tenantId: { in: tenantIds },
        status: 'verified',
      },
      _sum: { amount: true },
    });
    const revenueMap = new Map(revenueResults.map(r => [r.tenantId, r._sum.amount || 0]));

    // Point 11: Handle orphaned tenants — show 'N/A' for missing owner
    const data = tenants.map(t => ({
      id: t.id,
      businessName: t.businessName,
      subdomain: t.subdomain,
      plan: t.plan?.name || 'None',
      status: t.status,
      productCount: t._count.products,
      orderCount: t._count.bookings,
      totalRevenue: revenueMap.get(t.id) || 0,
      ownerName: t.owner?.fullName || 'N/A',
      ownerPhone: t.owner?.phone || 'N/A',
      createdAt: t.createdAt,
    }));

    return {
      success: true,
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getTenant(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        plan: true,
        owner: { select: { id: true, fullName: true, email: true, phone: true } },
        storeSettings: true,
        _count: {
          select: { products: true, bookings: true, customers: true }
        }
      },
    });

    if (!tenant) throw new NotFoundException('Tenant not found');

    return { success: true, data: tenant };
  }

  /**
   * Point 5: Update tenant status with full audit trail.
   * Emits 'admin.tenantStatusChanged' for audit logging.
   */
  async updateTenantStatus(id: string, dto: UpdateTenantStatusDto, adminUserId: string) {
    const existing = await this.prisma.tenant.findUnique({
      where: { id },
      select: { status: true, businessName: true },
    });

    if (!existing) throw new NotFoundException('Tenant not found');

    const tenant = await this.prisma.tenant.update({
      where: { id },
      data: { status: dto.status },
    });

    // Emit audit event
    this.eventEmitter.emit('admin.tenantStatusChanged', {
      adminUserId,
      tenantId: id,
      businessName: existing.businessName,
      oldStatus: existing.status,
      newStatus: dto.status,
      reason: dto.reason,
      timestamp: new Date().toISOString(),
    });

    this.logger.log(
      `Admin ${adminUserId} changed tenant ${id} status: ${existing.status} → ${dto.status}` +
      (dto.reason ? ` (reason: ${dto.reason})` : ''),
    );

    return { success: true, data: tenant };
  }

  /**
   * Point 7: Validate tenant exists before plan change.
   * Point 8: Wrap in Prisma transaction.
   * Emits 'admin.tenantPlanChanged' for audit logging.
   */
  async updateTenantPlan(id: string, dto: UpdateTenantPlanDto, adminUserId: string) {
    // Point 7: Validate tenant exists
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      select: { planId: true, businessName: true },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    // Validate plan exists
    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id: dto.planId },
    });
    if (!plan) throw new NotFoundException('Subscription plan not found');

    const now = new Date();
    const periodEnd = new Date(now);
    if (dto.billingCycle === 'annual') {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    // Point 8: Wrap in transaction
    const subscription = await this.prisma.$transaction(async (tx) => {
      const sub = await tx.subscription.upsert({
        where: { tenantId: id },
        create: {
          tenantId: id,
          planId: dto.planId,
          billingCycle: dto.billingCycle,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          status: 'active'
        },
        update: {
          planId: dto.planId,
          billingCycle: dto.billingCycle,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          status: 'active'
        }
      });

      await tx.tenant.update({
        where: { id },
        data: { planId: dto.planId }
      });

      return sub;
    });

    // Emit audit event
    this.eventEmitter.emit('admin.tenantPlanChanged', {
      adminUserId,
      tenantId: id,
      oldPlanId: tenant.planId,
      newPlanId: dto.planId,
      billingCycle: dto.billingCycle,
      timestamp: new Date().toISOString(),
    });

    this.logger.log(
      `Admin ${adminUserId} changed tenant ${id} plan: ${tenant.planId} → ${dto.planId} (${dto.billingCycle})`,
    );

    return { success: true, data: subscription };
  }

  // =========================================================================
  // ANALYTICS
  // =========================================================================

  /**
   * Point 10: All queries parallelized in single Promise.all.
   * Point 18: GMV computed from verified payments. churnRate computed from cancelled subscriptions.
   */
  async getPlatformAnalytics() {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Point 10: Parallelize ALL queries in a single Promise.all
    const [
      totalTenants,
      activeTenants,
      activeSubs,
      newThisMonth,
      totalProducts,
      totalOrders,
      gmvResult,
      cancelledLastMonth,
      totalSubsLastMonth,
    ] = await Promise.all([
      this.prisma.tenant.count(),
      this.prisma.tenant.count({ where: { status: 'active' } }),
      this.prisma.subscription.findMany({
        where: { status: 'active' },
        include: { plan: true },
      }),
      this.prisma.tenant.count({
        where: { createdAt: { gte: firstDayOfMonth } }
      }),
      this.prisma.product.count(),
      this.prisma.booking.count(),
      // Point 18: Real GMV from verified payments
      this.prisma.payment.aggregate({
        where: { status: 'verified' },
        _sum: { amount: true },
      }),
      // Point 18: Churn rate — cancelled subs in last 30 days
      this.prisma.subscription.count({
        where: {
          status: 'cancelled',
          cancelledAt: { gte: thirtyDaysAgo },
        },
      }),
      // Total active subs at start of period (for churn denominator)
      this.prisma.subscription.count({
        where: {
          createdAt: { lte: thirtyDaysAgo },
        },
      }),
    ]);

    const mrr = activeSubs.reduce((acc, sub) => {
      const price = sub.billingCycle === 'annual'
        ? Number(sub.plan.priceAnnual || 0) / 12
        : Number(sub.plan.priceMonthly);
      return acc + price;
    }, 0);

    // Point 18: Compute churn rate as cancelled / total * 100
    const churnRate = totalSubsLastMonth > 0
      ? Math.round((cancelledLastMonth / totalSubsLastMonth) * 100 * 10) / 10
      : 0;

    return {
      success: true,
      data: {
        tenants: { total: totalTenants, active: activeTenants, newThisMonth },
        mrr: Math.round(mrr),
        gmv: gmvResult._sum.amount || 0,
        churnRate,
        totalProducts,
        totalOrders,
      }
    };
  }

  // =========================================================================
  // IMPERSONATION
  // =========================================================================

  /**
   * Point 1: Token includes isImpersonation + impersonatorId.
   * Point 2: Emits 'admin.tenantImpersonated' audit event.
   */
  async impersonateTenant(adminUserId: string, tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { owner: true }
    });

    if (!tenant) throw new NotFoundException('Tenant not found');

    // Point 1: Include impersonation metadata in the JWT
    const impersonationToken = this.jwtService.sign({
      sub: tenant.owner.id,
      tenantId: tenant.id,
      role: 'owner',
      sessionId: `impersonation_${Date.now()}`,
      isImpersonation: true,
      impersonatorId: adminUserId,
    });

    // Point 2: Emit audit event
    this.eventEmitter.emit('admin.tenantImpersonated', {
      adminUserId,
      tenantId: tenant.id,
      ownerUserId: tenant.owner.id,
      businessName: tenant.businessName,
      timestamp: new Date().toISOString(),
    });

    this.logger.warn(
      `Admin ${adminUserId} impersonating tenant ${tenant.id} (${tenant.businessName}) as owner ${tenant.owner.id}`,
    );

    return {
      success: true,
      data: {
        impersonationToken,
        tenantId: tenant.id,
        businessName: tenant.businessName,
        subdomain: tenant.subdomain,
        expiresIn: 3600,
      }
    };
  }

  // =========================================================================
  // SUBSCRIPTION PLANS
  // =========================================================================

  async getPlans() {
    const plans = await this.prisma.subscriptionPlan.findMany({
      orderBy: { displayOrder: 'asc' }
    });
    return { success: true, data: plans };
  }

  async createPlan(dto: CreatePlanDto) {
    const existing = await this.prisma.subscriptionPlan.findUnique({ where: { slug: dto.slug } });
    if (existing) throw new ConflictException('Plan with this slug already exists');

    const plan = await this.prisma.subscriptionPlan.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        priceMonthly: dto.priceMonthly,
        priceAnnual: dto.priceAnnual,
        maxProducts: dto.maxProducts,
        maxStaff: dto.maxStaff,
        customDomain: dto.customDomain,
        smsEnabled: dto.smsEnabled,
        analyticsFull: dto.analyticsFull,
        removeBranding: dto.removeBranding,
        isActive: dto.isActive,
        displayOrder: dto.displayOrder
      }
    });

    return { success: true, data: plan };
  }

  async updatePlan(id: string, dto: UpdatePlanDto) {
    const existing = await this.prisma.subscriptionPlan.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Plan not found');

    const plan = await this.prisma.subscriptionPlan.update({
      where: { id },
      data: {
        name: dto.name,
        slug: dto.slug,
        priceMonthly: dto.priceMonthly,
        priceAnnual: dto.priceAnnual,
        maxProducts: dto.maxProducts,
        maxStaff: dto.maxStaff,
        customDomain: dto.customDomain,
        smsEnabled: dto.smsEnabled,
        analyticsFull: dto.analyticsFull,
        removeBranding: dto.removeBranding,
        isActive: dto.isActive,
        displayOrder: dto.displayOrder
      }
    });

    return { success: true, data: plan };
  }

  // =========================================================================
  // TENANT SOFT-DELETE (Point 19)
  // =========================================================================

  /**
   * Point 19: Soft-delete a tenant by setting status to 'cancelled'.
   */
  async deleteTenant(id: string, adminUserId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      select: { id: true, status: true, businessName: true },
    });

    if (!tenant) throw new NotFoundException('Tenant not found');

    if (tenant.status === 'cancelled') {
      throw new BadRequestException('Tenant is already cancelled');
    }

    const updated = await this.prisma.tenant.update({
      where: { id },
      data: { status: 'cancelled' },
    });

    // Also cancel the subscription if active
    await this.prisma.subscription.updateMany({
      where: { tenantId: id, status: { not: 'cancelled' } },
      data: { status: 'cancelled', cancelledAt: new Date() },
    });

    this.eventEmitter.emit('admin.tenantStatusChanged', {
      adminUserId,
      tenantId: id,
      businessName: tenant.businessName,
      oldStatus: tenant.status,
      newStatus: 'cancelled',
      reason: 'Deleted by admin',
      timestamp: new Date().toISOString(),
    });

    this.logger.warn(`Admin ${adminUserId} soft-deleted tenant ${id} (${tenant.businessName})`);

    return { success: true, data: updated };
  }

  // =========================================================================
  // ADMIN ACTIVITY LOG (Point 20)
  // =========================================================================

  /**
   * Point 20: Retrieve admin activity log for the admin dashboard.
   * Queries the AuditLog table for admin-level actions.
   */
  async getActivityLog(params: { page: number; limit: number }) {
    const { page, limit } = params;
    const skip = (page - 1) * limit;

    // Query audit logs where the action starts with 'admin.'
    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where: { action: { startsWith: 'admin.' } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          user: { select: { fullName: true, email: true } },
        },
      }),
      this.prisma.auditLog.count({
        where: { action: { startsWith: 'admin.' } },
      }),
    ]);

    return {
      success: true,
      data: logs,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }
}
