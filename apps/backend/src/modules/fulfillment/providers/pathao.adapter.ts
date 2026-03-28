/**
 * Pathao Courier Adapter — P09 Order Fulfillment & Logistics
 *
 * Implements the CourierProvider interface for Pathao (Bangladesh's leading courier).
 * Uses password-grant OAuth flow to obtain a Bearer token, then creates/tracks parcels.
 *
 * Pathao API base: https://hermes-api.pathao.com/aladdin/api/v1/
 */

import { Injectable, Logger, ServiceUnavailableException, NotImplementedException } from '@nestjs/common';
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

interface PathaoTrackResponse {
  code: number;
  message: string;
  data?: {
    order_status: string;
    updated_at: string;
  };
}

const PATHAO_BASE_URL = 'https://hermes-api.pathao.com/aladdin/api/v1';

/**
 * Maps Pathao's raw order status to our normalised status.
 *
 * Pathao statuses we care about:
 * - "Delivered" → 'delivered'
 * - "Returned to Courier" / "Return" variants → 'returned'
 * - Everything else → 'in_transit' or 'unknown'
 */
function normalisePathaoStatus(status: string): TrackingResult['normalisedStatus'] {
  const s = status.toLowerCase();
  if (s.includes('delivered') && !s.includes('return')) return 'delivered';
  if (s.includes('return')) return 'returned';
  if (s.includes('transit') || s.includes('picked') || s.includes('pending')) return 'in_transit';
  return 'unknown';
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

  private cacheKey(config: PathaoConfig): string {
    return `${config.clientId}:${config.username}`;
  }

  private async fetchToken(config: PathaoConfig): Promise<string> {
    const key = this.cacheKey(config);
    const cached = this.tokenCache.get(key);

    // Use cached token if still valid (with 60-second buffer)
    if (cached && cached.expiresAt > Date.now() + 60_000) {
      return cached.accessToken;
    }

    try {
      const response = await firstValueFrom(
        this.httpService.post<{
          access_token: string;
          refresh_token: string;
          expires_in: number;
        }>(`${PATHAO_BASE_URL}/issue-token`, {
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
        // expires_in is in seconds; convert to ms
        expiresAt: Date.now() + expires_in * 1000,
      });

      return access_token;
    } catch (error) {
      this.logger.error('Pathao token fetch failed', (error as AxiosError).message);
      throw new ServiceUnavailableException('Failed to authenticate with Pathao courier API');
    }
  }

  // ---------------------------------------------------------------------------
  // CourierProvider Implementation
  // ---------------------------------------------------------------------------

  async createParcel(params: CreateParcelParams, config?: PathaoConfig): Promise<ParcelResult> {
    if (!config) {
      throw new ServiceUnavailableException('Pathao configuration not provided');
    }

    const token = await this.fetchToken(config);

    try {
      const response = await firstValueFrom(
        this.httpService.post<PathaoParcelResponse>(
          `${PATHAO_BASE_URL}/orders`,
          {
            store_id: config.defaultStoreId,
            merchant_order_id: params.merchantOrderId,
            recipient_name: params.recipientName,
            recipient_phone: params.recipientPhone,
            recipient_address: params.recipientAddress,
            // Pathao uses numeric city/zone IDs in production;
            // for v1 we pass the string as "recipient_city" fallback
            recipient_city: 1, // Dhaka default; tenant can configure
            recipient_zone: 1, // Default zone
            delivery_type: 48, // Standard delivery
            item_type: 2,      // Fashion / clothing
            item_quantity: params.itemQuantity ?? 1,
            item_weight: params.weightKg ?? 1,
            amount_to_collect: params.codAmount,
            special_instruction: params.specialInstruction ?? '',
          },
          {
            headers: { Authorization: `Bearer ${token}` },
          },
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
      if (error instanceof ServiceUnavailableException) throw error;
      const axiosErr = error as AxiosError;
      this.logger.error('Pathao createParcel failed', axiosErr.response?.data ?? axiosErr.message);
      throw new ServiceUnavailableException(
        `Failed to create Pathao parcel: ${axiosErr.message}`,
      );
    }
  }

  async trackParcel(trackingId: string, config?: PathaoConfig): Promise<TrackingResult> {
    if (!config) {
      throw new ServiceUnavailableException('Pathao configuration not provided');
    }

    const token = await this.fetchToken(config);

    try {
      const response = await firstValueFrom(
        this.httpService.get<PathaoTrackResponse>(
          `${PATHAO_BASE_URL}/orders/${trackingId}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        ),
      );

      const data = response.data.data;
      const rawStatus = data?.order_status ?? 'Unknown';

      return {
        trackingId,
        rawStatus,
        normalisedStatus: normalisePathaoStatus(rawStatus),
        updatedAt: data?.updated_at ? new Date(data.updated_at) : undefined,
        raw: response.data,
      };
    } catch (error) {
      const axiosErr = error as AxiosError;
      this.logger.error('Pathao trackParcel failed', axiosErr.message);
      throw new ServiceUnavailableException(
        `Failed to track Pathao parcel ${trackingId}: ${axiosErr.message}`,
      );
    }
  }

  async cancelParcel(_trackingId: string): Promise<CancelResult> {
    // Pathao does not offer a public cancel API in their standard merchant API.
    throw new NotImplementedException('Pathao does not support parcel cancellation via API. Cancel manually in the Pathao merchant portal.');
  }

  async calculateShipping(_params: ShippingRateParams): Promise<ShippingRate | null> {
    // Pathao does not provide a public rate calculation endpoint in v1.
    // Return null to signal the caller to use a manual or flat rate.
    return null;
  }
}
