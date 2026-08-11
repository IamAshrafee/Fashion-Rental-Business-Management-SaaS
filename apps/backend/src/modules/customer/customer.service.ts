import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  CustomerAddressKind,
  CustomerEventType,
  CustomerIdentityKind,
  CustomerStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AddAddressDto,
  AddIdentityDto,
  AddNoteDto,
  CreateCustomerDto,
  CreateTagDefinitionDto,
  CustomerQueryDto,
  MergeCustomerDto,
  RecordConsentDto,
  UpdateAddressDto,
  UpdateCustomerDto,
} from './dto/customer.dto';

const CUSTOMER_SUMMARY_INCLUDE = {
  identities: { orderBy: [{ isPrimary: 'desc' as const }, { createdAt: 'asc' as const }] },
  addresses: {
    where: { archivedAt: null },
    orderBy: [{ isDefault: 'desc' as const }, { createdAt: 'desc' as const }],
  },
  tagAssignments: { include: { tag: true }, orderBy: { createdAt: 'asc' as const } },
  account: { select: { id: true, status: true, activatedAt: true, lastLoginAt: true } },
} satisfies Prisma.CustomerInclude;

type CustomerSummaryRecord = Prisma.CustomerGetPayload<{ include: typeof CUSTOMER_SUMMARY_INCLUDE }>;
type BookingCustomerInput = {
  fullName?: string;
  altPhone?: string;
  email?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
};

@Injectable()
export class CustomerService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateCustomerDto, actorId?: string) {
    const identities = this.normalizeIdentityInputs(dto.identities);
    const duplicate = await this.prisma.customerIdentity.findFirst({
      where: {
        tenantId,
        OR: identities.map((identity) => ({
          kind: identity.kind,
          normalizedValue: identity.normalizedValue,
        })),
      },
      include: { customer: { select: { id: true, fullName: true, status: true } } },
    });
    if (duplicate) {
      throw new ConflictException({
        code: 'CUSTOMER_IDENTITY_ALREADY_EXISTS',
        message: 'That phone number or email already belongs to a customer',
        customer: duplicate.customer,
      });
    }

    const customerId = await this.prisma.$transaction(async (tx) => {
      const customer = await tx.customer.create({
        data: {
          tenantId,
          fullName: dto.fullName.trim(),
          preferredContactChannel: dto.preferredContactChannel,
          preferredLocale: dto.preferredLocale?.trim(),
          source: dto.source?.trim(),
        },
      });
      await tx.customerIdentity.createMany({
        data: identities.map((identity, index) => ({
          tenantId,
          customerId: customer.id,
          ...identity,
          isPrimary: identity.isPrimary || !identities.some((entry) => entry.kind === identity.kind && entry.isPrimary)
            && identities.findIndex((entry) => entry.kind === identity.kind) === index,
        })),
      });
      if (dto.address) {
        await tx.customerAddress.create({
          data: this.addressCreateData(tenantId, customer.id, dto.address, true),
        });
      }
      if (dto.note?.trim()) {
        await tx.customerNote.create({
          data: { tenantId, customerId: customer.id, body: dto.note.trim(), createdBy: actorId },
        });
      }
      await this.recordEvent(tx, tenantId, customer.id, 'created', 'Customer profile created', actorId, {
        source: dto.source ?? null,
      });
      return customer.id;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return this.getById(tenantId, customerId);
  }

  async findOrCreateByPhone(tenantId: string, phone: string, data: BookingCustomerInput) {
    const normalizedPhone = this.normalizePhone(phone);
    const existing = await this.prisma.customerIdentity.findUnique({
      where: {
        tenantId_kind_normalizedValue: {
          tenantId,
          kind: CustomerIdentityKind.phone,
          normalizedValue: normalizedPhone,
        },
      },
      include: { customer: true },
    });
    if (existing) {
      if (existing.customer.status === CustomerStatus.blocked
        || existing.customer.status === CustomerStatus.archived
        || existing.customer.status === CustomerStatus.anonymized) {
        throw new UnprocessableEntityException({
          code: 'CUSTOMER_NOT_BOOKABLE',
          message: `This customer profile is ${existing.customer.status}`,
        });
      }
      await this.enrichCustomerFromBooking(tenantId, existing.customer.id, data);
      return existing.customer;
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const customer = await tx.customer.create({
          data: { tenantId, fullName: data.fullName?.trim() || 'Guest customer', source: 'booking' },
        });
        await tx.customerIdentity.create({
          data: {
            tenantId,
            customerId: customer.id,
            kind: CustomerIdentityKind.phone,
            value: phone.trim(),
            normalizedValue: normalizedPhone,
            isPrimary: true,
          },
        });
        if (data.email) await this.tryAddEmail(tx, tenantId, customer.id, data.email);
        if (data.altPhone) await this.tryAddPhone(tx, tenantId, customer.id, data.altPhone, false);
        if (data.addressLine1) {
          await tx.customerAddress.create({
            data: {
              tenantId,
              customerId: customer.id,
              kind: CustomerAddressKind.delivery,
              recipientName: data.fullName,
              phone,
              addressLine1: data.addressLine1,
              addressLine2: data.addressLine2,
              city: data.city,
              state: data.state,
              postalCode: data.postalCode,
              country: data.country || 'BD',
              isDefault: true,
              lastUsedAt: new Date(),
            },
          });
        }
        await this.recordEvent(tx, tenantId, customer.id, 'created', 'Customer created during booking', undefined, {
          source: 'booking',
        });
        return customer;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const resolved = await this.prisma.customerIdentity.findUnique({
          where: { tenantId_kind_normalizedValue: { tenantId, kind: CustomerIdentityKind.phone, normalizedValue: normalizedPhone } },
          include: { customer: true },
        });
        if (resolved) return resolved.customer;
      }
      throw error;
    }
  }

