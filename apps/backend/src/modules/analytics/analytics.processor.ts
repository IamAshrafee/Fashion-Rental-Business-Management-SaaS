import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { Logger } from '@nestjs/common';
import { StorefrontEventPayload } from '@closetrent/types';

@Processor('analytics-events')
export class AnalyticsProcessor {
  private readonly logger = new Logger(AnalyticsProcessor.name);

  constructor(private readonly prisma: PrismaService) {}

  @Process('track-event')
  async handleTrackEvent(job: Job<StorefrontEventPayload & { tenantId: string; ipAddress?: string; userAgent?: string }>) {
    const { tenantId, sessionId, eventType, productId, variantId, metadata, ipAddress, userAgent } = job.data;

    try {
      await this.prisma.storefrontEvent.create({
        data: {
          tenantId,
          sessionId,
          eventType,
          productId,
          variantId,
          metadata: metadata || {},
          ipAddress,
          userAgent,
        },
      });

      // Real-time popularity score increment (write-through)
      // product_view = +1 point, add_to_cart = +3 points (stronger purchase intent signal)
      if (productId && (eventType === 'product_view' || eventType === 'add_to_cart')) {
        const increment = eventType === 'add_to_cart' ? 3 : 1;
        await this.prisma.product.update({
          where: { id: productId },
          data: { popularityScore: { increment } },
        }).catch((err) => {
          // Non-critical — don't fail the event if the product doesn't exist
          this.logger.warn(`Failed to increment popularity for product ${productId}: ${err?.message}`);
        });
      }
    } catch (error: any) {
      this.logger.error(`Failed to ingest analytics event: ${error?.message}`, error?.stack);
      // We don't necessarily want to retry endlessly for analytics
      throw error;
    }
  }
}
