import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { InventoryAssignmentService } from './inventory-assignment.service';
import { InventoryAvailabilityService } from './inventory-availability.service';
import { InventoryGuestController, InventoryOwnerController } from './inventory.controller';
import { InventoryManagementService } from './inventory-management.service';
import { InventoryReservationService } from './inventory-reservation.service';

@Module({
  imports: [PrismaModule],
  controllers: [InventoryGuestController, InventoryOwnerController],
  providers: [
    InventoryAvailabilityService,
    InventoryManagementService,
    InventoryReservationService,
    InventoryAssignmentService,
  ],
  exports: [InventoryAvailabilityService, InventoryReservationService],
})
export class InventoryModule {}

