import { Injectable, Logger } from '@nestjs/common';
import { ISmsProvider } from './sms.interface';

/**
 * Development SMS provider — logs to console instead of sending real SMS.
 * Production automatically uses the configured HTTP gateway provider.
 */
@Injectable()
export class DevSmsService implements ISmsProvider {
  private readonly logger = new Logger('SMS[dev]');

  async send(to: string, message: string): Promise<void> {
    this.logger.log(`📱 SMS → ${to}\n${message}`);
  }
}
