import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '../../prisma/prisma.module';
import { CustomerModule } from '../customer/customer.module';
import { BookingService } from './booking.service';
import { BookingSchedulerService } from './booking-scheduler.service';
import {
  BookingGuestController,
  BookingOwnerController,
  DateBlockController,
} from './booking.controller';
import { PricingEngineModule } from '../pricing-engine/pricing-engine.module'; // Added PricingEngineModule

/**
 * Booking Module — P07 Booking & Availability Engine.
 *
 * Handles: Availability checking, cart validation, atomic booking creation,
 * booking lifecycle state machine, late fee calculation, damage reports,
 * manual date blocking, and booking queries/stats.
 *
 * Depends on:
 * - PrismaModule for database access
 * - CustomerModule for find-or-create customer by phone
 * - ScheduleModule for automated overdue detection (M6)
 * - EventEmitterModule (global, imported in AppModule)
 */
@Module({
  imports: [PrismaModule, CustomerModule, PricingEngineModule, ScheduleModule.forRoot()],
  controllers: [
    BookingGuestController,
    BookingOwnerController,
    DateBlockController,
  ],
  providers: [BookingService, BookingSchedulerService],
  exports: [BookingService],
})
export class BookingModule {}