  async getById(tenantId: string, customerId: string) {
    const [customer, totalBookingCount] = await Promise.all([
      this.prisma.customer.findFirst({
        where: { id: customerId, tenantId },
        include: {
          ...CUSTOMER_SUMMARY_INCLUDE,
          notes: { orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }], take: 100 },
          consents: { orderBy: { recordedAt: 'desc' }, take: 100 },
          events: { orderBy: { occurredAt: 'desc' }, take: 100 },
          bookings: {
            orderBy: { createdAt: 'desc' },
            take: 50,
            select: {
              id: true, bookingNumber: true, status: true, grandTotal: true, paymentStatus: true,
              rentalStartDate: true, rentalEndDate: true, createdAt: true,
              items: { select: { productName: true, colorName: true } },
            },
          },
        },
      }),
      this.prisma.booking.count({ where: { customerId, tenantId } }),
    ]);
    if (!customer) throw new NotFoundException('Customer not found');
    return { ...this.projectCustomer(customer), notes: customer.notes, consents: customer.consents, events: customer.events, bookings: customer.bookings, totalBookingCount };
  }

  async update(tenantId: string, customerId: string, dto: UpdateCustomerDto, actorId?: string) {
    await this.requireCustomer(tenantId, customerId);
    await this.prisma.$transaction(async (tx) => {
      await tx.customer.update({
        where: { id: customerId },
        data: {
          fullName: dto.fullName?.trim(), status: dto.status,
          preferredContactChannel: dto.preferredContactChannel,
          preferredLocale: dto.preferredLocale?.trim(), source: dto.source?.trim(),
          archivedAt: dto.status === CustomerStatus.archived ? new Date() : dto.status ? null : undefined,
        },
      });
      await this.recordEvent(tx, tenantId, customerId, 'profile_updated', 'Customer profile updated', actorId, dto as Prisma.InputJsonValue);
    });
    return this.getById(tenantId, customerId);
  }

  async list(tenantId: string, query: CustomerQueryDto) {
    const page = query.page || 1;
    const limit = Math.min(query.limit || 25, 100);
    const where: Prisma.CustomerWhereInput = {
      tenantId,
      status: query.status ?? { notIn: [CustomerStatus.merged, CustomerStatus.anonymized] },
      ...(query.tagId ? { tagAssignments: { some: { tagId: query.tagId } } } : {}),
      ...(query.hasAccount !== undefined ? { account: query.hasAccount ? { isNot: null } : { is: null } } : {}),
    };
    if (query.search?.trim()) {
      const search = query.search.trim();
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { identities: { some: { OR: [{ value: { contains: search, mode: 'insensitive' } }, { normalizedValue: { contains: search.toLowerCase() } }] } } },
      ];
    }
    const [customers, total] = await Promise.all([
      this.prisma.customer.findMany({
        where, skip: (page - 1) * limit, take: limit,
        orderBy: [this.buildOrderBy(query.sort, query.order), { id: 'asc' }],
        include: CUSTOMER_SUMMARY_INCLUDE,
      }),
      this.prisma.customer.count({ where }),
    ]);
    return { data: customers.map((customer) => this.projectCustomer(customer)), meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async lookupByPhone(tenantId: string, phone: string) {
    let normalized: string;
    try { normalized = this.normalizePhone(phone); } catch { return { found: false, customer: null }; }
    const identity = await this.prisma.customerIdentity.findUnique({
      where: { tenantId_kind_normalizedValue: { tenantId, kind: CustomerIdentityKind.phone, normalizedValue: normalized } },
      include: { customer: { include: CUSTOMER_SUMMARY_INCLUDE } },
    });
    return { found: !!identity, customer: identity ? this.projectCustomer(identity.customer) : null };
  }

  async addIdentity(tenantId: string, customerId: string, dto: AddIdentityDto, actorId?: string) {
    await this.requireCustomer(tenantId, customerId);
    const normalizedValue = this.normalizeIdentity(dto.kind, dto.value);
    try {
      await this.prisma.$transaction(async (tx) => {
        if (dto.isPrimary) await tx.customerIdentity.updateMany({ where: { tenantId, customerId, kind: dto.kind }, data: { isPrimary: false } });
        const existingCount = await tx.customerIdentity.count({ where: { tenantId, customerId, kind: dto.kind } });
        await tx.customerIdentity.create({ data: { tenantId, customerId, kind: dto.kind, value: dto.value.trim(), normalizedValue, isPrimary: dto.isPrimary ?? existingCount === 0 } });
        await this.recordEvent(tx, tenantId, customerId, 'identity_added', `${dto.kind} added`, actorId, { kind: dto.kind });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException({ code: 'CUSTOMER_IDENTITY_ALREADY_EXISTS', message: 'That identity already belongs to a customer' });
      throw error;
    }
    return this.getById(tenantId, customerId);
  }

  async setPrimaryIdentity(tenantId: string, customerId: string, identityId: string) {
    const identity = await this.prisma.customerIdentity.findFirst({ where: { id: identityId, customerId, tenantId } });
    if (!identity) throw new NotFoundException('Customer identity not found');
    await this.prisma.$transaction([
      this.prisma.customerIdentity.updateMany({ where: { customerId, tenantId, kind: identity.kind }, data: { isPrimary: false } }),
      this.prisma.customerIdentity.update({ where: { id: identityId }, data: { isPrimary: true } }),
    ]);
    return this.getById(tenantId, customerId);
  }

  async removeIdentity(tenantId: string, customerId: string, identityId: string) {
    const identity = await this.prisma.customerIdentity.findFirst({ where: { id: identityId, customerId, tenantId } });
    if (!identity) throw new NotFoundException('Customer identity not found');
    const count = await this.prisma.customerIdentity.count({ where: { customerId, tenantId } });
    if (count <= 1) throw new UnprocessableEntityException({ code: 'LAST_CUSTOMER_IDENTITY', message: 'A customer must retain at least one identity' });
    if (identity.isPrimary) throw new UnprocessableEntityException({ code: 'PRIMARY_IDENTITY', message: 'Choose another primary identity before removing this one' });
    await this.prisma.customerIdentity.delete({ where: { id: identityId } });
    return this.getById(tenantId, customerId);
  }

  async addAddress(tenantId: string, customerId: string, dto: AddAddressDto, actorId?: string) {
    await this.requireCustomer(tenantId, customerId);
    const kind = dto.kind ?? CustomerAddressKind.delivery;
    const count = await this.prisma.customerAddress.count({ where: { tenantId, customerId, kind, archivedAt: null } });
    await this.prisma.$transaction(async (tx) => {
      if (dto.isDefault || count === 0) await tx.customerAddress.updateMany({ where: { tenantId, customerId, kind, archivedAt: null }, data: { isDefault: false } });
      await tx.customerAddress.create({ data: this.addressCreateData(tenantId, customerId, dto, dto.isDefault || count === 0) });
      await this.recordEvent(tx, tenantId, customerId, 'address_added', 'Customer address added', actorId, { kind });
    });
    return this.getById(tenantId, customerId);
  }

  async updateAddress(tenantId: string, customerId: string, addressId: string, dto: UpdateAddressDto) {
    const address = await this.prisma.customerAddress.findFirst({ where: { id: addressId, customerId, tenantId, archivedAt: null } });
    if (!address) throw new NotFoundException('Customer address not found');
    const nextKind = dto.kind ?? address.kind;
    await this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) await tx.customerAddress.updateMany({ where: { tenantId, customerId, kind: nextKind, archivedAt: null }, data: { isDefault: false } });
      await tx.customerAddress.update({ where: { id: addressId }, data: { ...dto, kind: nextKind, country: dto.country?.toUpperCase() } });
    });
    return this.getById(tenantId, customerId);
  }

  async archiveAddress(tenantId: string, customerId: string, addressId: string) {
    const address = await this.prisma.customerAddress.findFirst({ where: { id: addressId, customerId, tenantId, archivedAt: null } });
    if (!address) throw new NotFoundException('Customer address not found');
    await this.prisma.customerAddress.update({ where: { id: addressId }, data: { archivedAt: new Date(), isDefault: false } });
    return this.getById(tenantId, customerId);
  }

  async createTagDefinition(tenantId: string, dto: CreateTagDefinitionDto) {
    return this.prisma.customerTagDefinition.upsert({
      where: { tenantId_name: { tenantId, name: dto.name.trim() } },
      create: { tenantId, name: dto.name.trim(), color: dto.color }, update: { color: dto.color },
    });
  }

  async listTenantTags(tenantId: string) {
    return this.prisma.customerTagDefinition.findMany({ where: { tenantId }, orderBy: { name: 'asc' }, include: { _count: { select: { assignments: true } } } });
  }

  async assignTag(tenantId: string, customerId: string, tagId: string, actorId?: string) {
    const [customer, tag] = await Promise.all([this.requireCustomer(tenantId, customerId), this.prisma.customerTagDefinition.findFirst({ where: { id: tagId, tenantId } })]);
    if (!tag) throw new NotFoundException('Customer tag not found');
    await this.prisma.$transaction(async (tx) => {
      await tx.customerTagAssignment.upsert({ where: { customerId_tagId: { customerId: customer.id, tagId } }, create: { tenantId, customerId, tagId, assignedBy: actorId }, update: {} });
      await this.recordEvent(tx, tenantId, customerId, 'tag_assigned', `Tag “${tag.name}” assigned`, actorId, { tagId });
    });
    return this.getById(tenantId, customerId);
  }

  async unassignTag(tenantId: string, customerId: string, tagId: string) {
    await this.requireCustomer(tenantId, customerId);
    await this.prisma.customerTagAssignment.deleteMany({ where: { tenantId, customerId, tagId } });
    return this.getById(tenantId, customerId);
  }

  async addNote(tenantId: string, customerId: string, dto: AddNoteDto, actorId?: string) {
    await this.requireCustomer(tenantId, customerId);
    await this.prisma.$transaction(async (tx) => {
      await tx.customerNote.create({ data: { tenantId, customerId, body: dto.body.trim(), isPinned: dto.isPinned ?? false, createdBy: actorId } });
      await this.recordEvent(tx, tenantId, customerId, 'note_added', 'Internal note added', actorId);
    });
    return this.getById(tenantId, customerId);
  }

  async recordConsent(tenantId: string, customerId: string, dto: RecordConsentDto, actorId?: string) {
    await this.requireCustomer(tenantId, customerId);
    await this.prisma.$transaction(async (tx) => {
      await tx.customerConsent.create({ data: { tenantId, customerId, purpose: dto.purpose.trim(), channel: dto.channel, granted: dto.granted, source: dto.source.trim(), recordedBy: actorId } });
      await this.recordEvent(tx, tenantId, customerId, 'consent_changed', `${dto.purpose}: ${dto.granted ? 'granted' : 'revoked'}`, actorId, { purpose: dto.purpose, granted: dto.granted });
    });
    return this.getById(tenantId, customerId);
  }

  async archive(tenantId: string, customerId: string, actorId?: string) {
    await this.assertNoActiveBookings(tenantId, customerId);
    await this.prisma.$transaction(async (tx) => {
      await tx.customer.update({ where: { id: customerId }, data: { status: CustomerStatus.archived, archivedAt: new Date() } });
      await this.recordEvent(tx, tenantId, customerId, 'archived', 'Customer archived', actorId);
    });
    return { id: customerId, status: CustomerStatus.archived };
  }

  async anonymize(tenantId: string, customerId: string, actorId?: string) {
    await this.assertNoActiveBookings(tenantId, customerId);
    await this.prisma.$transaction(async (tx) => {
      await tx.customerAccount.deleteMany({ where: { tenantId, customerId } });
      await tx.customerIdentity.deleteMany({ where: { tenantId, customerId } });
      await tx.customerAddress.deleteMany({ where: { tenantId, customerId } });
      await tx.customerNote.deleteMany({ where: { tenantId, customerId } });
      await tx.customerConsent.deleteMany({ where: { tenantId, customerId } });
      await tx.customerTagAssignment.deleteMany({ where: { tenantId, customerId } });
      await tx.customer.update({ where: { id: customerId }, data: { fullName: `Anonymized customer ${customerId.slice(0, 8)}`, status: CustomerStatus.anonymized, source: null, archivedAt: new Date() } });
      await this.recordEvent(tx, tenantId, customerId, 'anonymized', 'Personal customer data anonymized', actorId);
    });
    return { id: customerId, status: CustomerStatus.anonymized };
  }

  async merge(tenantId: string, targetCustomerId: string, dto: MergeCustomerDto, actorId?: string) {
    if (targetCustomerId === dto.sourceCustomerId) throw new BadRequestException('A customer cannot be merged into itself');
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT id FROM customers WHERE tenant_id = ${tenantId} AND id IN (${Prisma.join([targetCustomerId, dto.sourceCustomerId])}) FOR UPDATE`);
      const customers = await tx.customer.findMany({ where: { tenantId, id: { in: [targetCustomerId, dto.sourceCustomerId] }, status: { notIn: [CustomerStatus.merged, CustomerStatus.anonymized] } }, include: { account: true } });
      if (customers.length !== 2) throw new NotFoundException('Both active customer profiles are required');
      if (customers.every((customer) => customer.account)) throw new ConflictException({ code: 'CUSTOMER_ACCOUNT_MERGE_REQUIRED', message: 'Both profiles have customer accounts; resolve account ownership before merging' });
      if (customers.find((customer) => customer.id === dto.sourceCustomerId)?.account) {
        await tx.customerAccount.update({ where: { customerId: dto.sourceCustomerId }, data: { customerId: targetCustomerId } });
      }
      const sourceTags = await tx.customerTagAssignment.findMany({ where: { tenantId, customerId: dto.sourceCustomerId } });
      for (const assignment of sourceTags) {
        await tx.customerTagAssignment.upsert({ where: { customerId_tagId: { customerId: targetCustomerId, tagId: assignment.tagId } }, create: { tenantId, customerId: targetCustomerId, tagId: assignment.tagId, assignedBy: actorId }, update: {} });
      }
      await tx.customerTagAssignment.deleteMany({ where: { tenantId, customerId: dto.sourceCustomerId } });
      await tx.customerIdentity.updateMany({ where: { tenantId, customerId: dto.sourceCustomerId }, data: { customerId: targetCustomerId, isPrimary: false } });
      await tx.customerAddress.updateMany({ where: { tenantId, customerId: dto.sourceCustomerId }, data: { customerId: targetCustomerId, isDefault: false } });
      await tx.customerNote.updateMany({ where: { tenantId, customerId: dto.sourceCustomerId }, data: { customerId: targetCustomerId } });
      await tx.customerConsent.updateMany({ where: { tenantId, customerId: dto.sourceCustomerId }, data: { customerId: targetCustomerId } });
      await tx.booking.updateMany({ where: { tenantId, customerId: dto.sourceCustomerId }, data: { customerId: targetCustomerId } });
      await tx.review.updateMany({ where: { tenantId, customerId: dto.sourceCustomerId }, data: { customerId: targetCustomerId } });
      await tx.customer.update({ where: { id: dto.sourceCustomerId }, data: { status: CustomerStatus.merged, mergedIntoCustomerId: targetCustomerId, archivedAt: new Date() } });
      await this.recordEvent(tx, tenantId, targetCustomerId, 'merged', 'Duplicate customer profile merged', actorId, { sourceCustomerId: dto.sourceCustomerId });
      return { targetCustomerId, sourceCustomerId: dto.sourceCustomerId };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async incrementBookingCount(customerId: string, tenantId: string) {
    await this.recalculateMetrics(customerId, tenantId, CustomerEventType.booking_created);
  }

  async incrementTotalSpent(customerId: string, _amount: number, tenantId: string) {
    await this.recalculateMetrics(customerId, tenantId, CustomerEventType.payment_recorded);
  }

  private async recalculateMetrics(customerId: string, tenantId: string, eventType: CustomerEventType) {
    const [bookings, payments] = await Promise.all([
      this.prisma.booking.findMany({ where: { tenantId, customerId, status: { not: 'cancelled' } }, select: { createdAt: true }, orderBy: { createdAt: 'desc' } }),
      this.prisma.payment.findMany({ where: { tenantId, status: { in: ['verified', 'refunded'] }, booking: { customerId } }, select: { amount: true, refundAmount: true } }),
    ]);
    const totalSpent = payments.reduce((sum, payment) => sum + Math.max(0, payment.amount - (payment.refundAmount ?? 0)), 0);
    await this.prisma.$transaction([
      this.prisma.customer.updateMany({ where: { id: customerId, tenantId }, data: { totalBookings: bookings.length, totalSpent, lastBookingAt: bookings[0]?.createdAt ?? null } }),
      this.prisma.customerEvent.create({ data: { tenantId, customerId, type: eventType, summary: eventType === CustomerEventType.booking_created ? 'Booking activity updated' : 'Payment activity updated' } }),
    ]);
  }

  private async enrichCustomerFromBooking(tenantId: string, customerId: string, data: BookingCustomerInput) {
    await this.prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findUniqueOrThrow({ where: { id: customerId } });
      if (data.fullName && customer.fullName === 'Guest customer') await tx.customer.update({ where: { id: customerId }, data: { fullName: data.fullName.trim() } });
      if (data.email) await this.tryAddEmail(tx, tenantId, customerId, data.email);
      if (data.altPhone) await this.tryAddPhone(tx, tenantId, customerId, data.altPhone, false);
      if (data.addressLine1) {
        const existingAddress = await tx.customerAddress.findFirst({ where: { tenantId, customerId, archivedAt: null, addressLine1: data.addressLine1, city: data.city } });
        if (existingAddress) await tx.customerAddress.update({ where: { id: existingAddress.id }, data: { lastUsedAt: new Date() } });
        else await tx.customerAddress.create({ data: { tenantId, customerId, kind: CustomerAddressKind.delivery, recipientName: data.fullName, addressLine1: data.addressLine1, addressLine2: data.addressLine2, city: data.city, state: data.state, postalCode: data.postalCode, country: data.country || 'BD', lastUsedAt: new Date() } });
      }
    });
  }

  private async tryAddEmail(tx: Prisma.TransactionClient, tenantId: string, customerId: string, email: string) {
    const normalizedValue = this.normalizeEmail(email);
    const existing = await tx.customerIdentity.findUnique({ where: { tenantId_kind_normalizedValue: { tenantId, kind: CustomerIdentityKind.email, normalizedValue } } });
    if (!existing) await tx.customerIdentity.create({ data: { tenantId, customerId, kind: CustomerIdentityKind.email, value: email.trim(), normalizedValue, isPrimary: !(await tx.customerIdentity.count({ where: { customerId, kind: CustomerIdentityKind.email } })) } });
  }

  private async tryAddPhone(tx: Prisma.TransactionClient, tenantId: string, customerId: string, phone: string, isPrimary: boolean) {
    const normalizedValue = this.normalizePhone(phone);
    const existing = await tx.customerIdentity.findUnique({ where: { tenantId_kind_normalizedValue: { tenantId, kind: CustomerIdentityKind.phone, normalizedValue } } });
    if (!existing) await tx.customerIdentity.create({ data: { tenantId, customerId, kind: CustomerIdentityKind.phone, value: phone.trim(), normalizedValue, isPrimary } });
  }

  private normalizeIdentityInputs(inputs: CreateCustomerDto['identities']) {
    const normalized = inputs.map((identity) => ({ kind: identity.kind, value: identity.value.trim(), normalizedValue: this.normalizeIdentity(identity.kind, identity.value), isPrimary: identity.isPrimary ?? false }));
    const seen = new Set<string>();
    for (const identity of normalized) {
      const key = `${identity.kind}:${identity.normalizedValue}`;
      if (seen.has(key)) throw new BadRequestException('Duplicate identity in customer request');
      seen.add(key);
    }
    for (const kind of [CustomerIdentityKind.phone, CustomerIdentityKind.email]) {
      if (normalized.filter((identity) => identity.kind === kind && identity.isPrimary).length > 1) throw new BadRequestException(`Only one primary ${kind} is allowed`);
    }
    return normalized;
  }

  private normalizeIdentity(kind: CustomerIdentityKind, value: string) {
    return kind === CustomerIdentityKind.phone ? this.normalizePhone(value) : this.normalizeEmail(value);
  }

  private normalizeEmail(value: string) {
    const normalized = value.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw new BadRequestException('Enter a valid email address');
    return normalized;
  }

  private normalizePhone(value: string) {
    let digits = value.trim().replace(/[^\d+]/g, '');
    if (digits.startsWith('+')) digits = digits.slice(1);
    else if (digits.startsWith('00')) digits = digits.slice(2);
    else if (/^01\d{9}$/.test(digits)) digits = `88${digits}`;
    else if (/^1\d{9}$/.test(digits)) digits = `880${digits}`;
    if (!/^\d{8,15}$/.test(digits)) throw new BadRequestException('Enter a valid phone number including country code');
    return `+${digits}`;
  }

  private addressCreateData(tenantId: string, customerId: string, dto: AddAddressDto, isDefault: boolean): Prisma.CustomerAddressUncheckedCreateInput {
    return { tenantId, customerId, kind: dto.kind ?? CustomerAddressKind.delivery, label: dto.label?.trim(), recipientName: dto.recipientName?.trim(), phone: dto.phone?.trim(), addressLine1: dto.addressLine1.trim(), addressLine2: dto.addressLine2?.trim(), area: dto.area?.trim(), city: dto.city?.trim(), state: dto.state?.trim(), postalCode: dto.postalCode?.trim(), country: dto.country?.toUpperCase() || 'BD', instructions: dto.instructions?.trim(), isDefault };
  }

  private projectCustomer(customer: CustomerSummaryRecord) {
    const primaryPhone = customer.identities.find((identity) => identity.kind === CustomerIdentityKind.phone && identity.isPrimary)
      ?? customer.identities.find((identity) => identity.kind === CustomerIdentityKind.phone);
    const primaryEmail = customer.identities.find((identity) => identity.kind === CustomerIdentityKind.email && identity.isPrimary)
      ?? customer.identities.find((identity) => identity.kind === CustomerIdentityKind.email);
    return { ...customer, primaryPhone: primaryPhone?.value ?? null, normalizedPhone: primaryPhone?.normalizedValue ?? null, primaryEmail: primaryEmail?.value ?? null, defaultAddress: customer.addresses.find((address) => address.isDefault) ?? customer.addresses[0] ?? null, tags: customer.tagAssignments.map((assignment) => assignment.tag), tagAssignments: undefined };
  }

  private async requireCustomer(tenantId: string, customerId: string) {
    const customer = await this.prisma.customer.findFirst({ where: { id: customerId, tenantId, status: { notIn: [CustomerStatus.merged, CustomerStatus.anonymized] } } });
    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }

  private async assertNoActiveBookings(tenantId: string, customerId: string) {
    await this.requireCustomer(tenantId, customerId);
    const activeBookings = await this.prisma.booking.count({ where: { tenantId, customerId, status: { notIn: ['cancelled', 'completed'] } } });
    if (activeBookings) throw new UnprocessableEntityException({ code: 'CUSTOMER_HAS_ACTIVE_BOOKINGS', message: `Customer has ${activeBookings} active booking${activeBookings === 1 ? '' : 's'}` });
  }

  private async recordEvent(tx: Prisma.TransactionClient, tenantId: string, customerId: string, type: CustomerEventType, summary: string, actorId?: string, data?: Prisma.InputJsonValue) {
    await tx.customerEvent.create({ data: { tenantId, customerId, type, summary, actorId, data } });
  }

  private buildOrderBy(sort?: string, order?: string): Prisma.CustomerOrderByWithRelationInput {
    const direction: Prisma.SortOrder = order === 'asc' ? 'asc' : 'desc';
    if (sort === 'name') return { fullName: direction };
    if (sort === 'total_bookings') return { totalBookings: direction };
    if (sort === 'total_spent') return { totalSpent: direction };
    if (sort === 'last_booking_at') return { lastBookingAt: direction };
    return { updatedAt: 'desc' };
  }
}
