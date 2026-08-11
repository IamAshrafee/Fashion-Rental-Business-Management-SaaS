import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '../../prisma/prisma.module';
import { CustomerModule } from '../customer/customer.module';
import { BookingService } from './booking.service';
import { InventoryHoldSchedulerService } from './inventory-hold-scheduler.service';
import {
  BookingGuestController,
  BookingOwnerController,
} from './booking.controller';
import { PricingEngineModule } from '../pricing-engine/pricing-engine.module'; // Added PricingEngineModule
import { InventoryModule } from '../inventory/inventory.module';
import { StorefrontCartService } from './storefront-cart.service';

/**
 * Booking Module — P07 Booking & Availability Engine.
 *
 * Handles: Availability checking, cart validation, atomic booking creation,
 * booking lifecycle state machine, late fee calculation, damage reports,
 * inventory-aware availability, and booking queries/stats.
 *
 * Depends on:
 * - PrismaModule for database access
 * - CustomerModule for find-or-create customer by phone
 * - ScheduleModule for expiring abandoned inventory holds
 * - EventEmitterModule (global, imported in AppModule)
 */
@Module({
  imports: [
    PrismaModule,
    CustomerModule,
    PricingEngineModule,
    InventoryModule,
    ScheduleModule.forRoot(),
  ],
  controllers: [BookingGuestController, BookingOwnerController],
  providers: [BookingService, StorefrontCartService, InventoryHoldSchedulerService],
  exports: [BookingService, StorefrontCartService],
})
export class BookingModule {}
