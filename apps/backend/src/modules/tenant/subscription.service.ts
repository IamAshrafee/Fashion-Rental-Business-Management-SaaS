import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Resources that can be checked against subscription plan limits.
 */
export type PlanResource = 'products' | 'staff' | 'orders';

/**
 * Subscription status result with computed fields.
 */
export interface SubscriptionStatusResult {
  isActive: boolean;
  isInTrial: boolean;
  isInGracePeriod: boolean;
  isExpired: boolean;
  daysRemaining: number;
  status: string;
}

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);

  /** Grace period in days after subscription expires (ADR-21) */
  private readonly GRACE_PERIOD_DAYS = 7;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get current subscription with full plan details.
   */
  async getCurrentSubscription(tenantId: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { tenantId },
      include: {
        plan: {
          select: {
            id: true,
            name: true,
            slug: true,
            priceMonthly: true,
            priceAnnual: true,
            maxProducts: true,
            maxOrders: true,
            maxStaff: true,
            customDomain: true,
            smsEnabled: true,
            analyticsFull: true,
            removeBranding: true,
          },
        },
      },
    });

    if (!subscription) {
      throw new NotFoundException('No subscription found for this tenant');
    }

    const statusResult = this.computeSubscriptionStatus(
      subscription.status,
      subscription.currentPeriodEnd,
      subscription.trialEndsAt,
    );

    return {
      id: subscription.id,
      planId: subscription.planId,
      plan: subscription.plan,
      status: subscription.status,
      billingCycle: subscription.billingCycle,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      trialEndsAt: subscription.trialEndsAt,
      cancelledAt: subscription.cancelledAt,
      computed: statusResult,
    };
  }

  /**
   * Check if the tenant is within plan limits for a given resource.
   * Returns { allowed: boolean, current: number, limit: number | null }.
   * limit = null means unlimited.
   */
  async checkPlanLimit(
    tenantId: string,
    resource: PlanResource,
  ): Promise<{ allowed: boolean; current: number; limit: number | null }> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { tenantId },
      include: { plan: true },
    });

    if (!subscription) {
      // No subscription — allow (free tier fallback)
      return { allowed: true, current: 0, limit: null };
    }

    let current: number;
    let limit: number | null;

    switch (resource) {
      case 'products': {
        current = await this.prisma.product.count({
          where: { tenantId, deletedAt: null },
        });
        limit = subscription.plan.maxProducts;
        break;
      }
      case 'staff': {
        current = await this.prisma.tenantUser.count({
          where: { tenantId, role: { not: 'owner' } },
        });
        limit = subscription.plan.maxStaff;
        break;
      }
      case 'orders': {
        // Enforce monthly maxOrders limit
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        
        current = await this.prisma.booking.count({
          where: { tenantId, createdAt: { gte: startOfMonth } },
        });
        limit = subscription.plan.maxOrders;
        break;
      }
      default:
        return { allowed: true, current: 0, limit: null };
    }

    // null limit = unlimited
    if (limit === null) {
      return { allowed: true, current, limit };
    }

    return {
      allowed: current < limit,
      current,
      limit,
    };
  }

  /**
   * Enforce a plan limit — throws ForbiddenException if limit reached.
   */
  async enforcePlanLimit(tenantId: string, resource: PlanResource): Promise<void> {
    const result = await this.checkPlanLimit(tenantId, resource);

    if (!result.allowed) {
      const resourceLabel = resource === 'products' ? 'products' : 'staff members';
      throw new ForbiddenException(
        `Plan limit reached: your plan allows ${result.limit} ${resourceLabel} ` +
        `(currently have ${result.current}). Please upgrade your plan.`,
      );
    }
  }

  /**
   * Get the computed subscription status for a tenant.
   */
  async getSubscriptionStatus(tenantId: string): Promise<SubscriptionStatusResult> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { tenantId },
    });

    if (!subscription) {
      return {
        isActive: true, // Default to active if no subscription (free tier)
        isInTrial: false,
        isInGracePeriod: false,
        isExpired: false,
        daysRemaining: -1,
        status: 'free_tier',
      };
    }

    return this.computeSubscriptionStatus(
      subscription.status,
      subscription.currentPeriodEnd,
      subscription.trialEndsAt,
    );
  }

  /**
   * Compute subscription status with grace period logic (ADR-21).
   * Grace: 7 days → read-only mode → 30 days → store fully offline.
   */
  private computeSubscriptionStatus(
    status: string,
    periodEnd: Date,
    trialEndsAt: Date | null,
  ): SubscriptionStatusResult {
    const now = new Date();
    const msPerDay = 24 * 60 * 60 * 1000;

    // Trial check
    if (status === 'trial' && trialEndsAt) {
      const daysRemaining = Math.ceil((trialEndsAt.getTime() - now.getTime()) / msPerDay);
      return {
        isActive: daysRemaining > 0,
        isInTrial: true,
        isInGracePeriod: false,
        isExpired: daysRemaining <= 0,
        daysRemaining: Math.max(0, daysRemaining),
        status: daysRemaining > 0 ? 'trial' : 'expired',
      };
    }

    // Active subscription
    if (status === 'active') {
      const daysRemaining = Math.ceil((periodEnd.getTime() - now.getTime()) / msPerDay);

      if (daysRemaining > 0) {
        return {
          isActive: true,
          isInTrial: false,
          isInGracePeriod: false,
          isExpired: false,
          daysRemaining,
          status: 'active',
        };
      }

      // Expired with grace period
      const daysPastExpiry = Math.ceil((now.getTime() - periodEnd.getTime()) / msPerDay);

      if (daysPastExpiry <= this.GRACE_PERIOD_DAYS) {
        return {
          isActive: true,
          isInTrial: false,
          isInGracePeriod: true,
          isExpired: false,
          daysRemaining: 0,
          status: 'grace_period',
        };
      }

      return {
        isActive: false,
        isInTrial: false,
        isInGracePeriod: false,
        isExpired: true,
        daysRemaining: 0,
        status: 'expired',
      };
    }

    // Free Tier explicit check
    if (status === 'free_tier') {
      return {
        isActive: true,
        isInTrial: false,
        isInGracePeriod: false,
        isExpired: false,
        daysRemaining: -1,
        status: 'free_tier',
      };
    }

    // Suspended explicit check
    if (status === 'suspended') {
      return {
        isActive: false,
        isInTrial: false,
        isInGracePeriod: false,
        isExpired: true,
        daysRemaining: 0,
        status: 'suspended',
      };
    }

    // Cancelled or past_due
    return {
      isActive: status === 'past_due',
      isInTrial: false,
      isInGracePeriod: status === 'past_due',
      isExpired: status === 'cancelled',
      daysRemaining: 0,
      status,
    };
  }

  /**
   * Get billing history for a tenant.
   */
  async getBillingHistory(tenantId: string) {
    const payments = await this.prisma.subscriptionPayment.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: {
        invoice: {
          select: { id: true, invoiceNo: true, status: true },
        },
      },
    });

    return { success: true, data: payments };
  }
}
