/**
 * Fulfillment Service — P09 Order Fulfillment & Logistics
 *
 * Orchestrates courier API calls and delegates booking status updates to
 * BookingService (which owns the state machine — ADR-02).
 *
 * This service:
 * 1. Selects the appropriate courier adapter for a tenant
 * 2. Creates parcels via the courier adapter (if useApi = true)
 * 3. Tracks parcels via the courier adapter
 * 4. Processes incoming courier webhooks and updates booking status
 * 5. Calculates shipping rates
 * 6. Schedules pickup requests automatically (auto-fulfillment)
 * 7. Polls courier APIs for status updates (CRON job)
 * 8. Provides a delivery dashboard endpoint for tenants
 */

import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { BookingService } from '../booking/booking.service';
import { PathaoAdapter } from './providers/pathao.adapter';
import { SteadfastAdapter } from './providers/steadfast.adapter';
import { ManualAdapter } from './providers/manual.adapter';
import {
  CourierSettings,
  TrackingResult,
  ParcelResult,
  ShippingRate,
  CourierStatusSlug,
  CourierStatusEvent,
  COURIER_STATUS_LABELS,
  PathaoConfig,
  PickupLeadDaysConfig,
  MAJOR_CITIES_BD,
} from './providers/courier-provider.interface';
import {
  ShipOrderDto,
  CourierProviderEnum,
  CalculateRateDto,
  PathaoWebhookPayload,
  SteadfastWebhookPayload,
} from './dto/fulfillment.dto';

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

  // =========================================================================
  // SHIP ORDER (manual trigger — still supported)
  // =========================================================================

  async shipOrder(
    tenantId: string,
    bookingId: string,
    dto: ShipOrderDto,
  ): Promise<{
    bookingId: string;
    bookingNumber: string;
    status: string;
    courierProvider: string;
    trackingNumber: string | null;
    parcel?: ParcelResult;
  }> {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, tenantId, deletedAt: null },
      select: {
        id: true,
        bookingNumber: true,
        status: true,
        deliveryName: true,
        deliveryPhone: true,
        deliveryAddressLine1: true,
        deliveryCity: true,
        grandTotal: true,
        paymentMethod: true,
        totalPaid: true,
      },
    });

    if (!booking) {
      throw new NotFoundException(`Booking ${bookingId} not found`);
    }

    if (booking.status !== 'confirmed') {
      throw new BadRequestException(
        `Booking must be in "confirmed" status to ship. Current status: "${booking.status}"`,
      );
    }

    let parcelResult: ParcelResult | undefined;
    let trackingNumber: string | null = dto.trackingNumber ?? null;

    if (dto.useApi && dto.courierProvider !== CourierProviderEnum.MANUAL) {
      const courierSettings = await this.getTenantCourierSettings(tenantId);
      const codAmount = dto.codAmount ?? (
        booking.paymentMethod === 'cod'
          ? booking.grandTotal - booking.totalPaid
          : 0
      );

      const createParams = {
        merchantOrderId: booking.bookingNumber,
        recipientName: booking.deliveryName,
        recipientPhone: booking.deliveryPhone,
        recipientAddress: booking.deliveryAddressLine1,
        recipientCity: booking.deliveryCity,
        codAmount,
        specialInstruction: dto.specialInstruction,
        itemQuantity: 1,
        weightKg: 1,
      };

      switch (dto.courierProvider) {
        case CourierProviderEnum.PATHAO: {
          const pathaoConfig = courierSettings.pathao;
          if (!pathaoConfig?.enabled || !pathaoConfig.clientId) {
            throw new BadRequestException('Pathao is not configured or enabled for this tenant.');
          }
          parcelResult = await this.pathaoAdapter.createParcel(createParams, pathaoConfig);
          break;
        }
        case CourierProviderEnum.STEADFAST: {
          const steadfastConfig = courierSettings.steadfast;
          if (!steadfastConfig?.enabled || !steadfastConfig.apiKey) {
            throw new BadRequestException('Steadfast is not configured or enabled for this tenant.');
          }
          parcelResult = await this.steadfastAdapter.createParcel(createParams, steadfastConfig);
          break;
        }
        default:
          throw new BadRequestException(`Unsupported courier provider for API mode: ${dto.courierProvider}`);
      }

      trackingNumber = parcelResult.trackingId;

      // Store courier details on the booking
      await this.prisma.booking.update({
        where: { id: bookingId },
        data: {
          courierConsignmentId: parcelResult.trackingId,
          courierStatus: 'pickup_pending',
          pickupRequestedAt: new Date(),
          courierStatusHistory: [
            {
              status: 'pickup_pending',
              label: COURIER_STATUS_LABELS.pickup_pending,
              timestamp: new Date().toISOString(),
              source: 'system',
            },
          ] satisfies CourierStatusEvent[],
        },
      });
    } else if (dto.courierProvider === CourierProviderEnum.MANUAL) {
      parcelResult = await this.manualAdapter.createParcel({
        merchantOrderId: booking.bookingNumber,
        recipientName: booking.deliveryName,
        recipientPhone: booking.deliveryPhone,
        recipientAddress: booking.deliveryAddressLine1,
        recipientCity: booking.deliveryCity,
        codAmount: dto.codAmount ?? 0,
      });
    }

    // Delegate state machine update to BookingService
    const updated = await this.bookingService.shipBooking(tenantId, bookingId, {
      trackingNumber: trackingNumber ?? undefined,
      courierProvider: dto.courierProvider,
    });

    this.logger.log(
      `Order ${booking.bookingNumber} shipped via ${dto.courierProvider}` +
        (trackingNumber ? ` — tracking: ${trackingNumber}` : ' (no tracking)'),
    );

    this.eventEmitter.emit('fulfillment.shipped', {
      tenantId,
      bookingId,
      bookingNumber: booking.bookingNumber,
      courierProvider: dto.courierProvider,
      trackingNumber,
    });

    return {
      bookingId: updated.id,
      bookingNumber: updated.bookingNumber,
      status: updated.status,
      courierProvider: dto.courierProvider,
      trackingNumber: updated.trackingNumber,
      parcel: parcelResult,
    };
  }

  // =========================================================================
  // AUTO-SCHEDULE PICKUP (event-driven)
  // =========================================================================

  /**
   * Listens for booking.confirmed events and schedules an automatic
   * pickup request if the tenant has courier API configured.
   */
  @OnEvent('booking.confirmed')
  async onBookingConfirmed(payload: {
    tenantId: string;
    bookingId: string;
    bookingNumber: string;
  }): Promise<void> {
    const { tenantId, bookingId, bookingNumber } = payload;

    try {
      const courierSettings = await this.getTenantCourierSettings(tenantId);

      // Only auto-schedule if tenant has Pathao configured with API
      if (!courierSettings.pathao?.enabled) {
        this.logger.debug(`Skipping auto-pickup for ${bookingNumber} — no courier API configured`);
        return;
      }

      // Get booking with items to find earliest start date
      const booking = await this.prisma.booking.findFirst({
        where: { id: bookingId, tenantId },
        select: {
          id: true,
          bookingNumber: true,
          deliveryCity: true,
          items: { select: { startDate: true } },
        },
      });

      if (!booking || booking.items.length === 0) return;

      // Calculate pickup date
      const pickupDate = await this.calculatePickupDate(tenantId, booking);

      // Calculate delay in milliseconds
      const now = new Date();
      const delayMs = Math.max(0, pickupDate.getTime() - now.getTime());

      // Emit event for the jobs system to schedule the delayed job
      this.eventEmitter.emit('fulfillment.schedulePickup', {
        tenantId,
        bookingId,
        bookingNumber,
        scheduledAt: pickupDate.toISOString(),
        delayMs,
      });

      this.logger.log(
        `Auto-pickup scheduled for ${bookingNumber} at ${pickupDate.toISOString()} ` +
          `(${Math.ceil(delayMs / (1000 * 60 * 60))} hours from now)`,
      );
    } catch (err) {
      this.logger.error(
        `Failed to schedule auto-pickup for ${bookingNumber}: ${(err as Error).message}`,
      );
    }
  }

  // =========================================================================
  // REQUEST PICKUP (called by the scheduled job)
  // =========================================================================

  /**
   * Sends a pickup request to the courier API for a confirmed booking.
   * Called by the BullMQ delayed job when the pickup date arrives.
   */
  async requestPickup(tenantId: string, bookingId: string): Promise<void> {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, tenantId, deletedAt: null },
      select: {
        id: true,
        bookingNumber: true,
        status: true,
        deliveryName: true,
        deliveryPhone: true,
        deliveryAddressLine1: true,
        deliveryCity: true,
        grandTotal: true,
        paymentMethod: true,
        totalPaid: true,
        courierConsignmentId: true,
      },
    });

    if (!booking) {
      this.logger.warn(`requestPickup: Booking ${bookingId} not found`);
      return;
    }

    // Don't request pickup if booking was cancelled or already shipped
    if (!['confirmed'].includes(booking.status)) {
      this.logger.warn(
        `requestPickup: Booking ${booking.bookingNumber} is ${booking.status}, skipping pickup`,
      );
      return;
    }

    // Don't request if already has a consignment
    if (booking.courierConsignmentId) {
      this.logger.warn(
        `requestPickup: Booking ${booking.bookingNumber} already has consignment ${booking.courierConsignmentId}`,
      );
      return;
    }

    const courierSettings = await this.getTenantCourierSettings(tenantId);
    const pathaoConfig = courierSettings.pathao;

    if (!pathaoConfig?.enabled) {
      this.logger.warn(`requestPickup: Pathao not configured for tenant ${tenantId}`);
      return;
    }

    // Calculate COD amount
    const codAmount = booking.paymentMethod === 'cod'
      ? booking.grandTotal - booking.totalPaid
      : 0;

    try {
      const parcelResult = await this.pathaoAdapter.createParcel(
        {
          merchantOrderId: booking.bookingNumber,
          recipientName: booking.deliveryName,
          recipientPhone: booking.deliveryPhone,
          recipientAddress: booking.deliveryAddressLine1,
          recipientCity: booking.deliveryCity,
          codAmount,
          itemQuantity: 1,
          weightKg: 1,
        },
        pathaoConfig,
      );

      // Update booking with courier details
      const statusEvent: CourierStatusEvent = {
        status: 'pickup_pending',
        label: COURIER_STATUS_LABELS.pickup_pending,
        timestamp: new Date().toISOString(),
        source: 'system',
      };

      await this.prisma.booking.update({
        where: { id: bookingId },
        data: {
          trackingNumber: parcelResult.trackingId,
          courierProvider: 'pathao',
          courierConsignmentId: parcelResult.trackingId,
          courierStatus: 'pickup_pending',
          pickupRequestedAt: new Date(),
          courierStatusHistory: [statusEvent] as any,
        },
      });

      this.logger.log(
        `Auto-pickup requested for ${booking.bookingNumber} — consignment: ${parcelResult.trackingId}`,
      );

      // Notify the owner
      this.eventEmitter.emit('fulfillment.pickupRequested', {
        tenantId,
        bookingId,
        bookingNumber: booking.bookingNumber,
        consignmentId: parcelResult.trackingId,
        deliveryFee: parcelResult.deliveryFee,
      });
    } catch (err) {
      this.logger.error(
        `Auto-pickup failed for ${booking.bookingNumber}: ${(err as Error).message}`,
      );

      // Mark as failed so tenant can see it in the dashboard
      await this.prisma.booking.update({
        where: { id: bookingId },
        data: {
          courierStatus: 'pickup_failed',
          courierStatusHistory: [
            {
              status: 'pickup_failed',
              label: `Pickup Request Failed: ${(err as Error).message}`,
              timestamp: new Date().toISOString(),
              source: 'system',
            },
          ] satisfies CourierStatusEvent[],
        },
      });

      // Notify the owner about the failure
      this.eventEmitter.emit('fulfillment.pickupFailed', {
        tenantId,
        bookingId,
        bookingNumber: booking.bookingNumber,
        error: (err as Error).message,
      });
    }
  }

  // =========================================================================
  // POLL COURIER STATUSES (CRON job)
  // =========================================================================

  /**
   * Polls Pathao API for all bookings with active shipments.
   * Called by the CRON job every 15 minutes.
   * Processes across all active tenants.
   */
  async pollAllCourierStatuses(): Promise<void> {
    // Find all bookings with active courier shipments
    const activeShipments = await this.prisma.booking.findMany({
      where: {
        courierConsignmentId: { not: null },
        courierProvider: 'pathao',
        courierStatus: {
          notIn: ['delivered', 'returned_to_sender', 'cancelled'],
        },
        deletedAt: null,
      },
      select: {
        id: true,
        tenantId: true,
        bookingNumber: true,
        status: true,
        courierConsignmentId: true,
        courierStatus: true,
        courierStatusHistory: true,
      },
    });

    if (activeShipments.length === 0) return;

    this.logger.log(`Polling ${activeShipments.length} active Pathao shipments...`);

    // Group by tenant to reuse credentials
    const byTenant = new Map<string, typeof activeShipments>();
    for (const shipment of activeShipments) {
      const list = byTenant.get(shipment.tenantId) ?? [];
      list.push(shipment);
      byTenant.set(shipment.tenantId, list);
    }

    let updatedCount = 0;

    for (const [tenantId, shipments] of byTenant) {
      try {
        const courierSettings = await this.getTenantCourierSettings(tenantId);
        const pathaoConfig = courierSettings.pathao;
        if (!pathaoConfig?.enabled) continue;

        for (const shipment of shipments) {
          try {
            const updated = await this.pollSingleShipment(
              shipment,
              pathaoConfig,
            );
            if (updated) updatedCount++;
          } catch (err) {
            this.logger.warn(
              `Poll failed for ${shipment.bookingNumber}: ${(err as Error).message}`,
            );
          }
        }
      } catch (err) {
        this.logger.warn(
          `Poll failed for tenant ${tenantId}: ${(err as Error).message}`,
        );
      }
    }

    if (updatedCount > 0) {
      this.logger.log(`Courier poll complete: ${updatedCount} shipment(s) updated`);
    }
  }

  /**
   * Polls a single shipment and updates the booking if status changed.
   */
  private async pollSingleShipment(
    shipment: {
      id: string;
      tenantId: string;
      bookingNumber: string;
      status: string;
      courierConsignmentId: string | null;
      courierStatus: string | null;
      courierStatusHistory: unknown;
    },
    pathaoConfig: PathaoConfig,
  ): Promise<boolean> {
    if (!shipment.courierConsignmentId) return false;

    const info = await this.pathaoAdapter.getOrderInfo(
      shipment.courierConsignmentId,
      pathaoConfig,
    );

    // Skip if status hasn't changed
    if (info.normalisedStatus === shipment.courierStatus) return false;

    const newStatus = info.normalisedStatus;

    // Append to history
    const history = (
      Array.isArray(shipment.courierStatusHistory)
        ? shipment.courierStatusHistory
        : []
    ) as CourierStatusEvent[];

    const newEvent: CourierStatusEvent = {
      status: newStatus,
      label: COURIER_STATUS_LABELS[newStatus] ?? info.rawStatus,
      timestamp: info.updatedAt ?? new Date().toISOString(),
      source: 'pathao',
    };
    history.push(newEvent);

    // Update booking courier status
    await this.prisma.booking.update({
      where: { id: shipment.id },
      data: {
        courierStatus: newStatus,
        courierStatusHistory: history as any,
      },
    });

    this.logger.log(
      `${shipment.bookingNumber}: courier ${shipment.courierStatus} → ${newStatus}`,
    );

    // Auto-transitions
    await this.handleCourierAutoTransition(shipment, newStatus);

    return true;
  }

  /**
   * Handles auto-transitions based on courier status changes.
   * - picked_up → booking becomes SHIPPED
   * - delivered → booking becomes DELIVERED
   * - returned → alert owner
   */
  private async handleCourierAutoTransition(
    shipment: {
      id: string;
      tenantId: string;
      bookingNumber: string;
      status: string;
    },
    newCourierStatus: CourierStatusSlug,
  ): Promise<void> {
    // Auto-mark as SHIPPED when courier picks up
    if (
      newCourierStatus === 'picked_up' &&
      shipment.status === 'confirmed'
    ) {
      try {
        await this.bookingService.updateStatus(shipment.tenantId, shipment.id, 'shipped');
        this.logger.log(
          `Auto-shipped: ${shipment.bookingNumber} (courier picked up)`,
        );

        this.eventEmitter.emit('fulfillment.shipped', {
          tenantId: shipment.tenantId,
          bookingId: shipment.id,
          bookingNumber: shipment.bookingNumber,
          courierProvider: 'pathao',
          autoTriggered: true,
        });
      } catch (err) {
        this.logger.error(
          `Auto-ship failed for ${shipment.bookingNumber}: ${(err as Error).message}`,
        );
      }
    }

    // Auto-mark as DELIVERED
    if (
      newCourierStatus === 'delivered' &&
      shipment.status === 'shipped'
    ) {
      try {
        await this.bookingService.updateStatus(shipment.tenantId, shipment.id, 'delivered');
        this.logger.log(
          `Auto-delivered: ${shipment.bookingNumber} (courier delivered)`,
        );

        this.eventEmitter.emit('fulfillment.delivered.auto', {
          tenantId: shipment.tenantId,
          bookingId: shipment.id,
          bookingNumber: shipment.bookingNumber,
          provider: 'pathao',
        });
      } catch (err) {
        this.logger.error(
          `Auto-deliver failed for ${shipment.bookingNumber}: ${(err as Error).message}`,
        );
      }
    }

    // Alert owner on return
    if (newCourierStatus === 'returned_to_sender') {
      this.eventEmitter.emit('fulfillment.courier.return_alert', {
        tenantId: shipment.tenantId,
        bookingId: shipment.id,
        bookingNumber: shipment.bookingNumber,
        provider: 'pathao',
      });
    }
  }

  // =========================================================================
  // TRACK ORDER
  // =========================================================================

  async trackOrder(tenantId: string, bookingId: string): Promise<TrackingResult> {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, tenantId, deletedAt: null },
      select: {
        id: true,
        bookingNumber: true,
        status: true,
        trackingNumber: true,
        courierProvider: true,
      },
    });

    if (!booking) throw new NotFoundException(`Booking ${bookingId} not found`);

    if (!booking.trackingNumber) {
      throw new BadRequestException('This order has no tracking number.');
    }

    const provider = booking.courierProvider as CourierProviderEnum | null;

    if (!provider || provider === CourierProviderEnum.MANUAL) {
      return this.manualAdapter.trackParcel(booking.trackingNumber);
    }

    const courierSettings = await this.getTenantCourierSettings(tenantId);

    switch (provider) {
      case CourierProviderEnum.PATHAO: {
        const config = courierSettings.pathao;
        if (!config?.enabled) throw new BadRequestException('Pathao not configured');
        return this.pathaoAdapter.trackParcel(booking.trackingNumber, config);
      }
      case CourierProviderEnum.STEADFAST: {
        const config = courierSettings.steadfast;
        if (!config?.enabled) throw new BadRequestException('Steadfast not configured');
        return this.steadfastAdapter.trackParcel(booking.trackingNumber, config);
      }
      default:
        throw new BadRequestException(`Unknown courier provider: ${provider}`);
    }
  }

  // =========================================================================
  // CALCULATE RATE
  // =========================================================================

  async calculateShippingRate(
    tenantId: string,
    dto: CalculateRateDto,
  ): Promise<ShippingRate | null> {
    const params = {
      pickupCity: dto.pickupCity,
      deliveryCity: dto.deliveryCity,
      weightKg: dto.weightKg,
      codAmount: dto.codAmount,
    };

    switch (dto.courierProvider) {
      case CourierProviderEnum.PATHAO: {
        const courierSettings = await this.getTenantCourierSettings(tenantId);
        const config = courierSettings.pathao;
        if (!config?.enabled) return null;
        return this.pathaoAdapter.calculateShipping(params, config);
      }
      case CourierProviderEnum.STEADFAST: {
        const courierSettings = await this.getTenantCourierSettings(tenantId);
        const config = courierSettings.steadfast;
        if (!config?.enabled) return null;
        return this.steadfastAdapter.calculateShipping(params);
      }
      case CourierProviderEnum.MANUAL:
      default:
        return this.manualAdapter.calculateShipping(params);
    }
  }

  // =========================================================================
  // DELIVERY DASHBOARD (Tenant-facing)
  // =========================================================================

  /**
   * Returns delivery-related data for the tenant's dashboard:
   * - Grouped counts by courier status
   * - Paginated list of active deliveries
   */
  async getDeliveryDashboard(
    tenantId: string,
    filters?: {
      courierStatus?: string[];
      page?: number;
      limit?: number;
    },
  ) {
    const page = filters?.page ?? 1;
    const limit = Math.min(filters?.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    // Get counts by status
    const statusCounts = await this.prisma.booking.groupBy({
      by: ['courierStatus'],
      where: {
        tenantId,
        courierConsignmentId: { not: null },
        deletedAt: null,
      },
      _count: true,
    });

    // Build deliveries query
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
      tenantId,
      courierConsignmentId: { not: null },
      deletedAt: null,
    };

    if (filters?.courierStatus?.length) {
      where.courierStatus = { in: filters.courierStatus };
    }

    const [deliveries, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        skip,
        take: limit,
        orderBy: { pickupRequestedAt: 'desc' },
        select: {
          id: true,
          bookingNumber: true,
          status: true,
          courierProvider: true,
          courierConsignmentId: true,
          courierStatus: true,
          courierStatusHistory: true,
          trackingNumber: true,
          pickupRequestedAt: true,
          shippedAt: true,
          deliveredAt: true,
          deliveryName: true,
          deliveryPhone: true,
          deliveryCity: true,
          grandTotal: true,
          items: {
            select: {
              productName: true,
              startDate: true,
              endDate: true,
            },
          },
        },
      }),
      this.prisma.booking.count({ where }),
    ]);

    // Build summary
    const summary: Record<string, number> = {};
    for (const group of statusCounts) {
      if (group.courierStatus) {
        summary[group.courierStatus] = group._count;
      }
    }

    return {
      summary,
      data: deliveries,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // =========================================================================
  // WEBHOOK PROCESSING
  // =========================================================================

  async processPathaoWebhook(payload: PathaoWebhookPayload): Promise<void> {
    const trackingId = payload.consignment_id;
    const rawStatus = payload.order_status ?? '';

    this.logger.log(`Pathao webhook: ${trackingId} → "${rawStatus}"`);

    const booking = await this.prisma.booking.findFirst({
      where: {
        OR: [
          { courierConsignmentId: trackingId },
          { trackingNumber: trackingId },
        ],
      },
      select: {
        id: true,
        tenantId: true,
        status: true,
        bookingNumber: true,
        courierStatus: true,
        courierStatusHistory: true,
      },
    });

    if (!booking) {
      this.logger.warn(`Pathao webhook: no booking found for tracking ID ${trackingId}`);
      return;
    }

    // Import the normaliser from the adapter
    const { normalisePathaoStatus } = await import('./providers/pathao.adapter');
    const newStatus = normalisePathaoStatus(rawStatus);

    // Skip if status hasn't changed
    if (newStatus === booking.courierStatus) return;

    // Append to history
    const history = (
      Array.isArray(booking.courierStatusHistory)
        ? booking.courierStatusHistory
        : []
    ) as unknown as CourierStatusEvent[];

    history.push({
      status: newStatus,
      label: COURIER_STATUS_LABELS[newStatus] ?? rawStatus,
      timestamp: payload.updated_at ?? new Date().toISOString(),
      source: 'webhook',
    });

    await this.prisma.booking.update({
      where: { id: booking.id },
      data: {
        courierStatus: newStatus,
        courierStatusHistory: history as any,
      },
    });

    // Handle auto-transitions
    await this.handleCourierAutoTransition(booking, newStatus);
  }

  async processSteadfastWebhook(payload: SteadfastWebhookPayload): Promise<void> {
    const trackingId = payload.tracking_code;
    const rawStatus = payload.delivery_status ?? '';

    this.logger.log(`Steadfast webhook: ${trackingId} → "${rawStatus}"`);

    const booking = await this.prisma.booking.findFirst({
      where: { trackingNumber: trackingId },
      select: { id: true, tenantId: true, status: true, bookingNumber: true },
    });

    if (!booking) {
      this.logger.warn(`Steadfast webhook: no booking found for tracking ID ${trackingId}`);
      return;
    }

    await this.applyWebhookStatus(booking, 'steadfast', rawStatus);
  }

  // =========================================================================
  // HELPERS
  // =========================================================================

  /**
   * Legacy webhook status handler for Steadfast (kept for backward compat).
   */
  private async applyWebhookStatus(
    booking: { id: string; tenantId: string; status: string; bookingNumber: string },
    provider: string,
    rawStatus: string,
  ): Promise<void> {
    const lowerStatus = rawStatus.toLowerCase();

    if (
      lowerStatus.includes('delivered') &&
      !lowerStatus.includes('return') &&
      booking.status === 'shipped'
    ) {
      try {
        await this.bookingService.updateStatus(booking.tenantId, booking.id, 'delivered');
        this.logger.log(
          `Webhook (${provider}): Auto-marked booking ${booking.bookingNumber} as delivered`,
        );

        this.eventEmitter.emit('fulfillment.delivered.auto', {
          tenantId: booking.tenantId,
          bookingId: booking.id,
          bookingNumber: booking.bookingNumber,
          provider,
        });
      } catch (err) {
        this.logger.error(
          `Webhook (${provider}): Failed to auto-deliver ${booking.bookingNumber} — ${(err as Error).message}`,
        );
      }
      return;
    }

    if (lowerStatus.includes('return')) {
      this.eventEmitter.emit('fulfillment.courier.return_alert', {
        tenantId: booking.tenantId,
        bookingId: booking.id,
        bookingNumber: booking.bookingNumber,
        provider,
        rawStatus,
      });
    }
  }

  /**
   * Calculates the optimal pickup date for a booking based on
   * the tenant's pickup schedule mode (fixed or smart).
   */
  private async calculatePickupDate(
    tenantId: string,
    booking: {
      deliveryCity: string;
      items: { startDate: Date }[];
    },
  ): Promise<Date> {
    // Find the earliest item start date
    const earliestStart = booking.items.reduce<Date | null>((min, item) => {
      return !min || item.startDate < min ? item.startDate : min;
    }, null);

    if (!earliestStart) {
      return new Date(); // Fallback: request now
    }

    const settings = await this.prisma.storeSettings.findUnique({
      where: { tenantId },
      select: {
        pickupScheduleMode: true,
        pickupLeadDays: true,
        pickupLeadDaysConfig: true,
        pickupCity: true,
      },
    });

    let leadDays = settings?.pickupLeadDays ?? 2;

    if (settings?.pickupScheduleMode === 'smart' && settings.pickupLeadDaysConfig) {
      const config = settings.pickupLeadDaysConfig as unknown as PickupLeadDaysConfig;
      const storeCity = (settings.pickupCity ?? '').toLowerCase().trim();
      const deliveryCity = booking.deliveryCity.toLowerCase().trim();

      if (storeCity && deliveryCity) {
        if (this.isSameCity(storeCity, deliveryCity)) {
          leadDays = config.same_city ?? 1;
        } else if (this.isMajorCity(deliveryCity)) {
          leadDays = config.inter_city ?? 3;
        } else {
          leadDays = config.remote ?? 5;
        }
      }
    }

    // Calculate pickup date = earliestStart - leadDays
    const pickupDate = new Date(earliestStart);
    pickupDate.setDate(pickupDate.getDate() - leadDays);

    // If pickup date is in the past, request immediately
    if (pickupDate < new Date()) {
      return new Date();
    }

    // Set pickup to 9 AM on the pickup date (business hours)
    pickupDate.setHours(9, 0, 0, 0);

    return pickupDate;
  }

  private isSameCity(city1: string, city2: string): boolean {
    const normalize = (c: string) =>
      c.toLowerCase().trim()
        .replace(/[^a-z]/g, '');
    return normalize(city1) === normalize(city2);
  }

  private isMajorCity(city: string): boolean {
    const normalized = city.toLowerCase().trim().replace(/[^a-z]/g, '');
    return MAJOR_CITIES_BD.some((c) => normalized.includes(c) || c.includes(normalized));
  }

  /**
   * Loads tenant courier settings from StoreSettings.
   * Uses dedicated Pathao columns for credentials.
   */
  private async getTenantCourierSettings(tenantId: string): Promise<CourierSettings> {
    const settings = await this.prisma.storeSettings.findUnique({
      where: { tenantId },
      select: {
        defaultCourier: true,
        courierApiKey: true,
        courierSecretKey: true,
        pickupAddress: true,
        // Dedicated Pathao columns
        pathaoClientId: true,
        pathaoClientSecret: true,
        pathaoUsername: true,
        pathaoPassword: true,
        pathaoStoreId: true,
        pathaoSandbox: true,
      },
    });

    if (!settings) return {};

    const result: CourierSettings = {
      defaultProvider: (settings.defaultCourier as CourierSettings['defaultProvider']) ?? undefined,
    };

    // Build Pathao config from dedicated columns
    if (settings.pathaoClientId) {
      result.pathao = {
        enabled: !!(
          settings.pathaoClientId &&
          settings.pathaoClientSecret &&
          settings.pathaoUsername &&
          settings.pathaoPassword
        ),
        clientId: settings.pathaoClientId ?? '',
        clientSecret: settings.pathaoClientSecret ?? '',
        username: settings.pathaoUsername ?? '',
        password: settings.pathaoPassword ?? '',
        defaultStoreId: settings.pathaoStoreId ?? 0,
        sandbox: settings.pathaoSandbox ?? false,
      };
    } else if (settings.defaultCourier === 'pathao' && settings.courierApiKey) {
      // Legacy: pipe-delimited format
      const [clientId, username] = (settings.courierApiKey ?? '').split('|');
      const [clientSecret, password] = (settings.courierSecretKey ?? '').split('|');

      result.pathao = {
        enabled: !!(clientId && username && clientSecret && password),
        clientId: clientId ?? '',
        clientSecret: clientSecret ?? '',
        username: username ?? '',
        password: password ?? '',
        defaultStoreId: 0,
      };
    }

    // Build Steadfast config
    if (settings.defaultCourier === 'steadfast' && settings.courierApiKey) {
      result.steadfast = {
        enabled: !!(settings.courierApiKey && settings.courierSecretKey),
        apiKey: settings.courierApiKey ?? '',
        secretKey: settings.courierSecretKey ?? '',
      };
    }

    return result;
  }
}
