/**
 * Manual Courier Adapter — P09 Order Fulfillment & Logistics
 *
 * Implements CourierProvider for businesses that handle delivery themselves
 * or use a courier where no API integration is available.
 *
 * The owner enters the tracking number manually in the UI.
 * No external API calls are made.
 */

import { Injectable } from '@nestjs/common';
import {
  CourierProvider,
  CreateParcelParams,
  CancelResult,
  ParcelResult,
  ShippingRate,
  ShippingRateParams,
  TrackingResult,
} from './courier-provider.interface';

@Injectable()
export class ManualAdapter implements CourierProvider {
  /**
   * In manual mode, "creating a parcel" simply echoes back the merchantOrderId
   * as the tracking ID. The owner is responsible for entering the real tracking
   * number after actual dispatch.
   */
  async createParcel(params: CreateParcelParams): Promise<ParcelResult> {
    return {
      trackingId: params.merchantOrderId,
      status: 'manual',
      deliveryFee: 0,
    };
  }

  /**
   * Manual tracking — we cannot query an external system.
   * Returns 'unknown' status to indicate no live tracking data is available.
   */
  async trackParcel(trackingId: string): Promise<TrackingResult> {
    return {
      trackingId,
      rawStatus: 'manual',
      normalisedStatus: 'unknown',
    };
  }

  /**
   * Manual parcels can always be "cancelled" by the owner — just a no-op here
   * since there's no external system to notify.
   */
  async cancelParcel(_trackingId: string): Promise<CancelResult> {
    return { success: true, message: 'Manual shipment marked as cancelled' };
  }

  /**
   * Manual shipping rate — the owner sets the shipping fee directly in the
   * booking modification UI. No calculation needed.
   */
  async calculateShipping(_params: ShippingRateParams): Promise<ShippingRate | null> {
    return null;
  }
}
