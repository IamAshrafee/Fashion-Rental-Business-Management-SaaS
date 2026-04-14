/**
 * SMS Provider interface — all providers must implement this.
 * Swap the implementation in ProductionSmsService when a real provider is configured.
 */
export interface ISmsProvider {
  /**
   * Send an SMS message.
   * @param to - Phone number (any format, e.g. "01XXXXXXXXX" or "+880XXXXXXXXX")
   * @param message - UTF-8 / Unicode message body
   * @returns Delivery receipt ID or void if provider doesn't support it
   */
  send(to: string, message: string): Promise<string | void>;
}

export const SMS_PROVIDER_TOKEN = 'SMS_PROVIDER';

// --- SMS Template Types ---

export type SmsTemplate =
  | 'booking_placed'
  | 'booking_confirmed'
  | 'booking_cancelled'
  | 'pickup_requested'
  | 'return_reminder'
  | 'return_due_today'
  | 'booking_completed'
  | 'booking_overdue'
  | 'new_booking_owner'
  | 'subscription_expiring';

export interface SmsTemplateData {
  booking_placed: {
    bookingNumber: string;
    storeName: string;
  };
  booking_confirmed: {
    bookingNumber: string;
    deliveryDate: string;
    storeName: string;
  };
  booking_cancelled: {
    bookingNumber: string;
    phone: string;
    storeName: string;
  };
  pickup_requested: {
    bookingNumber: string;
    trackingLink?: string;
    storeName: string;
  };
  return_reminder: {
    returnDate: string;
    storeName: string;
  };
  return_due_today: {
    returnDate: string;
    storeName: string;
  };
  booking_completed: {
    depositAmount: number;
    storeName: string;
  };
  booking_overdue: {
    bookingNumber: string;
    storeName: string;
  };
  new_booking_owner: {
    bookingNumber: string;
    customerName: string;
    totalAmount: number;
  };
  subscription_expiring: {
    daysLeft: number;
    storeName: string;
  };
}
