import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PrismaModule } from '../../prisma/prisma.module';
import { BookingModule } from '../booking/booking.module';
import { FulfillmentService } from './fulfillment.service';
import { FulfillmentController } from './fulfillment.controller';
import { CourierWebhookController } from './fulfillment.webhook.controller';
import { PathaoAdapter } from './providers/pathao.adapter';
import { SteadfastAdapter } from './providers/steadfast.adapter';
import { ManualAdapter } from './providers/manual.adapter';

/**
 * Fulfillment Module — P09 Order Fulfillment & Logistics
 *
 * Handles courier integration (Pathao, Steadfast, Manual) and exposes:
 * - Owner endpoints: ship order, track, calculate rate
 * - Public webhook: receive courier status updates
 *
 * Depends on:
 * - PrismaModule: for reading booking/storeSettings data
 * - BookingModule: for delegating status transitions (state machine)
 * - HttpModule: for calling external courier APIs
 * - EventEmitterModule (global, imported in AppModule)
 */
@Module({
  imports: [
    PrismaModule,
    BookingModule, // Provides BookingService for state machine delegation
    HttpModule.register({
      timeout: 15_000,         // 15-second timeout for courier API calls
      maxRedirects: 3,
    }),
  ],
  controllers: [
    FulfillmentController,
    CourierWebhookController,
  ],
  providers: [
    FulfillmentService,
    PathaoAdapter,
    SteadfastAdapter,
    ManualAdapter,
  ],
  exports: [FulfillmentService],
})
export class FulfillmentModule {}
