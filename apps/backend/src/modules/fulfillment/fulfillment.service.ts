/**
 * Fulfillment Service — Order Fulfillment & Logistics
 *
 * Orchestrates the delivery lifecycle which is separate from the booking lifecycle:
 *
 * BOOKING:  pending → confirmed ──────────────────────→ delivered → returned → ...
 *                         │                                  ▲
 *                         ▼                                  │
 * DELIVERY: prepare_parcel → awaiting_pickup → in_transit → delivered
 *                              (+ error at any stage)
 *
 * This service:
 * 1. Manages the delivery lifecycle (prepare_parcel → awaiting_pickup → in_transit → delivered)
 * 2. Selects the appropriate courier adapter for a tenant
 * 3. Creates parcels via the courier adapter (auto or manual trigger)
 * 4. Tracks parcels via the courier adapter
 * 5. Processes incoming courier webhooks and updates delivery status
 * 6. Calculates shipping rates
 * 7. Schedules pickup requests automatically based on district lead days
 * 8. Polls courier APIs for status updates (CRON job)
 * 9. Detects stuck pickups and auto-marks as error
 * 10. Provides a delivery dashboard endpoint for tenants
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
  DistrictLeadDaysConfig,
  DeliveryStageGroup,
  COURIER_STATUS_TO_STAGE,
} from './providers/courier-provider.interface';
import {
  ShipOrderDto,
  CourierProviderEnum,
  CalculateRateDto,
  PathaoWebhookPayload,
  SteadfastWebhookPayload,
  UpdateDeliveryStageDto,
  DeliveryStageEnum,
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
  // SEND PICKUP REQUEST (manual trigger — "Send Pickup Now")
  // =========================================================================

  /**
   * Manually sends a pickup request to the courier API immediately.
   * Used when the owner wants to skip the scheduled wait.
   * Also used by the auto-scheduled job.
   */
  async sendPickupNow(
    tenantId: string,
    bookingId: string,
    dto?: ShipOrderDto,
  ): Promise<{
    bookingId: string;
    bookingNumber: string;
    courierStatus: string;
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
        courierStatus: true,
        courierConsignmentId: true,
        courierStatusHistory: true,
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
        `Booking must be in "confirmed" status. Current status: "${booking.status}"`,
      );
    }

    // Allow sending pickup from prepare_parcel or error stages
    if (booking.courierStatus && !['prepare_parcel', 'error', 'pickup_failed'].includes(booking.courierStatus)) {
      throw new BadRequestException(
        `Pickup already requested. Current delivery status: "${booking.courierStatus}"`,
      );
    }

    // Already has a consignment — don't create a duplicate
    if (booking.courierConsignmentId) {
      throw new BadRequestException(
        `Booking already has a consignment ID: ${booking.courierConsignmentId}`,
      );
    }

    const courierProvider = dto?.courierProvider ?? CourierProviderEnum.PATHAO;
    const useApi = dto?.useApi ?? true;
    let parcelResult: ParcelResult | undefined;
    let trackingNumber: string | null = dto?.trackingNumber ?? null;

    if (useApi && courierProvider !== CourierProviderEnum.MANUAL) {
      const courierSettings = await this.getTenantCourierSettings(tenantId);
      const codAmount = dto?.codAmount ?? (
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
        specialInstruction: dto?.specialInstruction,
        itemQuantity: 1,
        weightKg: 1,
      };

      switch (courierProvider) {
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
          throw new BadRequestException(`Unsupported courier provider for API mode: ${courierProvider}`);
      }

      trackingNumber = parcelResult.trackingId;
    } else if (courierProvider === CourierProviderEnum.MANUAL) {
      parcelResult = await this.manualAdapter.createParcel({
        merchantOrderId: booking.bookingNumber,
        recipientName: booking.deliveryName,
        recipientPhone: booking.deliveryPhone,
        recipientAddress: booking.deliveryAddressLine1,
        recipientCity: booking.deliveryCity,
        codAmount: dto?.codAmount ?? 0,
      });
    }

    // Append to courier status history
    const history = this.getStatusHistory(booking.courierStatusHistory);
    const newEvent: CourierStatusEvent = {
      status: 'pickup_pending',
      label: COURIER_STATUS_LABELS.pickup_pending,
      timestamp: new Date().toISOString(),
      source: 'system',
    };
    history.push(newEvent);

    // Update booking with courier details — delivery stage moves to awaiting_pickup
    await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        trackingNumber,
        courierProvider: courierProvider,
        courierConsignmentId: parcelResult?.trackingId ?? trackingNumber,
        courierStatus: 'pickup_pending',
        courierErrorReason: null,
        pickupRequestedAt: new Date(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        courierStatusHistory: history as any,
      },
    });

    this.logger.log(
      `Pickup requested for ${booking.bookingNumber} via ${courierProvider}` +
        (trackingNumber ? ` — tracking: ${trackingNumber}` : ' (no tracking)'),
    );

    this.eventEmitter.emit('fulfillment.pickupRequested', {
      tenantId,
      bookingId,
      bookingNumber: booking.bookingNumber,
      courierProvider,
      trackingNumber,
    });

    return {
      bookingId: booking.id,
      bookingNumber: booking.bookingNumber,
      courierStatus: 'pickup_pending',
      courierProvider,
      trackingNumber,
      parcel: parcelResult,
    };
  }

  // =========================================================================
  // MANUAL DELIVERY STAGE UPDATE
  // =========================================================================

  /**
   * Manually update the delivery stage for a booking.
   * Supports all transitions including error recovery.
   * When stage is 'delivered', also transitions booking status to delivered.
   */
  async updateDeliveryStage(
    tenantId: string,
    bookingId: string,
    dto: UpdateDeliveryStageDto,
  ): Promise<{ bookingId: string; courierStatus: string; bookingStatus: string }> {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, tenantId, deletedAt: null },
      select: {
        id: true,
        bookingNumber: true,
        status: true,
        courierStatus: true,
        courierStatusHistory: true,
      },
    });

    if (!booking) {
      throw new NotFoundException(`Booking ${bookingId} not found`);
    }

    // Must be in confirmed status (delivery module only manages confirmed bookings)
    if (booking.status !== 'confirmed') {
      throw new BadRequestException(
        `Booking must be in "confirmed" status for delivery stage changes. Current: "${booking.status}"`,
      );
    }

    // Map delivery stage to courier status slug
    const stageToSlug: Record<DeliveryStageEnum, CourierStatusSlug> = {
      [DeliveryStageEnum.PREPARE_PARCEL]: 'prepare_parcel',
      [DeliveryStageEnum.AWAITING_PICKUP]: 'pickup_pending',
      [DeliveryStageEnum.IN_TRANSIT]: 'in_transit',
      [DeliveryStageEnum.DELIVERED]: 'delivered',
      [DeliveryStageEnum.ERROR]: 'error',
    };

    const newCourierStatus = stageToSlug[dto.stage];

    // Append to history
    const history = this.getStatusHistory(booking.courierStatusHistory);
    history.push({
      status: newCourierStatus,
      label: dto.reason || COURIER_STATUS_LABELS[newCourierStatus],
      timestamp: new Date().toISOString(),
      source: 'manual',
    });

    // Build update data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {
      courierStatus: newCourierStatus,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      courierStatusHistory: history as any,
    };

    if (dto.stage === DeliveryStageEnum.ERROR) {
      updateData.courierErrorReason = dto.reason || 'Manually marked as error';
    } else {
      updateData.courierErrorReason = null;
    }

    await this.prisma.booking.update({
      where: { id: bookingId },
      data: updateData,
    });

    this.logger.log(
      `${booking.bookingNumber}: delivery stage manually set to ${newCourierStatus}` +
        (dto.reason ? ` — reason: ${dto.reason}` : ''),
    );

    // If delivered, also transition booking status
    let bookingStatus: string = booking.status;
    if (dto.stage === DeliveryStageEnum.DELIVERED) {
      try {
        const updated = await this.bookingService.updateStatus(tenantId, bookingId, 'delivered');
        bookingStatus = updated.status;
        this.logger.log(
          `Manual delivery: ${booking.bookingNumber} booking status → delivered`,
        );
      } catch (err) {
        this.logger.error(
          `Failed to update booking status for ${booking.bookingNumber}: ${(err as Error).message}`,
        );
      }
    }

    return {
      bookingId: booking.id,
      courierStatus: newCourierStatus,
      bookingStatus,
    };
  }

  // =========================================================================
  // AUTO-SCHEDULE PICKUP (event-driven)
  // =========================================================================

  /**
   * Listens for booking.confirmed events.
   * Sets the delivery stage to 'prepare_parcel' and schedules a pickup.
   */
  @OnEvent('booking.confirmed')
  async onBookingConfirmed(payload: {
    tenantId: string;
    bookingId: string;
    bookingNumber: string;
  }): Promise<void> {
    const { tenantId, bookingId, bookingNumber } = payload;

    try {
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

      // Calculate pickup date using district-based lead days
      const { pickupDate, leadDays } = await this.calculatePickupDate(tenantId, booking);

      // Set delivery stage to prepare_parcel immediately
      const statusEvent: CourierStatusEvent = {
        status: 'prepare_parcel',
        label: 'Parcel preparation started',
        timestamp: new Date().toISOString(),
        source: 'system',
      };

      await this.prisma.booking.update({
        where: { id: bookingId },
        data: {
          courierStatus: 'prepare_parcel',
          scheduledPickupAt: pickupDate,
          deliveryLeadDays: leadDays,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          courierStatusHistory: [statusEvent] as any,
        },
      });

      // Check if tenant has courier API configured for auto-scheduling
      const courierSettings = await this.getTenantCourierSettings(tenantId);
      const hasApiCourier = courierSettings.pathao?.enabled || courierSettings.steadfast?.enabled;

      if (hasApiCourier) {
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
          `${bookingNumber}: prepare_parcel → auto-pickup scheduled at ${pickupDate.toISOString()} ` +
            `(${leadDays}-day lead, ${Math.ceil(delayMs / (1000 * 60 * 60))}h from now)`,
        );
      } else {
        this.logger.log(
          `${bookingNumber}: prepare_parcel (manual delivery — no auto-pickup scheduled)`,
        );
      }
    } catch (err) {
      this.logger.error(
        `Failed to initialize delivery for ${bookingNumber}: ${(err as Error).message}`,
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
        courierStatus: true,
        deliveryName: true,
        deliveryPhone: true,
        deliveryAddressLine1: true,
        deliveryCity: true,
        grandTotal: true,
        paymentMethod: true,
        totalPaid: true,
        courierConsignmentId: true,
        courierStatusHistory: true,
      },
    });

    if (!booking) {
      this.logger.warn(`requestPickup: Booking ${bookingId} not found`);
      return;
    }

    // Don't request pickup if booking was cancelled or not confirmed
    if (booking.status !== 'confirmed') {
      this.logger.warn(
        `requestPickup: Booking ${booking.bookingNumber} is ${booking.status}, skipping pickup`,
      );
      return;
    }

    // Only proceed if in prepare_parcel stage
    if (booking.courierStatus !== 'prepare_parcel') {
      this.logger.warn(
        `requestPickup: Booking ${booking.bookingNumber} delivery stage is ${booking.courierStatus}, skipping`,
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

      // Append to history
      const history = this.getStatusHistory(booking.courierStatusHistory);
      history.push({
        status: 'pickup_pending',
        label: COURIER_STATUS_LABELS.pickup_pending,
        timestamp: new Date().toISOString(),
        source: 'system',
      });

      await this.prisma.booking.update({
        where: { id: bookingId },
        data: {
          trackingNumber: parcelResult.trackingId,
          courierProvider: 'pathao',
          courierConsignmentId: parcelResult.trackingId,
          courierStatus: 'pickup_pending',
          courierErrorReason: null,
          pickupRequestedAt: new Date(),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          courierStatusHistory: history as any,
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

      // Mark as error so tenant can see it in the dashboard
      const history = this.getStatusHistory(booking.courierStatusHistory);
      history.push({
        status: 'error',
        label: `Pickup Request Failed: ${(err as Error).message}`,
        timestamp: new Date().toISOString(),
        source: 'system',
      });

      await this.prisma.booking.update({
        where: { id: bookingId },
        data: {
          courierStatus: 'error',
          courierErrorReason: `Auto-pickup failed: ${(err as Error).message}`,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          courierStatusHistory: history as any,
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
  // CHECK STUCK PICKUPS (CRON job)
  // =========================================================================

  /**
   * Finds bookings stuck in 'pickup_pending' for 3+ days and marks them as error.
   * Called by the CRON scheduler every 6 hours.
   */
  async checkStuckPickups(): Promise<void> {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const stuckBookings = await this.prisma.booking.findMany({
      where: {
        courierStatus: 'pickup_pending',
        pickupRequestedAt: { lt: threeDaysAgo },
        status: 'confirmed',
        deletedAt: null,
      },
      select: {
        id: true,
        tenantId: true,
        bookingNumber: true,
        courierStatusHistory: true,
      },
    });

    if (stuckBookings.length === 0) return;

    this.logger.log(`Found ${stuckBookings.length} stuck pickup(s), marking as error...`);

    for (const booking of stuckBookings) {
      const history = this.getStatusHistory(booking.courierStatusHistory);
      history.push({
        status: 'error',
        label: 'Pickup not completed within 3 days — auto-marked as error',
        timestamp: new Date().toISOString(),
        source: 'system',
      });

      await this.prisma.booking.update({
        where: { id: booking.id },
        data: {
          courierStatus: 'error',
          courierErrorReason: 'Pickup not completed within 3 days',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          courierStatusHistory: history as any,
        },
      });

      this.logger.warn(`${booking.bookingNumber}: stuck pickup auto-marked as error`);

      // Notify owner
      this.eventEmitter.emit('fulfillment.stuckPickup', {
        tenantId: booking.tenantId,
        bookingId: booking.id,
        bookingNumber: booking.bookingNumber,
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
          notIn: ['delivered', 'returned_to_sender', 'cancelled', 'prepare_parcel', 'error'],
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
    const history = this.getStatusHistory(shipment.courierStatusHistory);
    history.push({
      status: newStatus,
      label: COURIER_STATUS_LABELS[newStatus] ?? info.rawStatus,
      timestamp: info.updatedAt ?? new Date().toISOString(),
      source: 'pathao',
    });

    // Update booking courier status
    await this.prisma.booking.update({
      where: { id: shipment.id },
      data: {
        courierStatus: newStatus,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
   * - delivered → booking becomes DELIVERED (confirmed → delivered)
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
    // Auto-mark as DELIVERED when courier delivers
    if (
      newCourierStatus === 'delivered' &&
      shipment.status === 'confirmed'
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
   * - Grouped counts by delivery stage (5 groups)
   * - Paginated list of active deliveries
   */
  async getDeliveryDashboard(
    tenantId: string,
    filters?: {
      courierStatus?: string[];
      stage?: DeliveryStageGroup;
      page?: number;
      limit?: number;
    },
  ) {
    const page = filters?.page ?? 1;
    const limit = Math.min(filters?.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    // Get counts by courier status (only bookings with delivery tracking)
    const statusCounts = await this.prisma.booking.groupBy({
      by: ['courierStatus'],
      where: {
        tenantId,
        courierStatus: { not: null },
        deletedAt: null,
      },
      _count: true,
    });

    // Build stage-grouped summary
    const stageSummary: Record<DeliveryStageGroup, number> = {
      prepare_parcel: 0,
      awaiting_pickup: 0,
      in_transit: 0,
      delivered: 0,
      error: 0,
    };

    const rawSummary: Record<string, number> = {};
    for (const group of statusCounts) {
      if (group.courierStatus) {
        rawSummary[group.courierStatus] = group._count;
        const stageGroup = COURIER_STATUS_TO_STAGE[group.courierStatus as CourierStatusSlug] ?? 'error';
        stageSummary[stageGroup] += group._count;
      }
    }

    // Build deliveries query
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
      tenantId,
      courierStatus: { not: null },
      deletedAt: null,
    };

    // Filter by stage group or specific courier statuses
    if (filters?.stage) {
      const slugsForStage = Object.entries(COURIER_STATUS_TO_STAGE)
        .filter(([, group]) => group === filters.stage)
        .map(([slug]) => slug);
      where.courierStatus = { in: slugsForStage };
    } else if (filters?.courierStatus?.length) {
      where.courierStatus = { in: filters.courierStatus };
    }

    const [deliveries, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        skip,
        take: limit,
        orderBy: [
          { scheduledPickupAt: 'asc' },
          { createdAt: 'desc' },
        ],
        select: {
          id: true,
          bookingNumber: true,
          status: true,
          courierProvider: true,
          courierConsignmentId: true,
          courierStatus: true,
          courierStatusHistory: true,
          courierErrorReason: true,
          trackingNumber: true,
          pickupRequestedAt: true,
          scheduledPickupAt: true,
          deliveryLeadDays: true,
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

    return {
      summary: rawSummary,
      stageSummary,
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
    const history = this.getStatusHistory(booking.courierStatusHistory);
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
   * Legacy webhook status handler for Steadfast.
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
      booking.status === 'confirmed'
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
   * Calculates the pickup date using district-based lead days.
   * Looks up the delivery city/district in the tenant's pickupLeadDaysConfig.
   */
  private async calculatePickupDate(
    tenantId: string,
    booking: {
      deliveryCity: string;
      items: { startDate: Date }[];
    },
  ): Promise<{ pickupDate: Date; leadDays: number }> {
    // Find the earliest item start date
    const earliestStart = booking.items.reduce<Date | null>((min, item) => {
      return !min || item.startDate < min ? item.startDate : min;
    }, null);

    if (!earliestStart) {
      return { pickupDate: new Date(), leadDays: 0 };
    }

    const settings = await this.prisma.storeSettings.findUnique({
      where: { tenantId },
      select: {
        pickupLeadDays: true,
        pickupLeadDaysConfig: true,
      },
    });

    // Determine lead days from district config
    let leadDays = settings?.pickupLeadDays ?? 2;

    if (settings?.pickupLeadDaysConfig) {
      const config = settings.pickupLeadDaysConfig as unknown as DistrictLeadDaysConfig;
      const deliveryDistrict = booking.deliveryCity.toLowerCase().trim();

      if (config.districtLeadDays && deliveryDistrict) {
        leadDays = config.districtLeadDays[deliveryDistrict] ?? config.defaultLeadDays ?? leadDays;
      }
    }

    // Calculate pickup date = earliestStart - leadDays
    const pickupDate = new Date(earliestStart);
    pickupDate.setDate(pickupDate.getDate() - leadDays);

    // If pickup date is in the past, request immediately
    const now = new Date();
    if (pickupDate < now) {
      return { pickupDate: now, leadDays };
    }

    // Set pickup to 12:01 AM on the pickup date (send before 12 PM cutoff)
    pickupDate.setHours(0, 1, 0, 0);

    return { pickupDate, leadDays };
  }

  /**
   * Extracts courier status history from booking JSON field.
   */
  private getStatusHistory(raw: unknown): CourierStatusEvent[] {
    return Array.isArray(raw) ? [...(raw as CourierStatusEvent[])] : [];
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
