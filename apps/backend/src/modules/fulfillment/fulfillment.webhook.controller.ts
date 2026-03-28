/**
 * Courier Webhook Controller — P09 Order Fulfillment & Logistics
 *
 * Public endpoint that receives status updates from courier APIs.
 * These are @Public() — no JWT auth since couriers call this directly.
 *
 * Route: POST /api/v1/webhooks/courier/:provider
 */

import {
  Controller,
  Post,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { FulfillmentService } from './fulfillment.service';
import { Public } from '../../common/decorators/public.decorator';
import { PathaoWebhookPayload, SteadfastWebhookPayload } from './dto/fulfillment.dto';

@Controller('webhooks/courier')
export class CourierWebhookController {
  private readonly logger = new Logger(CourierWebhookController.name);

  constructor(private readonly fulfillmentService: FulfillmentService) {}

  /**
   * POST /api/v1/webhooks/courier/:provider
   *
   * Receives courier status webhooks. The :provider param routes to the
   * correct parser (pathao | steadfast).
   *
   * Always returns HTTP 200 with { received: true } to prevent courier retry storms.
   * Processing errors are logged but not surfaced to the courier.
   */
  @Public()
  @Post(':provider')
  @HttpCode(HttpStatus.OK)
  async receiveWebhook(
    @Param('provider') provider: string,
    @Body() body: unknown,
  ): Promise<{ received: boolean }> {
    this.logger.log(`Courier webhook received from provider: ${provider}`);

    try {
      switch (provider.toLowerCase()) {
        case 'pathao':
          await this.fulfillmentService.processPathaoWebhook(
            body as PathaoWebhookPayload,
          );
          break;

        case 'steadfast':
          await this.fulfillmentService.processSteadfastWebhook(
            body as SteadfastWebhookPayload,
          );
          break;

        default:
          // Log unknown provider but still return 200 to avoid retry storms
          this.logger.warn(`Unknown courier provider in webhook: ${provider}`);
      }
    } catch (err) {
      // Log processing errors but return 200 — courier webhooks must not 5xx
      this.logger.error(
        `Webhook processing error for provider "${provider}": ${(err as Error).message}`,
        (err as Error).stack,
      );
    }

    // Always acknowledge receipt
    return { received: true };
  }
}
