import { Injectable, Logger, Inject } from '@nestjs/common';
import { ISmsProvider, SMS_PROVIDER_TOKEN, SmsTemplate, SmsTemplateData } from './sms.interface';

/**
 * SmsService — facade over the SMS provider.
 * Formats messages from templates and delegates sending to the provider.
 * Add new templates here; never put raw message strings in listeners.
 */
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor(
    @Inject(SMS_PROVIDER_TOKEN)
    private readonly provider: ISmsProvider,
  ) {}

  /**
   * Send a templated SMS to a phone number.
   */
  async send<T extends SmsTemplate>(
    to: string,
    template: T,
    data: SmsTemplateData[T],
  ): Promise<void> {
    const message = this.renderTemplate(template, data as Record<string, unknown>);
    try {
      await this.provider.send(to, message);
    } catch (err) {
      // Log the failure but never let SMS errors crash the main flow
      this.logger.error(`Failed to send SMS to ${to}: ${(err as Error).message}`);
    }
  }

  // --------------------------------------------------------------------------
  // Private: Template renderer
  // --------------------------------------------------------------------------

  private renderTemplate(template: SmsTemplate, data: Record<string, unknown>): string {
    switch (template) {
      case 'booking_placed':
        return (
          `Your booking ${data.bookingNumber} has been placed! ` +
          `We'll confirm shortly. — ${data.storeName}`
        );

      case 'booking_confirmed':
        return (
          `Good news! Your booking ${data.bookingNumber} is confirmed. ` +
          `Delivery by ${data.deliveryDate}. — ${data.storeName}`
        );

      case 'booking_cancelled':
        return (
          `Your booking ${data.bookingNumber} has been cancelled. ` +
          `Contact us for questions: ${data.phone}. — ${data.storeName}`
        );

      case 'booking_shipped':
        return (
          `Your order ${data.bookingNumber} has been shipped! ` +
          `Track: ${data.trackingLink}. — ${data.storeName}`
        );

      case 'return_reminder':
        return (
          `Reminder: Please return your rental by tomorrow (${data.returnDate}). ` +
          `Late returns will be charged. — ${data.storeName}`
        );

      case 'return_due_today':
        return (
          `Your rental is due for return today (${data.returnDate}). ` +
          `Late returns will be charged. — ${data.storeName}`
        );

      case 'booking_completed':
        return (
          `Thank you! Your rental is complete and deposit of ৳${data.depositAmount} ` +
          `will be refunded within 3–5 business days. — ${data.storeName}`
        );

      case 'booking_overdue':
        return (
          `Your rental (${data.bookingNumber}) is overdue. ` +
          `Please return it immediately. Late fees apply. — ${data.storeName}`
        );

      case 'new_booking_owner':
        return (
          `New booking ${data.bookingNumber} from ${data.customerName}. ` +
          `৳${data.totalAmount}. Review in your dashboard.`
        );

      case 'subscription_expiring':
        return (
          `Your ClosetRent subscription expires in ${data.daysLeft} day(s). ` +
          `Please renew to avoid service interruption. — ${data.storeName}`
        );

      default:
        return '';
    }
  }
}
