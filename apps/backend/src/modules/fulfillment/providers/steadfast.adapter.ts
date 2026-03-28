/**
 * Steadfast Courier Adapter — P09 Order Fulfillment & Logistics
 *
 * Implements the CourierProvider interface for Steadfast (packzy.com).
 * Uses simple API Key + Secret Key header authentication.
 *
 * Steadfast API base: https://portal.packzy.com/api/v1/
 */

import { Injectable, Logger, NotImplementedException, ServiceUnavailableException } from '@nestjs/common';
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
  SteadfastConfig,
} from './courier-provider.interface';

interface SteadfastCreateResponse {
  status: number;
  message: string;
  consignment?: {
    consignment_id: number;
    tracking_code: string;
    status: string;
  };
}

interface SteadfastTrackResponse {
  status: number;
  delivery_status: string;
  updated_at: string;
}

const STEADFAST_BASE_URL = 'https://portal.packzy.com/api/v1';

/**
 * Maps Steadfast's delivery_status to our normalised status.
 *
 * Steadfast statuses:
 * - "delivered" → 'delivered'
 * - "partial_delivered" → 'delivered' (partially — owner needs manual review)
 * - "cancelled" / "hold" → 'unknown'
 * - "in_transit" / "in_review" → 'in_transit'
 */
function normaliseSteadfastStatus(status: string): TrackingResult['normalisedStatus'] {
  switch (status) {
    case 'delivered':
    case 'partial_delivered':
      return 'delivered';
    case 'in_transit':
    case 'in_review':
      return 'in_transit';
    case 'cancelled':
    case 'hold':
      return 'unknown';
    default:
      return 'unknown';
  }
}

@Injectable()
export class SteadfastAdapter implements CourierProvider {
  private readonly logger = new Logger(SteadfastAdapter.name);

  constructor(private readonly httpService: HttpService) {}

  private buildHeaders(config: SteadfastConfig): Record<string, string> {
    return {
      'Api-Key': config.apiKey,
      'Secret-Key': config.secretKey,
      'Content-Type': 'application/json',
    };
  }

  // ---------------------------------------------------------------------------
  // CourierProvider Implementation
  // ---------------------------------------------------------------------------

  async createParcel(params: CreateParcelParams, config?: SteadfastConfig): Promise<ParcelResult> {
    if (!config) {
      throw new ServiceUnavailableException('Steadfast configuration not provided');
    }

    try {
      const response = await firstValueFrom(
        this.httpService.post<SteadfastCreateResponse>(
          `${STEADFAST_BASE_URL}/create_order`,
          {
            invoice: params.merchantOrderId,
            recipient_name: params.recipientName,
            recipient_phone: params.recipientPhone,
            recipient_address: params.recipientAddress,
            cod_amount: params.codAmount,
            note: params.specialInstruction ?? '',
          },
          { headers: this.buildHeaders(config) },
        ),
      );

      if (response.data.status !== 200 || !response.data.consignment) {
        throw new ServiceUnavailableException(
          `Steadfast order creation failed: ${response.data.message}`,
        );
      }

      const { consignment } = response.data;
      this.logger.log(
        `Steadfast parcel created: ${consignment.tracking_code} for order ${params.merchantOrderId}`,
      );

      return {
        trackingId: consignment.tracking_code,
        status: consignment.status,
        deliveryFee: 0, // Steadfast doesn't return fee in creation response
        raw: response.data,
      };
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      const axiosErr = error as AxiosError;
      this.logger.error('Steadfast createParcel failed', axiosErr.response?.data ?? axiosErr.message);
      throw new ServiceUnavailableException(
        `Failed to create Steadfast parcel: ${axiosErr.message}`,
      );
    }
  }

  async trackParcel(trackingId: string, config?: SteadfastConfig): Promise<TrackingResult> {
    if (!config) {
      throw new ServiceUnavailableException('Steadfast configuration not provided');
    }

    try {
      const response = await firstValueFrom(
        this.httpService.get<SteadfastTrackResponse>(
          `${STEADFAST_BASE_URL}/status_by_cid/${trackingId}`,
          { headers: this.buildHeaders(config) },
        ),
      );

      const rawStatus = response.data.delivery_status ?? 'unknown';

      return {
        trackingId,
        rawStatus,
        normalisedStatus: normaliseSteadfastStatus(rawStatus),
        updatedAt: response.data.updated_at ? new Date(response.data.updated_at) : undefined,
        raw: response.data,
      };
    } catch (error) {
      const axiosErr = error as AxiosError;
      this.logger.error('Steadfast trackParcel failed', axiosErr.message);
      throw new ServiceUnavailableException(
        `Failed to track Steadfast parcel ${trackingId}: ${axiosErr.message}`,
      );
    }
  }

  async cancelParcel(_trackingId: string): Promise<CancelResult> {
    // Steadfast does not expose a public cancel API.
    throw new NotImplementedException(
      'Steadfast does not support parcel cancellation via API. Cancel manually in the Steadfast portal.',
    );
  }

  async calculateShipping(_params: ShippingRateParams): Promise<ShippingRate | null> {
    // Steadfast does not provide a rate calculation endpoint.
    return null;
  }
}
