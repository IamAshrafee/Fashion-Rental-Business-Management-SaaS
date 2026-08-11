import { PrismaClient } from '@prisma/client';
import { AnalyticsService } from '../src/modules/analytics/analytics.service';
import { NotificationService } from '../src/modules/notification/notification.service';
import { StaffService } from '../src/modules/staff/staff.service';
import { SubscriptionService } from '../src/modules/tenant/subscription.service';

describe('launch hardening PostgreSQL contracts', () => {
  const prisma = new PrismaClient();
  const subscriptions = new SubscriptionService(prisma as never);
  const staff = new StaffService(prisma as never, subscriptions, { emit: jest.fn() } as never);
  const notifications = new NotificationService(prisma as never);
  const analytics = new AnalyticsService(prisma as never);

  afterAll(async () => prisma.$disconnect());

  it('uses expiring single-use staff invitations and persists scoped membership', async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const owner = await prisma.user.create({
      data: {
        fullName: 'Team Owner',
        email: `team-owner-${suffix}@example.test`,
        passwordHash: 'integration-only',
      },
    });
    const tenant = await prisma.tenant.create({
      data: { businessName: 'Team Store', subdomain: `team-${suffix}`, ownerUserId: owner.id },
    });
    const plan = await prisma.subscriptionPlan.create({
      data: {
        name: `Team Plan ${suffix}`,
        slug: `team-plan-${suffix}`,
        maxProducts: 10,
        maxOrders: 20,
        maxStaff: 2,
      },
    });
    await prisma.subscription.create({
      data: {
        tenantId: tenant.id,
        planId: plan.id,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 86_400_000),
      },
    });

    const invitation = await staff.inviteStaff(tenant.id, owner.id, {
      fullName: 'Operations Staff',
      email: `operator-${suffix}@example.test`,
      role: 'staff',
      permissions: ['manage_inventory', 'manage_bookings'],
    });
    expect(invitation.token).toHaveLength(43);
    const stored = await prisma.staffInvitation.findUniqueOrThrow({ where: { id: invitation.id } });
    expect(stored.tokenHash).not.toBe(invitation.token);

    const accepted = await staff.acceptInvitation({
      token: invitation.token,
      password: 'strong-password-2026',
    });
    expect(accepted.permissions).toEqual(['manage_inventory', 'manage_bookings']);
    expect(accepted.isActive).toBe(true);
    await expect(
      staff.acceptInvitation({ token: invitation.token, password: 'strong-password-2026' }),
    ).rejects.toThrow('invalid or expired');
  });

  it('fails closed without an entitlement and counts pending staff invitations', async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const owner = await prisma.user.create({
      data: {
        fullName: 'Unconfigured Owner',
        email: `unconfigured-${suffix}@example.test`,
        passwordHash: 'integration-only',
      },
    });
    const tenant = await prisma.tenant.create({
      data: {
        businessName: 'Unconfigured Store',
        subdomain: `unconfigured-${suffix}`,
        ownerUserId: owner.id,
      },
    });
    await expect(subscriptions.checkPlanLimit(tenant.id, 'products')).rejects.toThrow(
      'no subscription entitlement',
    );
  });

  it('keeps an idempotent SMS delivery ledger through completion', async () => {
    const tenant = await prisma.tenant.findFirstOrThrow({
      where: { subdomain: { startsWith: 'team-' } },
      orderBy: { createdAt: 'desc' },
    });
    const input = {
      tenantId: tenant.id,
      recipient: '+8801700000000',
      template: 'booking_placed',
      payload: { bookingNumber: 'BK-1', storeName: 'Team Store' },
      dedupeKey: 'booking-placed:BK-1',
    };
    const first = await notifications.createSmsDelivery(input);
    const replay = await notifications.createSmsDelivery(input);
    expect(replay.id).toBe(first.id);
    const processing = await notifications.beginSmsDelivery(first.id);
    expect(processing.attempts).toBe(1);
    await notifications.completeSmsDelivery(first.id);
    await expect(
      prisma.notificationDelivery.findUniqueOrThrow({ where: { id: first.id } }),
    ).resolves.toMatchObject({ status: 'sent', attempts: 1 });
  });

  it('exports tenant-scoped, spreadsheet-safe CSV data', async () => {
    const tenant = await prisma.tenant.findFirstOrThrow({
      where: { subdomain: { startsWith: 'team-' } },
      orderBy: { createdAt: 'desc' },
    });
    await prisma.customer.create({
      data: { tenantId: tenant.id, fullName: '=Formula Customer', source: 'integration' },
    });
    const result = await analytics.exportCsv(tenant.id, 'customers', {});
    expect(result.filename).toMatch(/^customers-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(result.csv).toContain("'=Formula Customer");
    expect(result.csv).not.toContain('Unconfigured Owner');
  });
});
