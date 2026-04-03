/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable, NotFoundException, BadRequestException, ConflictException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { UpdateTenantStatusDto } from './dto/update-tenant-status.dto';
import { UpdateTenantPlanDto } from './dto/update-tenant-plan.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { CreateInvoiceDto, UpdateInvoiceStatusDto } from './dto/invoice.dto';
import { ExtendSubscriptionDto } from './dto/extend-subscription.dto';
import { CreatePromoCodeDto, UpdatePromoCodeDto } from './dto/promo-code.dto';

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
  async getTenants(params: { status?: string; plan?: string; paymentStatus?: string; search?: string; page: number; limit: number; sort?: string }) {
    const { status, plan, paymentStatus, search, page, limit, sort } = params;

    const where: any = {};
    if (status) where.status = status;
    if (plan) where.plan = { slug: plan };
    if (search) {
      where.OR = [
        { businessName: { contains: search, mode: 'insensitive' } },
        { subdomain: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Point 6: Validate sort field against allowlist
    let orderBy: any = { createdAt: 'desc' };
    if (sort && ALLOWED_SORT_FIELDS.includes(sort as AllowedSortField)) {
      orderBy = { [sort]: 'desc' };
    }

    // When filtering by paymentStatus, we fetch all matching tenants first then post-filter,
    // since paymentStatus is computed from joined data, not a direct column.
    // We over-fetch and then paginate in-memory for accuracy.
    const needsPaymentFilter = !!paymentStatus;
    const skip = needsPaymentFilter ? 0 : (page - 1) * limit;
    const take = needsPaymentFilter ? undefined : limit;

    const [tenants, totalUnfiltered] = await Promise.all([
      this.prisma.tenant.findMany({
        where,
        skip,
        take,
        orderBy,
        include: {
          plan: { select: { name: true, slug: true } },
          owner: { select: { fullName: true, phone: true } },
          subscription: { select: { currentPeriodEnd: true, status: true } },
          _count: {
            select: { products: true, bookings: true }
          }
        },
      }),
      this.prisma.tenant.count({ where }),
    ]);

    // Point 9: Compute real totalRevenue per tenant from Payment table
    const tenantIds = tenants.map(t => t.id);
    const [revenueResults, latestPayments] = await Promise.all([
      this.prisma.payment.groupBy({
        by: ['tenantId'],
        where: {
          tenantId: { in: tenantIds },
          status: 'verified',
        },
        _sum: { amount: true },
      }),
      // Fetch latest subscription payment per tenant for payment status computation
      this.prisma.subscriptionPayment.findMany({
        where: { tenantId: { in: tenantIds } },
        orderBy: { createdAt: 'desc' },
        distinct: ['tenantId'],
        select: { tenantId: true, periodEnd: true, createdAt: true },
      }),
    ]);
    const revenueMap = new Map(revenueResults.map(r => [r.tenantId, r._sum.amount || 0]));
    const latestPaymentMap = new Map(latestPayments.map(p => [p.tenantId, p]));

    // Compute payment status for each tenant:
    // - 'paid': has a subscription payment whose periodEnd >= now (covering current period)
    // - 'overdue': has a subscription but latest payment periodEnd < now (or plan is free → skip)
    // - 'never_paid': no subscription payments recorded at all
    const now = new Date();

    const computePaymentStatus = (t: typeof tenants[0]): 'paid' | 'overdue' | 'never_paid' => {
      // Free plan tenants are always considered "paid"
      if (t.plan?.slug === 'free') return 'paid';

      const latestPayment = latestPaymentMap.get(t.id);
      if (!latestPayment) return 'never_paid';

      // If the latest payment's period covers today, they're paid
      if (latestPayment.periodEnd >= now) return 'paid';

      // Payment exists but doesn't cover current date → overdue
      return 'overdue';
    };

    // Point 11: Handle orphaned tenants — show 'N/A' for missing owner
    let data = tenants.map(t => ({
      id: t.id,
      businessName: t.businessName,
      subdomain: t.subdomain,
      plan: t.plan?.name || 'None',
      planSlug: t.plan?.slug || null,
      status: t.status,
      paymentStatus: computePaymentStatus(t),
      productCount: t._count.products,
      orderCount: t._count.bookings,
      totalRevenue: revenueMap.get(t.id) || 0,
      ownerName: t.owner?.fullName || 'N/A',
      ownerPhone: t.owner?.phone || 'N/A',
      createdAt: t.createdAt,
    }));

    // Post-filter by payment status if requested
    if (paymentStatus) {
      data = data.filter(t => t.paymentStatus === paymentStatus);
    }

    const total = needsPaymentFilter ? data.length : totalUnfiltered;
    const paginatedData = needsPaymentFilter
      ? data.slice((page - 1) * limit, page * limit)
      : data;

    return {
      success: true,
      data: paginatedData,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getTenant(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        plan: true,
        subscription: true,
        owner: { select: { id: true, fullName: true, email: true, phone: true } },
        storeSettings: true,
        promoCode: { select: { code: true, linkedPlan: { select: { name: true } } } },
        _count: {
          select: { products: true, bookings: true, customers: true }
        }
      },
    });

    if (!tenant) throw new NotFoundException('Tenant not found');

    // Compute subscription status and days remaining for the frontend
    let subscription = null;
    if (tenant.subscription) {
      const sub = tenant.subscription;
      const now = new Date();
      const periodEnd = new Date(sub.currentPeriodEnd);
      const trialEnd = sub.trialEndsAt ? new Date(sub.trialEndsAt) : null;
      const daysRemaining = Math.max(0, Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

      let computedStatus = 'active';
      if (sub.status === 'cancelled') {
        computedStatus = 'cancelled';
      } else if (trialEnd && now < trialEnd) {
        computedStatus = 'trial';
      } else if (periodEnd < now) {
        // Past expiry — check if within 7-day grace
        const graceDays = Math.ceil((now.getTime() - periodEnd.getTime()) / (1000 * 60 * 60 * 24));
        computedStatus = graceDays <= 7 ? 'grace_period' : 'expired';
      }

      subscription = {
        id: sub.id,
        status: sub.status,
        billingCycle: sub.billingCycle,
        currentPeriodStart: sub.currentPeriodStart,
        currentPeriodEnd: sub.currentPeriodEnd,
        trialEndsAt: sub.trialEndsAt,
        computedStatus,
        daysRemaining,
      };
    }

    return {
      success: true,
      data: {
        ...tenant,
        subscription,
      },
    };
  }

  /**
   * Update tenant status with full audit trail.
   * - Validates status transition (no-ops rejected, cancelled→suspended blocked)
   * - Invalidates all sessions on suspend/cancel
   * - Emits 'admin.tenantStatusChanged' for audit logging
   * - Emits 'tenant.suspended' for notification system
   */
  async updateTenantStatus(id: string, dto: UpdateTenantStatusDto, adminUserId: string) {
    const existing = await this.prisma.tenant.findUnique({
      where: { id },
      select: { status: true, businessName: true, planId: true },
    });

    if (!existing) throw new NotFoundException('Tenant not found');

    // Validate status transition
    if (existing.status === dto.status) {
      throw new BadRequestException(`Tenant is already ${dto.status}`);
    }
    if (existing.status === 'cancelled' && dto.status === 'suspended') {
      throw new BadRequestException('Cannot suspend a cancelled tenant. Reactivate it first.');
    }

    const tenant = await this.prisma.tenant.update({
      where: { id },
      data: {
        status: dto.status,
        statusReason: dto.status === 'suspended'
          ? (dto.reason || 'Suspended by platform administrator')
          : dto.status === 'active'
            ? null  // Clear reason when reactivating
            : undefined,  // Don't touch for other transitions
      },
    });

    // Invalidate all sessions for this tenant when suspending or cancelling
    if (dto.status === 'suspended' || dto.status === 'cancelled') {
      const deleted = await this.prisma.session.deleteMany({ where: { tenantId: id } });
      if (deleted.count > 0) {
        this.logger.log(`Invalidated ${deleted.count} session(s) for tenant ${id}`);
      }
    }

    // If reactivating from cancelled, also restore the subscription
    if (existing.status === 'cancelled' && dto.status === 'active' && existing.planId) {
      const now = new Date();
      const periodEnd = new Date(now);
      periodEnd.setMonth(periodEnd.getMonth() + 1);

      await this.prisma.subscription.upsert({
        where: { tenantId: id },
        create: {
          tenantId: id,
          planId: existing.planId,
          billingCycle: 'monthly',
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          status: 'active',
        },
        update: {
          status: 'active',
          cancelledAt: null,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
        },
      });
    }

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

    // Emit domain event for notification system
    if (dto.status === 'suspended') {
      this.eventEmitter.emit('tenant.suspended', {
        tenantId: id,
        reason: dto.reason || 'Suspended by platform administrator',
      });
    }

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
    // Validate tenant exists
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

    // Item 15: Downgrade guards — check resource usage before allowing downgrade
    if (plan.maxProducts !== null) {
      const productCount = await this.prisma.product.count({
        where: { tenantId: id, deletedAt: null },
      });
      if (productCount > plan.maxProducts) {
        throw new BadRequestException(
          `Cannot downgrade: tenant has ${productCount} products but new plan allows max ${plan.maxProducts}. ` +
          `Please ask the tenant to reduce their products first.`,
        );
      }
    }
    if (plan.maxStaff > 0) {
      const staffCount = await this.prisma.tenantUser.count({
        where: { tenantId: id, isActive: true, role: { not: 'owner' } },
      });
      if (staffCount > plan.maxStaff) {
        throw new BadRequestException(
          `Cannot downgrade: tenant has ${staffCount} staff members but new plan allows max ${plan.maxStaff}. ` +
          `Please ask the tenant to reduce their staff first.`,
        );
      }
    }

    const now = new Date();
    const periodEnd = new Date(now);
    if (dto.billingCycle === 'annual') {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    // Determine action: upgrade or downgrade
    let oldPlan = null;
    if (tenant.planId) {
      oldPlan = await this.prisma.subscriptionPlan.findUnique({
        where: { id: tenant.planId },
        select: { priceMonthly: true },
      });
    }
    const action = !oldPlan
      ? 'created'
      : plan.priceMonthly > (oldPlan.priceMonthly ?? 0)
        ? 'upgraded'
        : plan.priceMonthly < (oldPlan.priceMonthly ?? 0)
          ? 'downgraded'
          : 'changed';

    // Wrap in transaction
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

      // Item 17: Log subscription history
      await tx.subscriptionHistory.create({
        data: {
          tenantId: id,
          oldPlanId: tenant.planId,
          newPlanId: dto.planId,
          action,
          billingCycle: dto.billingCycle,
          performedBy: adminUserId,
          metadata: { periodStart: now, periodEnd },
        },
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
      action,
      timestamp: new Date().toISOString(),
    });

    this.logger.log(
      `Admin ${adminUserId} ${action} tenant ${id} plan: ${tenant.planId} → ${dto.planId} (${dto.billingCycle})`,
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
      actualRevenueResult,
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
      // Actual MRR: sum of subscription payments received in last 30 days
      this.prisma.subscriptionPayment.aggregate({
        where: {
          createdAt: { gte: thirtyDaysAgo },
        },
        _sum: { amount: true },
      }),
    ]);

    // Expected MRR: derived from active subscriptions × plan prices
    const expectedMrr = activeSubs.reduce((acc, sub) => {
      const price = sub.billingCycle === 'annual'
        ? Number(sub.plan.priceAnnual || 0) / 12
        : Number(sub.plan.priceMonthly);
      return acc + price;
    }, 0);

    // Actual MRR: real revenue received in last 30 days
    const actualMrr = actualRevenueResult._sum.amount || 0;

    // Point 18: Compute churn rate as cancelled / total * 100
    const churnRate = totalSubsLastMonth > 0
      ? Math.round((cancelledLastMonth / totalSubsLastMonth) * 100 * 10) / 10
      : 0;

    return {
      success: true,
      data: {
        tenants: { total: totalTenants, active: activeTenants, newThisMonth },
        expectedMrr: Math.round(expectedMrr),
        actualMrr,
        mrr: Math.round(expectedMrr), // backward compat
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
      orderBy: { displayOrder: 'asc' },
      include: {
        _count: { select: { tenants: true } },
      },
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

  // =========================================================================
  // BILLING — SUBSCRIPTION PAYMENTS (Item 2)
  // =========================================================================

  /**
   * Record a manual subscription payment from a tenant.
   * Auto-extends the subscription period by the specified number of months.
   */
  async recordPayment(tenantId: string, dto: RecordPaymentDto, adminUserId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { subscription: true },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const months = dto.extendMonths || 1;
    const sub = tenant.subscription;

    // Calculate new period based on current subscription
    const now = new Date();
    const periodStart = sub?.currentPeriodEnd && sub.currentPeriodEnd > now
      ? new Date(sub.currentPeriodEnd) // Extend from current end
      : now; // Start fresh if expired
    const periodEnd = new Date(periodStart);
    periodEnd.setMonth(periodEnd.getMonth() + months);

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Create payment record
      const payment = await tx.subscriptionPayment.create({
        data: {
          tenantId,
          amount: dto.amount,
          method: dto.method,
          reference: dto.reference,
          notes: dto.notes,
          periodStart,
          periodEnd,
          recordedBy: adminUserId,
        },
      });

      // 2. Update/create subscription period
      if (sub) {
        await tx.subscription.update({
          where: { id: sub.id },
          data: {
            currentPeriodEnd: periodEnd,
            status: 'active',
          },
        });
      } else {
        // Create subscription if none exists
        const plan = await tx.subscriptionPlan.findFirst({
          where: { id: tenant.planId || undefined },
        });
        if (plan) {
          await tx.subscription.create({
            data: {
              tenantId,
              planId: plan.id,
              billingCycle: 'monthly',
              currentPeriodStart: periodStart,
              currentPeriodEnd: periodEnd,
              status: 'active',
            },
          });
        }
      }

      // 3. Ensure tenant is active
      if (tenant.status !== 'active') {
        await tx.tenant.update({
          where: { id: tenantId },
          data: { status: 'active', statusReason: null },
        });
      }

      // 4. Log subscription history
      await tx.subscriptionHistory.create({
        data: {
          tenantId,
          oldPlanId: tenant.planId,
          newPlanId: tenant.planId || '',
          action: 'renewed',
          reason: `Payment recorded: ${dto.method} — ${dto.reference || 'no ref'}`,
          performedBy: adminUserId,
          metadata: { paymentId: payment.id, amount: dto.amount, months },
        },
      });

      return payment;
    });

    this.eventEmitter.emit('admin.paymentRecorded', {
      adminUserId,
      tenantId,
      paymentId: result.id,
      amount: dto.amount,
      method: dto.method,
    });

    this.logger.log(`Admin ${adminUserId} recorded payment ৳${dto.amount / 100} for tenant ${tenantId}`);

    return { success: true, data: result };
  }

  /**
   * Get payment history for a tenant.
   */
  async getPaymentHistory(tenantId: string, params: { page: number; limit: number }) {
    const { page, limit } = params;
    const skip = (page - 1) * limit;

    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const [payments, total] = await Promise.all([
      this.prisma.subscriptionPayment.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          recorder: { select: { fullName: true } },
        },
      }),
      this.prisma.subscriptionPayment.count({ where: { tenantId } }),
    ]);

    return {
      success: true,
      data: payments,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  // =========================================================================
  // BILLING — INVOICES (Item 3)
  // =========================================================================

  /**
   * Generate an invoice for a tenant.
   * Auto-generates sequential invoice number (INV-YYYY-NNNN).
   */
  async generateInvoice(tenantId: string, dto: CreateInvoiceDto, adminUserId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, businessName: true },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    // Generate sequential invoice number
    const year = new Date().getFullYear();
    const lastInvoice = await this.prisma.invoice.findFirst({
      where: {
        invoiceNo: { startsWith: `INV-${year}-` },
      },
      orderBy: { invoiceNo: 'desc' },
      select: { invoiceNo: true },
    });

    let nextNum = 1;
    if (lastInvoice) {
      const parts = lastInvoice.invoiceNo.split('-');
      nextNum = parseInt(parts[2], 10) + 1;
    }
    const invoiceNo = `INV-${year}-${String(nextNum).padStart(4, '0')}`;

    const invoice = await this.prisma.invoice.create({
      data: {
        tenantId,
        invoiceNo,
        amount: dto.amount,
        dueDate: new Date(dto.dueDate),
        lineItems: dto.lineItems as any,
        notes: dto.notes,
      },
    });

    this.logger.log(`Admin ${adminUserId} generated invoice ${invoiceNo} for tenant ${tenantId}`);

    return { success: true, data: invoice };
  }

  /**
   * Get invoices for a tenant.
   */
  async getInvoices(tenantId: string, params: { page: number; limit: number }) {
    const { page, limit } = params;
    const skip = (page - 1) * limit;

    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const [invoices, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          payment: { select: { method: true, reference: true, createdAt: true } },
        },
      }),
      this.prisma.invoice.count({ where: { tenantId } }),
    ]);

    return {
      success: true,
      data: invoices,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Update invoice status (mark as paid, void, etc.).
   */
  async updateInvoiceStatus(invoiceId: string, dto: UpdateInvoiceStatusDto) {
    const invoice = await this.prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) throw new NotFoundException('Invoice not found');

    if (!['paid', 'void', 'unpaid'].includes(dto.status)) {
      throw new BadRequestException('Invalid status. Must be: paid, void, or unpaid');
    }

    const updated = await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: dto.status,
        paidAt: dto.status === 'paid' ? new Date() : null,
        paymentId: dto.paymentId || null,
      },
    });

    return { success: true, data: updated };
  }

  // =========================================================================
  // SUBSCRIPTION EXTENSION (Item 5)
  // =========================================================================

  /**
   * Extend a tenant's subscription period without changing their plan.
   * Used when admin records a renewal payment.
   */
  async extendSubscription(tenantId: string, dto: ExtendSubscriptionDto, adminUserId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { subscription: true },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');
    if (!tenant.subscription) throw new BadRequestException('Tenant has no subscription');

    const months = dto.months || 1;
    const sub = tenant.subscription;
    const now = new Date();

    // Extend from current end (if still active) or from now (if expired)
    const baseDate = sub.currentPeriodEnd > now ? new Date(sub.currentPeriodEnd) : now;
    const newEnd = new Date(baseDate);
    newEnd.setMonth(newEnd.getMonth() + months);

    await this.prisma.$transaction(async (tx) => {
      await tx.subscription.update({
        where: { id: sub.id },
        data: {
          currentPeriodEnd: newEnd,
          status: 'active',
        },
      });

      // Reactivate if suspended
      if (tenant.status !== 'active') {
        await tx.tenant.update({
          where: { id: tenantId },
          data: { status: 'active', statusReason: null },
        });
      }

      // Log history
      await tx.subscriptionHistory.create({
        data: {
          tenantId,
          oldPlanId: tenant.planId,
          newPlanId: tenant.planId || '',
          action: 'extended',
          reason: dto.reason || `Extended by ${months} month(s)`,
          performedBy: adminUserId,
          metadata: { months, oldEnd: sub.currentPeriodEnd, newEnd },
        },
      });
    });

    this.eventEmitter.emit('admin.subscriptionExtended', {
      adminUserId,
      tenantId,
      months,
      newEnd,
    });

    this.logger.log(`Admin ${adminUserId} extended tenant ${tenantId} subscription by ${months} month(s) to ${newEnd.toISOString()}`);

    return { success: true, data: { newPeriodEnd: newEnd, months } };
  }

  // =========================================================================
  // PROMO CODES (Item 7, 11)
  // =========================================================================

  /**
   * List all promo codes with usage stats.
   */
  async getPromoCodes(params: { page: number; limit: number }) {
    const { page, limit } = params;
    const skip = (page - 1) * limit;

    const [codes, total] = await Promise.all([
      this.prisma.promoCode.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          linkedPlan: { select: { name: true, slug: true } },
          creator: { select: { fullName: true } },
          _count: { select: { tenants: true } },
        },
      }),
      this.prisma.promoCode.count(),
    ]);

    return {
      success: true,
      data: codes,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Create a new promo code.
   */
  async createPromoCode(dto: CreatePromoCodeDto, adminUserId: string) {
    // Check uniqueness
    const existing = await this.prisma.promoCode.findUnique({
      where: { code: dto.code },
    });
    if (existing) throw new ConflictException(`Promo code "${dto.code}" already exists`);

    // Validate linked plan if provided
    if (dto.linkedPlanId) {
      const plan = await this.prisma.subscriptionPlan.findUnique({
        where: { id: dto.linkedPlanId },
      });
      if (!plan) throw new NotFoundException('Linked plan not found');
    }

    const promo = await this.prisma.promoCode.create({
      data: {
        code: dto.code,
        linkedPlanId: dto.linkedPlanId,
        trialDays: dto.trialDays,
        discountPct: dto.discountPct,
        maxUses: dto.maxUses,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        isActive: dto.isActive ?? true,
        createdBy: adminUserId,
      },
      include: {
        linkedPlan: { select: { name: true, slug: true } },
      },
    });

    this.logger.log(`Admin ${adminUserId} created promo code: ${dto.code}`);

    return { success: true, data: promo };
  }

  /**
   * Update a promo code.
   */
  async updatePromoCode(id: string, dto: UpdatePromoCodeDto) {
    const promo = await this.prisma.promoCode.findUnique({ where: { id } });
    if (!promo) throw new NotFoundException('Promo code not found');

    if (dto.linkedPlanId) {
      const plan = await this.prisma.subscriptionPlan.findUnique({
        where: { id: dto.linkedPlanId },
      });
      if (!plan) throw new NotFoundException('Linked plan not found');
    }

    const updated = await this.prisma.promoCode.update({
      where: { id },
      data: {
        linkedPlanId: dto.linkedPlanId,
        trialDays: dto.trialDays,
        discountPct: dto.discountPct,
        maxUses: dto.maxUses,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
        isActive: dto.isActive,
      },
      include: {
        linkedPlan: { select: { name: true, slug: true } },
      },
    });

    return { success: true, data: updated };
  }

  // =========================================================================
  // SUBSCRIPTION HISTORY (Item 17)
  // =========================================================================

  /**
   * Get subscription change history for a tenant.
   */
  async getSubscriptionHistory(tenantId: string, params: { page: number; limit: number }) {
    const { page, limit } = params;
    const skip = (page - 1) * limit;

    const [entries, total] = await Promise.all([
      this.prisma.subscriptionHistory.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          oldPlan: { select: { name: true, slug: true } },
          newPlan: { select: { name: true, slug: true } },
          actor: { select: { fullName: true } },
        },
      }),
      this.prisma.subscriptionHistory.count({ where: { tenantId } }),
    ]);

    return {
      success: true,
      data: entries,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }
}
