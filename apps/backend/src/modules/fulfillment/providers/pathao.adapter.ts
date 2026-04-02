/**
 * Pathao Courier Adapter — P09 Order Fulfillment & Logistics
 *
 * Implements the CourierProvider interface for Pathao (Bangladesh's leading courier).
 * Uses password-grant OAuth flow to obtain a Bearer token, then creates/tracks parcels.
 *
 * Key features:
 * - Auto-address resolution (omit city/zone/area — Pathao resolves from address text)
 * - Comprehensive status normalization for 15+ Pathao raw statuses
 * - Token caching with auto-refresh
 * - Order info endpoint for polling
 *
 * Pathao API base: https://api-hermes.pathao.com/aladdin/api/v1/
 */

import { Injectable, Logger, ServiceUnavailableException, NotImplementedException, BadRequestException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';
import {
  CourierProvider,
  CreateParcelParams,
  CancelResult,
  ParcelResult,
  ShippingRate,
  ShippingRateParams,
  TrackingResult,
  PathaoConfig,
  CourierStatusSlug,
} from './courier-provider.interface';

interface PathaoToken {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix timestamp in ms
}

interface PathaoParcelResponse {
  code: number;
  message: string;
  data?: {
    consignment_id: string;
    order_status: string;
    delivery_fee: number;
  };
}

interface PathaoOrderInfoResponse {
  code: number;
  message: string;
  data?: {
    consignment_id: string;
    merchant_order_id: string;
    order_status: string;
    order_status_slug: string;
    updated_at: string;
    invoice_id: string | null;
  };
}

interface PathaoPriceResponse {
  code: number;
  message: string;
  data?: {
    price: number;
    discount: number;
    promo_discount: number;
    plan_id: number;
    cod_percentage: number;
    additional_charge: number;
    final_price: number;
  };
}

const PATHAO_PROD_URL = 'https://api-hermes.pathao.com/aladdin/api/v1';
const PATHAO_SANDBOX_URL = 'https://courier-api-sandbox.pathao.com/aladdin/api/v1';

/**
 * Comprehensive mapping of Pathao's raw status strings to our normalised courier status slugs.
 *
 * Pathao uses various status strings across their lifecycle. This map covers
 * all known statuses (case-insensitive matching via keyword search).
 */
const PATHAO_STATUS_MAP: Array<{ keywords: string[]; slug: CourierStatusSlug }> = [
  // Pickup phase
  { keywords: ['pickup pending', 'pickup request'], slug: 'pickup_pending' },
  { keywords: ['pickup assigned', 'assign pickup'], slug: 'pickup_assigned' },
  { keywords: ['picked up', 'pickup done', 'pickup completed'], slug: 'picked_up' },

  // Transit phase
  { keywords: ['at sorting hub', 'sorting hub', 'at hub', 'received at'], slug: 'at_hub' },
  { keywords: ['in transit', 'on the way'], slug: 'in_transit' },
  { keywords: ['at destination', 'destination hub', 'received at destination'], slug: 'at_destination' },

  // Delivery phase
  { keywords: ['out for delivery', 'delivery assigned', 'delivery man'], slug: 'out_for_delivery' },
  { keywords: ['partial delivered', 'partial delivery'], slug: 'partial_delivered' },
  { keywords: ['delivered'], slug: 'delivered' }, // Must come after 'partial delivered'

  // Return/Hold/Cancel
  { keywords: ['return'], slug: 'returned_to_sender' },
  { keywords: ['hold', 'on hold'], slug: 'on_hold' },
  { keywords: ['cancel'], slug: 'cancelled' },
];

/**
 * Maps Pathao's raw order status to our normalised CourierStatusSlug.
 * Uses keyword matching (case-insensitive) against known patterns.
 */
export function normalisePathaoStatus(rawStatus: string): CourierStatusSlug {
  const s = rawStatus.toLowerCase().trim();

  // Check 'partial delivered' before 'delivered' (order matters in the list)
  for (const entry of PATHAO_STATUS_MAP) {
    for (const keyword of entry.keywords) {
      if (s.includes(keyword)) return entry.slug;
    }
  }

  // Pathao initial status after order creation
  if (s === 'pending') return 'pickup_pending';

  return 'unknown';
}

/**
 * Maps our CourierStatusSlug back to a normalised TrackingResult status.
 */
function toNormalisedTrackingStatus(slug: CourierStatusSlug): TrackingResult['normalisedStatus'] {
  switch (slug) {
    case 'delivered':
      return 'delivered';
    case 'returned_to_sender':
      return 'returned';
    case 'pickup_pending':
    case 'pickup_assigned':
    case 'picked_up':
    case 'at_hub':
    case 'in_transit':
    case 'at_destination':
    case 'out_for_delivery':
      return 'in_transit';
    default:
      return 'unknown';
  }
}

@Injectable()
export class PathaoAdapter implements CourierProvider {
  private readonly logger = new Logger(PathaoAdapter.name);

  /**
   * In-memory token cache, keyed by a string that uniquely identifies the Pathao credentials.
   * This avoids fetching a new token on every API call.
   */
  private readonly tokenCache = new Map<string, PathaoToken>();

  constructor(private readonly httpService: HttpService) {}

  // ---------------------------------------------------------------------------
  // Token Management
  // ---------------------------------------------------------------------------

  private getBaseUrl(config: PathaoConfig): string {
    return config.sandbox ? PATHAO_SANDBOX_URL : PATHAO_PROD_URL;
  }

  private cacheKey(config: PathaoConfig): string {
    return `${config.clientId}:${config.username}`;
  }

  async fetchToken(config: PathaoConfig): Promise<string> {
    const key = this.cacheKey(config);
    const cached = this.tokenCache.get(key);
    const baseUrl = this.getBaseUrl(config);

    // Use cached token if still valid (with 60-second buffer)
    if (cached && cached.expiresAt > Date.now() + 60_000) {
      return cached.accessToken;
    }

    // Try refresh token first if we have one
    if (cached?.refreshToken) {
      try {
        const response = await firstValueFrom(
          this.httpService.post<{
            access_token: string;
            refresh_token: string;
            expires_in: number;
          }>(`${baseUrl}/issue-token`, {
            client_id: config.clientId,
            client_secret: config.clientSecret,
            grant_type: 'refresh_token',
            refresh_token: cached.refreshToken,
          }),
        );

        const { access_token, refresh_token, expires_in } = response.data;
        this.tokenCache.set(key, {
          accessToken: access_token,
          refreshToken: refresh_token,
          expiresAt: Date.now() + expires_in * 1000,
        });
        return access_token;
      } catch {
        // Refresh failed, fall through to password grant
        this.logger.warn('Pathao refresh token expired, falling back to password grant');
      }
    }

    // Password grant (initial auth)
    try {
      const response = await firstValueFrom(
        this.httpService.post<{
          access_token: string;
          refresh_token: string;
          expires_in: number;
        }>(`${baseUrl}/issue-token`, {
          client_id: config.clientId,
          client_secret: config.clientSecret,
          username: config.username,
          password: config.password,
          grant_type: 'password',
        }),
      );

      const { access_token, refresh_token, expires_in } = response.data;
      this.tokenCache.set(key, {
        accessToken: access_token,
        refreshToken: refresh_token,
        expiresAt: Date.now() + expires_in * 1000,
      });

      return access_token;
    } catch (error) {
      const axiosErr = error as AxiosError;
      const errorData = axiosErr.response?.data;
      const errorMsg = errorData ? JSON.stringify(errorData) : axiosErr.message;
      this.logger.error('Pathao token fetch failed', errorData ?? axiosErr.message);
      throw new ServiceUnavailableException(`Failed to authenticate with Pathao: ${errorMsg}`);
    }
  }

  // ---------------------------------------------------------------------------
  // CourierProvider Implementation
  // ---------------------------------------------------------------------------

  /**
   * Sanitizes phone numbers for Pathao API (must be exactly 11 digits, starting with 01)
   */
  private formatPathaoPhone(raw: string): string {
    let cleaned = raw.replace(/[\s\-()]/g, '');
    
    if (cleaned.startsWith('+880')) cleaned = cleaned.replace('+880', '0');
    else if (cleaned.startsWith('880')) cleaned = cleaned.replace('880', '0');
    else if (cleaned.startsWith('+88')) cleaned = cleaned.replace('+88', '');
    else if (cleaned.startsWith('88')) cleaned = cleaned.replace('88', '');

    if (!/^01\d{9}$/.test(cleaned)) {
      throw new BadRequestException(`Pathao Delivery requires a valid 11-digit Bangladeshi mobile number. Found: "${raw}"`);
    }
    return cleaned;
  }

  /**
   * Ensures the address is at least 10 chars, and appends city to aid Pathao's auto-resolver
   */
  private formatPathaoAddress(address: string, city?: string): string {
    let full = address.trim();
    if (city && city.trim() && !full.toLowerCase().includes(city.toLowerCase())) {
      full = `${full}, ${city.trim()}`;
    }
    if (full.length < 10) {
      full = `${full}, Bangladesh`;
    }
    if (full.length < 10) {
       throw new BadRequestException(`Pathao Delivery requires the address to be at least 10 characters long. Found: "${full}"`);
    }
    if (full.length > 220) {
       full = full.substring(0, 220);
    }
    return full;
  }

  /**
   * Ensures the name is between 3 and 64 characters (Pathao documentation says 100, but API enforces 64).
   */
  private formatPathaoName(name: string): string {
    const clean = name.trim();
    if (!clean || clean.length < 3) {
      return "Valued Customer";
    }
    if (clean.length > 64) return clean.substring(0, 64);
    return clean;
  }

  async createParcel(params: CreateParcelParams, config?: PathaoConfig): Promise<ParcelResult> {
    if (!config) {
      throw new ServiceUnavailableException('Pathao configuration not provided');
    }

    const recipientPhone = this.formatPathaoPhone(params.recipientPhone);
    const recipientAddress = this.formatPathaoAddress(params.recipientAddress, params.recipientCity);
    const recipientName = this.formatPathaoName(params.recipientName);

    const token = await this.fetchToken(config);
    const baseUrl = this.getBaseUrl(config);

    try {
      const qty = Math.max(1, Math.min(1000, Number(params.itemQuantity) || 1));
      const cod = Math.max(0, Math.min(900000, Number(params.codAmount) || 0));
      const wt = Math.max(0.001, Math.min(200, Number(params.weightKg) || 1));

      // Build payload — omit recipient_city/zone/area to use Pathao's
      // auto-address resolution from the recipient_address text
      const payload: Record<string, unknown> = {
        store_id: config.defaultStoreId,
        merchant_order_id: params.merchantOrderId,
        recipient_name: recipientName,
        recipient_phone: recipientPhone,
        recipient_address: recipientAddress,
        delivery_type: 48, // Standard delivery (48 hours)
        item_type: 2,      // Parcel (fashion items)
        item_quantity: Math.round(qty),
        item_weight: Number(wt.toFixed(3)),
        amount_to_collect: Math.round(cod),
        special_instruction: params.specialInstruction ?? '',
      };

      // Note: We intentionally DO NOT send recipient_city, recipient_zone,
      // or recipient_area. Per Pathao API docs, these are optional and "our
      // system will populate it automatically based on the recipient_address."
      // This gives better accuracy and avoids city/zone mismatch errors.

      const response = await firstValueFrom(
        this.httpService.post<PathaoParcelResponse>(
          `${baseUrl}/orders`,
          payload,
          { headers: { Authorization: `Bearer ${token}` } },
        ),
      );

      const data = response.data.data;
      if (!data) {
        throw new ServiceUnavailableException('Pathao returned no parcel data');
      }

      this.logger.log(`Pathao parcel created: ${data.consignment_id} for order ${params.merchantOrderId}`);

      return {
        trackingId: data.consignment_id,
        status: data.order_status,
        deliveryFee: data.delivery_fee ?? 0,
        raw: response.data,
      };
    } catch (error) {
      if (error instanceof ServiceUnavailableException || error instanceof BadRequestException) {
        throw error;
      }
      const axiosErr = error as AxiosError;
      const errorData = axiosErr.response?.data;
      
      let errorMsg = axiosErr.message;
      if (errorData) {
         try {
            errorMsg = typeof errorData === 'object' ? JSON.stringify(errorData) : String(errorData);
         } catch(e) {
            errorMsg = "Unparseable error data from Pathao";
         }
      }

      this.logger.error('Pathao createParcel failed', errorData ?? axiosErr.message);
      
      throw new ServiceUnavailableException(
        `Failed to create Pathao parcel: ${errorMsg}`,
      );
    }
  }

  /**
   * Get order short info — used by the polling job to check status updates.
   * Uses the /orders/{consignment_id}/info endpoint.
   */
  async getOrderInfo(
    consignmentId: string,
    config: PathaoConfig,
  ): Promise<{
    rawStatus: string;
    normalisedStatus: CourierStatusSlug;
    updatedAt: string | null;
  }> {
    const token = await this.fetchToken(config);
    const baseUrl = this.getBaseUrl(config);

    try {
      const response = await firstValueFrom(
        this.httpService.get<PathaoOrderInfoResponse>(
          `${baseUrl}/orders/${consignmentId}/info`,
          { headers: { Authorization: `Bearer ${token}` } },
        ),
      );

      const data = response.data.data;
      const rawStatus = data?.order_status ?? data?.order_status_slug ?? 'Unknown';

      return {
        rawStatus,
        normalisedStatus: normalisePathaoStatus(rawStatus),
        updatedAt: data?.updated_at ?? null,
      };
    } catch (error) {
      const axiosErr = error as AxiosError;
      this.logger.error(`Pathao getOrderInfo failed for ${consignmentId}`, axiosErr.message);
      throw new ServiceUnavailableException(
        `Failed to get Pathao order info for ${consignmentId}: ${axiosErr.message}`,
      );
    }
  }

  async trackParcel(trackingId: string, config?: PathaoConfig): Promise<TrackingResult> {
    if (!config) {
      throw new ServiceUnavailableException('Pathao configuration not provided');
    }

    const info = await this.getOrderInfo(trackingId, config);

    return {
      trackingId,
      rawStatus: info.rawStatus,
      normalisedStatus: toNormalisedTrackingStatus(info.normalisedStatus),
      updatedAt: info.updatedAt ? new Date(info.updatedAt) : undefined,
    };
  }

  async cancelParcel(_trackingId: string): Promise<CancelResult> {
    // Pathao does not offer a public cancel API in their standard merchant API.
    throw new NotImplementedException('Pathao does not support parcel cancellation via API. Cancel manually in the Pathao merchant portal.');
  }

  async calculateShipping(params: ShippingRateParams, config?: PathaoConfig): Promise<ShippingRate | null> {
    if (!config) return null;

    const token = await this.fetchToken(config);
    const baseUrl = this.getBaseUrl(config);

    try {
      const response = await firstValueFrom(
        this.httpService.post<PathaoPriceResponse>(
          `${baseUrl}/merchant/price-plan`,
          {
            store_id: config.defaultStoreId,
            item_type: 2,           // Parcel
            delivery_type: 48,      // Normal delivery
            item_weight: params.weightKg ?? 0.5,
            recipient_city: 1,      // Will need city_id mapping
            recipient_zone: 1,      // Will need zone_id mapping
          },
          { headers: { Authorization: `Bearer ${token}` } },
        ),
      );

      const data = response.data.data;
      if (!data) return null;

      return {
        cost: data.final_price,
        currency: 'BDT',
        note: `Delivery fee: ৳${data.price}, Discount: ৳${data.discount}`,
      };
    } catch (error) {
      this.logger.warn(`Pathao calculateShipping failed: ${(error as AxiosError).message}`);
      return null;
    }
  }
}
