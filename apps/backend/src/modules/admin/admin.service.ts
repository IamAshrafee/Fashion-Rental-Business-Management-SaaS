import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { UpdateTenantStatusDto } from './dto/update-tenant-status.dto';
import { UpdateTenantPlanDto } from './dto/update-tenant-plan.dto';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  // =========================================================================
  // TENANT MANAGEMENT
  // =========================================================================

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

    const [tenants, total] = await Promise.all([
      this.prisma.tenant.findMany({
        where,
        skip,
        take: limit,
        orderBy: sort ? { [sort]: 'desc' } : { createdAt: 'desc' },
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

    // Format the response according to api/admin.md
    const data = tenants.map(t => ({
      id: t.id,
      businessName: t.businessName,
      subdomain: t.subdomain,
      plan: t.plan?.name || 'None',
      status: t.status,
      productCount: t._count.products,
      orderCount: t._count.bookings,
      // totalRevenue could be computed if we track payment tables, but for V1 we can mock or sum payments
      totalRevenue: 0,
      ownerName: t.owner?.fullName,
      ownerPhone: t.owner?.phone,
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

  async updateTenantStatus(id: string, dto: UpdateTenantStatusDto) {
    const tenant = await this.prisma.tenant.update({
      where: { id },
      data: { status: dto.status },
    });
    return { success: true, data: tenant };
  }

  async updateTenantPlan(id: string, dto: UpdateTenantPlanDto) {
    // Determine the end date based on billing cycle
    const now = new Date();
    const periodEnd = new Date(now);
    if (dto.billingCycle === 'annual') {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    const subscription = await this.prisma.subscription.upsert({
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

    await this.prisma.tenant.update({
      where: { id },
      data: { planId: dto.planId }
    });

    return { success: true, data: subscription };
  }

  // =========================================================================
  // ANALYTICS
  // =========================================================================

  async getPlatformAnalytics() {
    const [totalTenants, activeTenants, activeSubs] = await Promise.all([
      this.prisma.tenant.count(),
      this.prisma.tenant.count({ where: { status: 'active' } }),
      this.prisma.subscription.findMany({
        where: { status: 'active' },
        include: { plan: true },
      }),
    ]);

    const mrr = activeSubs.reduce((acc, sub) => {
      const price = sub.billingCycle === 'annual' 
        ? Number(sub.plan.priceAnnual || 0) / 12 
        : Number(sub.plan.priceMonthly);
      return acc + price;
    }, 0);

    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const newThisMonth = await this.prisma.tenant.count({
      where: { createdAt: { gte: firstDayOfMonth } }
    });

    return {
      success: true,
      data: {
        tenants: { total: totalTenants, active: activeTenants, newThisMonth },
        mrr: Math.round(mrr),
        gmv: 0, // Placeholder
        churnRate: 0, // Placeholder
        totalProducts: await this.prisma.product.count(),
        totalOrders: await this.prisma.booking.count(),
      }
    };
  }

  // =========================================================================
  // IMPERSONATION
  // =========================================================================

  async impersonateTenant(adminUserId: string, tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { owner: true }
    });
    
    if (!tenant) throw new NotFoundException('Tenant not found');

    const impersonationToken = this.jwtService.sign({
      sub: tenant.owner.id,
      tenantId: tenant.id,
      role: 'owner', // Trick the system into thinking we are the owner
      sessionId: 'admin_impersonation', // Can be caught by backend if needed to prevent token refresh
    });

    return {
      success: true,
      data: {
        impersonationToken,
        tenantId: tenant.id,
        businessName: tenant.businessName,
        expiresIn: 3600 // We'll set the token expiry to 1 hr locally in sign options
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
}
