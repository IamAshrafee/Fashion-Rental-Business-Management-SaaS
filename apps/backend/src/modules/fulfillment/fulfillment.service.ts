import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import {
  Prisma,
  ShipmentProvider,
  ShipmentStatus,
} from '@prisma/client';
import { createHash, randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { BookingService } from '../booking/booking.service';
import { ManualAdapter } from './providers/manual.adapter';
import { PathaoAdapter, normalisePathaoStatus } from './providers/pathao.adapter';
import { SteadfastAdapter } from './providers/steadfast.adapter';
import {
  COURIER_STATUS_LABELS,
  COURIER_STATUS_TO_STAGE,
  CourierSettings,
  CourierStatusSlug,
  DeliveryStageGroup,
  DistrictLeadDaysConfig,
  ParcelResult,
  ShippingRate,
  TrackingResult,
} from './providers/courier-provider.interface';
import {
  CalculateRateDto,
  CourierProviderEnum,
  DeliveryStageEnum,
  PathaoWebhookPayload,
  ShipOrderDto,
  SteadfastWebhookPayload,
  UpdateDeliveryStageDto,
} from './dto/fulfillment.dto';

const TERMINAL_SHIPMENT_STATUSES: ShipmentStatus[] = [
  'delivered',
  'returned_to_sender',
  'cancelled',
];

const ACTIVE_SHIPMENT_STATUSES: ShipmentStatus[] = [
  'pickup_pending',
  'pickup_assigned',
  'picked_up',
  'at_hub',
  'in_transit',
  'at_destination',
  'out_for_delivery',
  'on_hold',
  'unknown',
];

@Injectable()
export class FulfillmentService {
  private readonly logger = new Logger(FulfillmentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly bookingService: BookingService,
    private readonly pathaoAdapter: PathaoAdapter,
    private readonly steadfastAdapter: SteadfastAdapter,
    private readonly manualAdapter: ManualAdapter,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async sendPickupNow(
    tenantId: string,
    bookingId: string,
    dto?: ShipOrderDto,
  ) {
    const booking = await this.getShippableBooking(tenantId, bookingId);
    if (booking.status !== 'confirmed') {
      throw new BadRequestException(`Booking must be confirmed before dispatch. Current status: ${booking.status}`);
    }

    const provider = (dto?.courierProvider ?? await this.defaultProvider(tenantId)) as ShipmentProvider;
    const useApi = dto?.useApi ?? provider !== 'manual';
    if (provider === 'manual' && useApi) {
      throw new BadRequestException('Manual delivery cannot use a courier API');
    }
    if (!useApi && provider !== 'manual' && !dto?.trackingNumber?.trim()) {
      throw new BadRequestException('A tracking number is required when recording a courier shipment manually');
    }

    let shipment = await this.prisma.shipment.findFirst({
      where: {
        tenantId,
        bookingId,
        direction: 'OUTBOUND',
        status: { notIn: TERMINAL_SHIPMENT_STATUSES },
      },
      include: { events: { orderBy: { occurredAt: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
    if (!shipment) shipment = await this.createPreparedShipment(tenantId, bookingId, provider);
    if (shipment.providerReference || shipment.trackingNumber) {
      throw new ConflictException({
        code: 'SHIPMENT_ALREADY_DISPATCHED',
        message: `Shipment already has tracking ${shipment.trackingNumber ?? shipment.providerReference}`,
      });
    }
    if (!['prepare_parcel', 'error', 'pickup_failed'].includes(shipment.status)) {
      throw new ConflictException({
        code: 'SHIPMENT_DISPATCH_IN_PROGRESS',
        message: `Shipment is already ${shipment.status.replaceAll('_', ' ')}`,
      });
    }

    const codAmount = dto?.codAmount ?? (
      booking.paymentMethod === 'cod' ? Math.max(0, booking.grandTotal - booking.totalPaid) : 0
    );
    if (codAmount > Math.max(0, booking.grandTotal - booking.totalPaid)) {
      throw new BadRequestException('COD collection cannot exceed the remaining booking balance');
    }

    await this.transitionShipment(shipment.id, tenantId, 'pickup_pending', {
      label: 'Dispatch request submitted',
      source: 'system',
      dedupeKey: `dispatch:${randomUUID()}`,
      update: {
        provider,
        codAmount,
        specialInstruction: dto?.specialInstruction?.trim() || null,
        pickupRequestedAt: new Date(),
        failedReason: null,
      },
    });

    let parcel: ParcelResult | undefined;
    let trackingNumber = dto?.trackingNumber?.trim() || null;
    try {
      const params = {
        merchantOrderId: `${booking.bookingNumber}-${shipment.id.slice(0, 8)}`,
        recipientName: booking.deliveryName,
        recipientPhone: booking.deliveryPhone,
        recipientAddress: booking.deliveryAddressLine1,
        recipientCity: booking.deliveryCity,
        recipientZone: this.deliveryZone(booking.deliveryExtra),
        codAmount,
        specialInstruction: dto?.specialInstruction,
        itemQuantity: booking.items.reduce((sum, item) => sum + item.quantity, 0),
        weightKg: Math.max(0.5, booking.items.reduce((sum, item) => sum + item.quantity, 0) * 0.5),
      };
      if (useApi) {
        const settings = await this.getTenantCourierSettings(tenantId);
        if (provider === 'pathao') {
          if (!settings.pathao?.enabled) throw new BadRequestException('Pathao is not completely configured');
          parcel = await this.pathaoAdapter.createParcel(params, settings.pathao);
        } else if (provider === 'steadfast') {
          if (!settings.steadfast?.enabled) throw new BadRequestException('Steadfast is not completely configured');
          parcel = await this.steadfastAdapter.createParcel(params, settings.steadfast);
        }
        trackingNumber = parcel?.trackingId ?? null;
      } else if (provider === 'manual') {
        parcel = await this.manualAdapter.createParcel(params);
        trackingNumber = trackingNumber ?? parcel.trackingId;
      }

      shipment = await this.prisma.shipment.update({
        where: { id: shipment.id },
        data: {
          provider,
          providerReference: parcel?.trackingId ?? trackingNumber,
          trackingNumber,
          chargedFee: parcel?.deliveryFee ?? null,
          rawCreateResponse: parcel?.raw === undefined ? Prisma.DbNull : parcel.raw as Prisma.InputJsonValue,
          lastSyncedAt: new Date(),
        },
        include: { events: { orderBy: { occurredAt: 'asc' } } },
      });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Courier dispatch failed';
      await this.transitionShipment(shipment.id, tenantId, 'error', {
        label: `Dispatch failed: ${message}`,
        source: 'system',
        dedupeKey: `dispatch-error:${randomUUID()}`,
        update: { failedReason: message },
      });
      this.eventEmitter.emit('fulfillment.pickupFailed', {
        tenantId,
        bookingId,
        bookingNumber: booking.bookingNumber,
        error: message,
      });
      throw cause;
    }

    this.eventEmitter.emit('fulfillment.pickupRequested', {
      tenantId,
      bookingId,
      bookingNumber: booking.bookingNumber,
      courierProvider: provider,
      trackingNumber,
    });
    return this.toDeliveryProjection(shipment, booking);
  }

  async updateDeliveryStage(tenantId: string, bookingId: string, dto: UpdateDeliveryStageDto) {
    const booking = await this.getShippableBooking(tenantId, bookingId);
    const shipment = await this.prisma.shipment.findFirst({
      where: { tenantId, bookingId, direction: 'OUTBOUND' },
      orderBy: { createdAt: 'desc' },
    });
    if (!shipment) throw new NotFoundException('Shipment has not been prepared');
    const statusByStage: Record<DeliveryStageEnum, ShipmentStatus> = {
      prepare_parcel: 'prepare_parcel',
      awaiting_pickup: 'pickup_pending',
      in_transit: 'in_transit',
      delivered: 'delivered',
      error: 'error',
    };
    const status = statusByStage[dto.stage];
    await this.transitionShipment(shipment.id, tenantId, status, {
      label: dto.reason?.trim() || COURIER_STATUS_LABELS[status],
      source: 'manual',
      dedupeKey: `manual:${status}:${randomUUID()}`,
      update: {
        failedReason: status === 'error' ? dto.reason?.trim() || 'Manually marked as error' : null,
        deliveredAt: status === 'delivered' ? new Date() : undefined,
      },
    });
    let bookingStatus = booking.status;
    if (status === 'delivered' && booking.status === 'confirmed') {
      bookingStatus = (await this.bookingService.updateStatus(tenantId, bookingId, 'delivered')).status;
    }
    return { bookingId, shipmentId: shipment.id, courierStatus: status, bookingStatus };
  }

  @OnEvent('booking.confirmed')
  async onBookingConfirmed(payload: { tenantId: string; bookingId: string; bookingNumber: string }) {
    try {
      const booking = await this.getShippableBooking(payload.tenantId, payload.bookingId);
      if (booking.handoverMethod === 'CUSTOMER_PICKUP') return;
      const provider = await this.defaultProvider(payload.tenantId);
      const shipment = await this.createPreparedShipment(payload.tenantId, payload.bookingId, provider);
      const pickupDate = shipment.scheduledPickupAt ?? new Date();
      const settings = await this.getTenantCourierSettings(payload.tenantId);
      if ((provider === 'pathao' && settings.pathao?.enabled) || (provider === 'steadfast' && settings.steadfast?.enabled)) {
        this.eventEmitter.emit('fulfillment.schedulePickup', {
          tenantId: payload.tenantId,
          bookingId: payload.bookingId,
          bookingNumber: payload.bookingNumber,
          scheduledAt: pickupDate.toISOString(),
          delayMs: Math.max(0, pickupDate.getTime() - Date.now()),
        });
      }
    } catch (cause) {
      this.logger.error(`Could not prepare shipment for ${payload.bookingNumber}: ${cause instanceof Error ? cause.message : cause}`);
    }
  }

  async requestPickup(tenantId: string, bookingId: string): Promise<void> {
    try {
      const provider = await this.defaultProvider(tenantId);
      await this.sendPickupNow(tenantId, bookingId, {
        courierProvider: provider as CourierProviderEnum,
        useApi: provider !== 'manual',
      });
    } catch (cause) {
      this.logger.warn(`Scheduled pickup failed for ${bookingId}: ${cause instanceof Error ? cause.message : cause}`);
    }
  }

  async checkStuckPickups() {
    const cutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const stuck = await this.prisma.shipment.findMany({
      where: { status: 'pickup_pending', pickupRequestedAt: { lt: cutoff } },
      include: { booking: { select: { bookingNumber: true } } },
    });
    for (const shipment of stuck) {
      await this.transitionShipment(shipment.id, shipment.tenantId, 'error', {
        label: 'Pickup not completed within three days',
        source: 'system',
        dedupeKey: `stuck:${cutoff.toISOString().slice(0, 10)}`,
        update: { failedReason: 'Pickup not completed within three days' },
      });
      this.eventEmitter.emit('fulfillment.stuckPickup', {
        tenantId: shipment.tenantId,
        bookingId: shipment.bookingId,
        bookingNumber: shipment.booking.bookingNumber,
      });
    }
  }

  async pollAllCourierStatuses() {
    const shipments = await this.prisma.shipment.findMany({
      where: {
        trackingNumber: { not: null },
        provider: { in: ['pathao', 'steadfast'] },
        status: { in: ACTIVE_SHIPMENT_STATUSES },
      },
      include: { booking: { select: { status: true, bookingNumber: true } } },
    });
    for (const shipment of shipments) {
      try {
        const settings = await this.getTenantCourierSettings(shipment.tenantId);
        let result: TrackingResult;
        if (shipment.provider === 'pathao') {
          if (!settings.pathao?.enabled) continue;
          result = await this.pathaoAdapter.trackParcel(shipment.trackingNumber!, settings.pathao);
        } else {
          if (!settings.steadfast?.enabled) continue;
          result = await this.steadfastAdapter.trackParcel(shipment.trackingNumber!, settings.steadfast);
        }
        const status = this.statusFromTracking(result);
        if (status !== shipment.status) {
          await this.applyProviderStatus(shipment, status, result.rawStatus, result.updatedAt ?? new Date(), 'poll', result.raw);
        } else {
          await this.prisma.shipment.update({ where: { id: shipment.id }, data: { lastSyncedAt: new Date() } });
        }
      } catch (cause) {
        this.logger.warn(`Shipment poll failed for ${shipment.id}: ${cause instanceof Error ? cause.message : cause}`);
      }
    }
  }

  async trackOrder(tenantId: string, bookingId: string): Promise<TrackingResult> {
    const shipment = await this.prisma.shipment.findFirst({
      where: { tenantId, bookingId, direction: 'OUTBOUND' },
      orderBy: { createdAt: 'desc' },
    });
    if (!shipment?.trackingNumber) throw new BadRequestException('This booking has no dispatched shipment');
    if (shipment.provider === 'manual') return this.manualAdapter.trackParcel(shipment.trackingNumber);
    const settings = await this.getTenantCourierSettings(tenantId);
    if (shipment.provider === 'pathao') {
      if (!settings.pathao?.enabled) throw new BadRequestException('Pathao is not configured');
      return this.pathaoAdapter.trackParcel(shipment.trackingNumber, settings.pathao);
    }
    if (!settings.steadfast?.enabled) throw new BadRequestException('Steadfast is not configured');
    return this.steadfastAdapter.trackParcel(shipment.trackingNumber, settings.steadfast);
  }

  async calculateShippingRate(tenantId: string, dto: CalculateRateDto): Promise<ShippingRate | null> {
    const params = {
      pickupCity: dto.pickupCity,
      deliveryCity: dto.deliveryCity,
      weightKg: dto.weightKg,
      codAmount: dto.codAmount,
    };
    const settings = await this.getTenantCourierSettings(tenantId);
    if (dto.courierProvider === 'pathao') {
      if (!settings.pathao?.enabled) return null;
      return this.pathaoAdapter.calculateShipping(params, settings.pathao);
    }
    if (dto.courierProvider === 'steadfast') {
      if (!settings.steadfast?.enabled) return null;
      return this.steadfastAdapter.calculateShipping(params);
    }
    return this.manualAdapter.calculateShipping(params);
  }

  async getDeliveryDashboard(
    tenantId: string,
    filters?: { courierStatus?: string[]; stage?: DeliveryStageGroup; page?: number; limit?: number },
  ) {
    const page = Math.max(1, filters?.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters?.limit ?? 20));
    const requestedStatuses = filters?.stage
      ? Object.entries(COURIER_STATUS_TO_STAGE).filter(([, stage]) => stage === filters.stage).map(([status]) => status as ShipmentStatus)
      : filters?.courierStatus?.filter((status): status is ShipmentStatus => status in COURIER_STATUS_TO_STAGE);
    const where: Prisma.ShipmentWhereInput = {
      tenantId,
      direction: 'OUTBOUND',
      ...(requestedStatuses?.length ? { status: { in: requestedStatuses } } : {}),
    };
    const [counts, shipments, total] = await Promise.all([
      this.prisma.shipment.groupBy({ by: ['status'], where: { tenantId, direction: 'OUTBOUND' }, _count: true }),
      this.prisma.shipment.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ scheduledPickupAt: 'asc' }, { createdAt: 'desc' }],
        include: {
          events: { orderBy: { occurredAt: 'asc' } },
          booking: { include: { items: { select: { productName: true, startDate: true, endDate: true } } } },
        },
      }),
      this.prisma.shipment.count({ where }),
    ]);
    const summary: Record<string, number> = {};
    const stageSummary: Record<DeliveryStageGroup, number> = {
      prepare_parcel: 0,
      awaiting_pickup: 0,
      in_transit: 0,
      delivered: 0,
      error: 0,
    };
    for (const count of counts) {
      summary[count.status] = count._count;
      stageSummary[COURIER_STATUS_TO_STAGE[count.status]] += count._count;
    }
    return {
      summary,
      stageSummary,
      data: shipments.map((shipment) => this.toDeliveryProjection(shipment, shipment.booking)),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async processPathaoWebhook(token: string, payload: PathaoWebhookPayload) {
    if (!payload.consignment_id) throw new BadRequestException('Missing Pathao consignment ID');
    await this.processWebhook(token, 'pathao', payload.consignment_id, payload.order_status ?? '', payload.updated_at, payload);
  }

  async processSteadfastWebhook(token: string, payload: SteadfastWebhookPayload) {
    if (!payload.tracking_code) throw new BadRequestException('Missing Steadfast tracking code');
    await this.processWebhook(token, 'steadfast', payload.tracking_code, payload.delivery_status ?? '', payload.updated_at, payload);
  }

  private async processWebhook(
    token: string,
    provider: ShipmentProvider,
    trackingNumber: string,
    rawStatus: string,
    updatedAt: string | undefined,
    payload: object,
  ) {
    const settings = await this.prisma.storeSettings.findUnique({
      where: { courierWebhookToken: token },
      select: { tenantId: true },
    });
    if (!settings) throw new NotFoundException('Webhook endpoint not found');
    const shipment = await this.prisma.shipment.findFirst({
      where: {
        tenantId: settings.tenantId,
        provider,
        OR: [{ trackingNumber }, { providerReference: trackingNumber }],
      },
      include: { booking: { select: { status: true, bookingNumber: true } } },
    });
    if (!shipment) throw new NotFoundException('Shipment not found for webhook');
    const payloadHash = this.hash(payload);
    const receipt = await this.prisma.courierWebhookReceipt.findUnique({
      where: { provider_payloadHash: { provider, payloadHash } },
    });
    if (receipt) return;
    const created = await this.prisma.courierWebhookReceipt.create({
      data: {
        tenantId: shipment.tenantId,
        shipmentId: shipment.id,
        provider,
        payloadHash,
        payload: payload as Prisma.InputJsonValue,
      },
    });
    try {
      const status = provider === 'pathao' ? normalisePathaoStatus(rawStatus) : this.normaliseSteadfastStatus(rawStatus);
      await this.applyProviderStatus(
        shipment,
        status,
        rawStatus,
        updatedAt ? new Date(updatedAt) : new Date(),
        'webhook',
        payload,
        `webhook:${payloadHash}`,
      );
      await this.prisma.courierWebhookReceipt.update({ where: { id: created.id }, data: { processedAt: new Date() } });
    } catch (cause) {
      await this.prisma.courierWebhookReceipt.update({
        where: { id: created.id },
        data: { errorReason: cause instanceof Error ? cause.message : 'Webhook processing failed' },
      });
      throw cause;
    }
  }

  private async applyProviderStatus(
    shipment: { id: string; tenantId: string; bookingId: string; direction: 'OUTBOUND' | 'RETURN'; booking: { status: string; bookingNumber: string } },
    status: ShipmentStatus,
    rawStatus: string,
    occurredAt: Date,
    source: string,
    raw?: unknown,
    dedupeKey = `provider:${status}:${occurredAt.toISOString()}`,
  ) {
    await this.transitionShipment(shipment.id, shipment.tenantId, status, {
      label: COURIER_STATUS_LABELS[status] ?? rawStatus,
      source,
      dedupeKey,
      occurredAt,
      raw,
      update: {
        lastSyncedAt: new Date(),
        deliveredAt: status === 'delivered' ? occurredAt : undefined,
        failedReason: ['error', 'pickup_failed', 'partial_delivered', 'returned_to_sender'].includes(status) ? rawStatus : null,
      },
    });
    if (shipment.direction === 'OUTBOUND' && status === 'delivered' && shipment.booking.status === 'confirmed') {
      await this.bookingService.updateStatus(shipment.tenantId, shipment.bookingId, 'delivered');
      this.eventEmitter.emit('fulfillment.delivered.auto', {
        tenantId: shipment.tenantId,
        bookingId: shipment.bookingId,
        bookingNumber: shipment.booking.bookingNumber,
      });
    }
    if (status === 'returned_to_sender') {
      this.eventEmitter.emit('fulfillment.courier.return_alert', {
        tenantId: shipment.tenantId,
        bookingId: shipment.bookingId,
        bookingNumber: shipment.booking.bookingNumber,
      });
    }
  }

  private async createPreparedShipment(tenantId: string, bookingId: string, provider: ShipmentProvider) {
    const existing = await this.prisma.shipment.findUnique({
      where: { tenantId_idempotencyKey: { tenantId, idempotencyKey: `booking-confirmed:${bookingId}:OUTBOUND` } },
      include: { events: { orderBy: { occurredAt: 'asc' } } },
    });
    if (existing) return existing;
    const booking = await this.getShippableBooking(tenantId, bookingId);
    const { pickupDate } = await this.calculatePickupDate(tenantId, booking.deliveryCity, booking.items);
    const itemQuantity = booking.items.reduce((sum, item) => sum + item.quantity, 0);
    const request = {
      bookingId,
      provider,
      recipientName: booking.deliveryName,
      recipientPhone: booking.deliveryPhone,
      recipientAddress: booking.deliveryAddressLine1,
      recipientCity: booking.deliveryCity,
      itemQuantity,
    };
    return this.prisma.shipment.create({
      data: {
        tenantId,
        bookingId,
        provider,
        idempotencyKey: `booking-confirmed:${bookingId}:OUTBOUND`,
        requestHash: this.hash(request),
        recipientName: booking.deliveryName,
        recipientPhone: booking.deliveryPhone,
        recipientAddress: booking.deliveryAddressLine1,
        recipientCity: booking.deliveryCity,
        recipientZone: this.deliveryZone(booking.deliveryExtra),
        itemQuantity,
        weightGrams: Math.max(500, itemQuantity * 500),
        scheduledPickupAt: pickupDate,
        items: { create: booking.items.map((item) => ({ bookingItemId: item.id, quantity: item.quantity })) },
        events: {
          create: {
            tenantId,
            status: 'prepare_parcel',
            label: COURIER_STATUS_LABELS.prepare_parcel,
            source: 'system',
            dedupeKey: 'shipment-created',
            occurredAt: new Date(),
          },
        },
      },
      include: { events: { orderBy: { occurredAt: 'asc' } } },
    });
  }

  private async transitionShipment(
    shipmentId: string,
    tenantId: string,
    status: ShipmentStatus,
    details: {
      label: string;
      source: string;
      dedupeKey: string;
      occurredAt?: Date;
      raw?: unknown;
      update?: Prisma.ShipmentUpdateInput;
    },
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT id FROM shipments WHERE id = ${shipmentId} AND tenant_id = ${tenantId} FOR UPDATE`);
      const existing = await tx.shipmentEvent.findUnique({
        where: { shipmentId_dedupeKey: { shipmentId, dedupeKey: details.dedupeKey } },
      });
      if (existing) return tx.shipment.findUniqueOrThrow({ where: { id: shipmentId } });
      await tx.shipmentEvent.create({
        data: {
          tenantId,
          shipmentId,
          status,
          label: details.label,
          source: details.source,
          dedupeKey: details.dedupeKey,
          rawPayload: details.raw === undefined ? Prisma.DbNull : details.raw as Prisma.InputJsonValue,
          occurredAt: details.occurredAt ?? new Date(),
        },
      });
      return tx.shipment.update({
        where: { id: shipmentId },
        data: { status, ...(details.update ?? {}) },
      });
    });
  }

  private async getShippableBooking(tenantId: string, bookingId: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, tenantId, deletedAt: null },
      include: { items: { select: { id: true, quantity: true, productName: true, startDate: true, endDate: true } } },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    return booking;
  }

  private async calculatePickupDate(tenantId: string, deliveryCity: string, items: Array<{ startDate: Date }>) {
    const earliest = items.reduce<Date | null>((value, item) => !value || item.startDate < value ? item.startDate : value, null);
    if (!earliest) return { pickupDate: new Date(), leadDays: 0 };
    const settings = await this.prisma.storeSettings.findUnique({
      where: { tenantId },
      select: { pickupLeadDays: true, pickupLeadDaysConfig: true },
    });
    let leadDays = settings?.pickupLeadDays ?? 2;
    if (settings?.pickupLeadDaysConfig) {
      const config = settings.pickupLeadDaysConfig as unknown as DistrictLeadDaysConfig;
      leadDays = config.districtLeadDays?.[deliveryCity.toLowerCase().trim()] ?? config.defaultLeadDays ?? leadDays;
    }
    const pickupDate = new Date(earliest);
    pickupDate.setDate(pickupDate.getDate() - leadDays);
    pickupDate.setHours(0, 1, 0, 0);
    return { pickupDate: pickupDate < new Date() ? new Date() : pickupDate, leadDays };
  }

  private async defaultProvider(tenantId: string): Promise<ShipmentProvider> {
    const settings = await this.getTenantCourierSettings(tenantId);
    const configured = settings.defaultProvider;
    if (configured === 'pathao' && settings.pathao?.enabled) return 'pathao';
    if (configured === 'steadfast' && settings.steadfast?.enabled) return 'steadfast';
    if (settings.pathao?.enabled) return 'pathao';
    if (settings.steadfast?.enabled) return 'steadfast';
    return 'manual';
  }

  private async getTenantCourierSettings(tenantId: string): Promise<CourierSettings> {
    const settings = await this.prisma.storeSettings.findUnique({
      where: { tenantId },
      select: {
        defaultCourier: true,
        steadfastApiKey: true,
        steadfastSecretKey: true,
        pathaoClientId: true,
        pathaoClientSecret: true,
        pathaoUsername: true,
        pathaoPassword: true,
        pathaoStoreId: true,
        pathaoSandbox: true,
      },
    });
    if (!settings) return {};
    return {
      defaultProvider: settings.defaultCourier as CourierSettings['defaultProvider'] ?? undefined,
      pathao: settings.pathaoClientId ? {
        enabled: Boolean(settings.pathaoClientId && settings.pathaoClientSecret && settings.pathaoUsername && settings.pathaoPassword && settings.pathaoStoreId),
        clientId: settings.pathaoClientId,
        clientSecret: settings.pathaoClientSecret ?? '',
        username: settings.pathaoUsername ?? '',
        password: settings.pathaoPassword ?? '',
        defaultStoreId: settings.pathaoStoreId ?? 0,
        sandbox: settings.pathaoSandbox,
      } : undefined,
      steadfast: settings.steadfastApiKey ? {
        enabled: Boolean(settings.steadfastApiKey && settings.steadfastSecretKey),
        apiKey: settings.steadfastApiKey,
        secretKey: settings.steadfastSecretKey ?? '',
      } : undefined,
    };
  }

  private toDeliveryProjection(shipment: any, booking: any) {
    const events = (shipment.events ?? []).map((event: any) => ({
      status: event.status,
      label: event.label,
      timestamp: event.occurredAt,
      source: event.source,
    }));
    return {
      id: booking.id,
      shipmentId: shipment.id,
      bookingNumber: booking.bookingNumber,
      status: booking.status,
      courierProvider: shipment.provider,
      courierConsignmentId: shipment.providerReference,
      courierStatus: shipment.status,
      courierStatusHistory: events,
      courierErrorReason: shipment.failedReason,
      trackingNumber: shipment.trackingNumber,
      pickupRequestedAt: shipment.pickupRequestedAt,
      scheduledPickupAt: shipment.scheduledPickupAt,
      deliveredAt: shipment.deliveredAt,
      deliveryName: booking.deliveryName,
      deliveryPhone: booking.deliveryPhone,
      deliveryCity: booking.deliveryCity,
      grandTotal: booking.grandTotal,
      items: booking.items,
    };
  }

  private deliveryZone(extra: Prisma.JsonValue | null): string | undefined {
    if (!extra || typeof extra !== 'object' || Array.isArray(extra)) return undefined;
    const value = (extra as Prisma.JsonObject).area;
    return typeof value === 'string' ? value : undefined;
  }

  private statusFromTracking(result: TrackingResult): ShipmentStatus {
    if (result.normalisedStatus === 'delivered') return 'delivered';
    if (result.normalisedStatus === 'returned') return 'returned_to_sender';
    if (result.normalisedStatus === 'in_transit') return 'in_transit';
    return 'unknown';
  }

  private normaliseSteadfastStatus(raw: string): ShipmentStatus {
    const status = raw.toLowerCase().trim();
    if (status.includes('partial')) return 'partial_delivered';
    if (status.includes('delivered')) return 'delivered';
    if (status.includes('return')) return 'returned_to_sender';
    if (status.includes('cancel')) return 'cancelled';
    if (status.includes('hold')) return 'on_hold';
    if (status.includes('transit') || status.includes('review')) return 'in_transit';
    return 'unknown';
  }

  private hash(value: unknown) {
    return createHash('sha256').update(JSON.stringify(value)).digest('hex');
  }
}
