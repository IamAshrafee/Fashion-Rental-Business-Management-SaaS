import { PrismaClient } from '@prisma/client';
import { CustomerService } from '../src/modules/customer/customer.service';

describe('customer operational domain', () => {
  const prisma = new PrismaClient();
  const service = new CustomerService(prisma as never);

  afterAll(async () => prisma.$disconnect());

  it('normalizes identities, preserves address history, records evidence, and rejects duplicate ownership', async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const owner = await prisma.user.create({ data: { fullName: 'Customer Owner', email: `customer-owner-${suffix}@example.test`, passwordHash: 'integration' } });
    const tenant = await prisma.tenant.create({ data: { businessName: 'Customer Domain Store', subdomain: `customer-${suffix}`, ownerUserId: owner.id } });
    const created = await service.create(tenant.id, {
      fullName: 'Nadia Rahman',
      identities: [
        { kind: 'phone', value: '01712-345678', isPrimary: true },
        { kind: 'email', value: `NADIA.${suffix}@Example.Test`, isPrimary: true },
      ],
      address: { addressLine1: '12 Rental Road', area: 'Dhanmondi', city: 'Dhaka', country: 'BD', isDefault: true },
      preferredContactChannel: 'whatsapp',
      note: 'Prefers an evening delivery window.',
      source: 'walk-in',
    }, owner.id);

    expect(created.primaryPhone).toBe('01712-345678');
    expect(created.identities.find((identity) => identity.kind === 'phone')?.normalizedValue).toBe('+8801712345678');
    expect(created.primaryEmail).toBe(`NADIA.${suffix}@Example.Test`);
    expect(created.defaultAddress?.area).toBe('Dhanmondi');
    expect(created.notes).toHaveLength(1);

    await expect(service.create(tenant.id, {
      fullName: 'Duplicate Nadia',
      identities: [{ kind: 'phone', value: '+880 1712 345678', isPrimary: true }],
    }, owner.id)).rejects.toMatchObject({ response: expect.objectContaining({ code: 'CUSTOMER_IDENTITY_ALREADY_EXISTS' }) });

    const resolved = await service.findOrCreateByPhone(tenant.id, '8801712345678', {
      fullName: 'Should not replace Nadia',
      email: `nadia.second.${suffix}@example.test`,
      addressLine1: '18 Second Address',
      city: 'Dhaka',
    });
    expect(resolved.id).toBe(created.id);
    const enriched = await service.getById(tenant.id, created.id);
    expect(enriched.fullName).toBe('Nadia Rahman');
    expect(enriched.addresses).toHaveLength(2);
    expect(enriched.identities).toHaveLength(3);

    const tag = await service.createTagDefinition(tenant.id, { name: 'VIP', color: 'gold' });
    await service.assignTag(tenant.id, created.id, tag.id, owner.id);
    await service.addNote(tenant.id, created.id, { body: 'Deposit waiver requires owner approval.', isPinned: true }, owner.id);
    await service.recordConsent(tenant.id, created.id, { purpose: 'rental_updates', channel: 'sms', granted: true, source: 'signed_booking_form' }, owner.id);
    const detailed = await service.getById(tenant.id, created.id);
    expect(detailed.tags.map((entry) => entry.name)).toContain('VIP');
    expect(detailed.notes[0].isPinned).toBe(true);
    expect(detailed.consents[0]).toMatchObject({ purpose: 'rental_updates', granted: true });
    expect(detailed.events.map((event) => event.type)).toEqual(expect.arrayContaining(['created', 'tag_assigned', 'note_added', 'consent_changed']));
  });

  it('merges duplicates transactionally and preserves booking ownership', async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const owner = await prisma.user.create({ data: { fullName: 'Merge Owner', email: `merge-owner-${suffix}@example.test`, passwordHash: 'integration' } });
    const tenant = await prisma.tenant.create({ data: { businessName: 'Merge Store', subdomain: `merge-${suffix}`, ownerUserId: owner.id } });
    const target = await service.create(tenant.id, { fullName: 'Primary Profile', identities: [{ kind: 'phone', value: '01812345678' }] }, owner.id);
    const source = await service.create(tenant.id, { fullName: 'Duplicate Profile', identities: [{ kind: 'email', value: `duplicate-${suffix}@example.test` }] }, owner.id);
    const booking = await prisma.booking.create({ data: {
      tenantId: tenant.id, bookingNumber: `MERGE-${suffix}`, customerId: source.id,
      paymentMethod: 'cod', subtotal: 10_000, grandTotal: 10_000,
      deliveryName: source.fullName, deliveryPhone: '01812345678',
      deliveryAddressLine1: 'Merge address', deliveryCity: 'Dhaka', deliveryCountry: 'BD',
    } });

    await expect(service.archive(tenant.id, source.id, owner.id)).rejects.toMatchObject({ response: expect.objectContaining({ code: 'CUSTOMER_HAS_ACTIVE_BOOKINGS' }) });
    await service.merge(tenant.id, target.id, { sourceCustomerId: source.id }, owner.id);
    const [movedBooking, sourceRecord, targetRecord] = await Promise.all([
      prisma.booking.findUniqueOrThrow({ where: { id: booking.id } }),
      prisma.customer.findUniqueOrThrow({ where: { id: source.id } }),
      service.getById(tenant.id, target.id),
    ]);
    expect(movedBooking.customerId).toBe(target.id);
    expect(sourceRecord).toMatchObject({ status: 'merged', mergedIntoCustomerId: target.id });
    expect(targetRecord.identities).toHaveLength(2);
    expect(targetRecord.events.some((event) => event.type === 'merged')).toBe(true);
  });
});
