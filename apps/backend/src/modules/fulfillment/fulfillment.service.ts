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
 */

import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
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
  // SHIP ORDER
  // =========================================================================

  /**
   * Ships an order:
   * 1. Loads the booking and its tenant's courier settings
   * 2. If useApi = true, calls the courier adapter to create a parcel
   * 3. Delegates the status update (confirmed → shipped) to BookingService
   *
   * Returns the updated booking with tracking details.
   */
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
    // Load booking to get order number + delivery address for parcel creation
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
      // Fetch tenant courier settings
      const courierSettings = await this.getTenantCourierSettings(tenantId);

      // COD amount: remaining balance if payment method is COD, else 0
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

      // Call the correct adapter
      switch (dto.courierProvider) {
        case CourierProviderEnum.PATHAO: {
          const pathaoConfig = courierSettings.pathao;
          if (!pathaoConfig?.enabled || !pathaoConfig.clientId) {
            throw new BadRequestException('Pathao is not configured or enabled for this tenant. Please set up Pathao credentials in Store Settings.');
          }
          parcelResult = await this.pathaoAdapter.createParcel(createParams, pathaoConfig);
          break;
        }
        case CourierProviderEnum.STEADFAST: {
          const steadfastConfig = courierSettings.steadfast;
          if (!steadfastConfig?.enabled || !steadfastConfig.apiKey) {
            throw new BadRequestException('Steadfast is not configured or enabled for this tenant. Please set up Steadfast credentials in Store Settings.');
          }
          parcelResult = await this.steadfastAdapter.createParcel(createParams, steadfastConfig);
          break;
        }
        default:
          throw new BadRequestException(`Unsupported courier provider for API mode: ${dto.courierProvider}`);
      }

      trackingNumber = parcelResult.trackingId;
    } else if (dto.courierProvider === CourierProviderEnum.MANUAL) {
      // Manual mode: just use the ShipBookingDto pattern already in BookingService
      parcelResult = await this.manualAdapter.createParcel({
        merchantOrderId: booking.bookingNumber,
        recipientName: booking.deliveryName,
        recipientPhone: booking.deliveryPhone,
        recipientAddress: booking.deliveryAddressLine1,
        recipientCity: booking.deliveryCity,
        codAmount: dto.codAmount ?? 0,
      });
    }

    // Delegate state machine update to BookingService (it owns the transitions)
    const updated = await this.bookingService.shipBooking(tenantId, bookingId, {
      trackingNumber: trackingNumber ?? undefined,
      courierProvider: dto.courierProvider,
    });

    this.logger.log(
      `Order ${booking.bookingNumber} shipped via ${dto.courierProvider}` +
        (trackingNumber ? ` — tracking: ${trackingNumber}` : ' (no tracking)'),
    );

    // Emit enriched event for notification module (ADR-05, ADR-27)
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
  // TRACK ORDER
  // =========================================================================

  /**
   * Fetches live tracking status from the courier API for a booking.
   * Returns the normalised tracking result.
   */
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
      throw new BadRequestException('This order has no tracking number. It may have been shipped manually without a tracking number.');
    }

    const provider = booking.courierProvider as CourierProviderEnum | null;

    if (!provider || provider === CourierProviderEnum.MANUAL) {
      // Manual — no live tracking available
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

  /**
   * Calculates shipping rate between two cities.
   * Returns null for providers that don't support rate queries.
   */
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
        return this.pathaoAdapter.calculateShipping(params);
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
  // WEBHOOK PROCESSING
  // =========================================================================

  /**
   * Processes a Pathao webhook payload.
   * Auto-updates booking status when courier reports delivery/return.
   */
  async processPathaoWebhook(payload: PathaoWebhookPayload): Promise<void> {
    const trackingId = payload.consignment_id;
    const rawStatus = payload.order_status ?? '';

    this.logger.log(`Pathao webhook: ${trackingId} → "${rawStatus}"`);

    // Find the booking by tracking number
    const booking = await this.prisma.booking.findFirst({
      where: { trackingNumber: trackingId },
      select: { id: true, tenantId: true, status: true, bookingNumber: true },
    });

    if (!booking) {
      this.logger.warn(`Pathao webhook: no booking found for tracking ID ${trackingId}`);
      return;
    }

    await this.applyWebhookStatus(booking, 'pathao', rawStatus);
  }

  /**
   * Processes a Steadfast webhook payload.
   */
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
   * Maps a courier's raw status to a booking state transition and applies it.
   * Only auto-transitions when the booking is in a state that allows it.
   */
  private async applyWebhookStatus(
    booking: { id: string; tenantId: string; status: string; bookingNumber: string },
    provider: string,
    rawStatus: string,
  ): Promise<void> {
    const lowerStatus = rawStatus.toLowerCase();

    // Auto-transition: Delivered → booking status 'delivered'
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

    // Returned to sender — alert owner but don't auto-transition
    // (owner must handle manual inspection)
    if (lowerStatus.includes('return')) {
      this.eventEmitter.emit('fulfillment.courier.return_alert', {
        tenantId: booking.tenantId,
        bookingId: booking.id,
        bookingNumber: booking.bookingNumber,
        provider,
        rawStatus,
      });
      this.logger.warn(
        `Webhook (${provider}): Booking ${booking.bookingNumber} returned to sender — manual owner action needed`,
      );
    }
  }

  /**
   * Loads tenant courier settings from StoreSettings individual columns and
   * constructs a CourierSettings object.
   *
   * Schema columns used:
   * - defaultCourier: string | null
   * - courierApiKey: string | null  (Pathao client_id OR Steadfast api_key)
   * - courierSecretKey: string | null (Pathao client_secret OR Steadfast secret_key)
   * - pickupAddress: string | null
   *
   * Because P09 needs to support two separate courier credentials,
   * we store Pathao config in courierApiKey/courierSecretKey when
   * defaultCourier = 'pathao', and Steadfast creds when defaultCourier = 'steadfast'.
   * For full per-tenant dual-courier config, P16 (Settings UI) will manage this
   * via an extended settings endpoint.
   */
  private async getTenantCourierSettings(tenantId: string): Promise<CourierSettings> {
    const settings = await this.prisma.storeSettings.findUnique({
      where: { tenantId },
      select: {
        defaultCourier: true,
        courierApiKey: true,
        courierSecretKey: true,
        pickupAddress: true,
      },
    });

    if (!settings) return {};

    const result: CourierSettings = {
      defaultProvider: (settings.defaultCourier as CourierSettings['defaultProvider']) ?? undefined,
    };

    // Build Pathao config from stored credentials
    // We use courierApiKey=clientId, courierSecretKey=clientSecret
    // Pathao also needs username/password — stored as sub-values separated by '|'
    // Format: courierApiKey = "clientId|username", courierSecretKey = "clientSecret|password"
    if (settings.defaultCourier === 'pathao' && settings.courierApiKey) {
      const [clientId, username] = (settings.courierApiKey ?? '').split('|');
      const [clientSecret, password] = (settings.courierSecretKey ?? '').split('|');

      result.pathao = {
        enabled: !!(clientId && username && clientSecret && password),
        clientId: clientId ?? '',
        clientSecret: clientSecret ?? '',
        username: username ?? '',
        password: password ?? '',
        defaultStoreId: 0, // Owner must configure this in settings
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
