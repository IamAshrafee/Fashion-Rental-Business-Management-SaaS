import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ISmsProvider } from './sms.interface';

@Injectable()
export class HttpSmsService implements ISmsProvider {
  constructor(private readonly config: ConfigService) {}

  async send(to: string, message: string): Promise<void> {
    const url = this.config.get<string>('sms.providerUrl');
    const apiKey = this.config.get<string>('sms.apiKey');
    const senderId = this.config.get<string>('sms.senderId');
    if (!url || !apiKey) throw new Error('Production SMS provider is not configured');
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ to, message, senderId }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      const responseText = (await response.text()).slice(0, 500);
      throw new Error(`SMS gateway returned ${response.status}: ${responseText}`);
    }
  }
}
