import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { InventoryAssignmentService } from './inventory-assignment.service';
import { InventoryAvailabilityService } from './inventory-availability.service';
import { InventoryGuestController, InventoryOwnerController } from './inventory.controller';
import { InventoryManagementService } from './inventory-management.service';
import { InventoryReservationService } from './inventory-reservation.service';
import { InventoryOperationsController } from './inventory-operations.controller';
import { InventoryServiceOrderService } from './inventory-service-order.service';
import { StockUnitInspectionService } from './stock-unit-inspection.service';
import { StockUnitLifecycleService } from './stock-unit-lifecycle.service';
import { StockUnitSetService } from './stock-unit-set.service';

@Module({
  imports: [PrismaModule],
  controllers: [
    InventoryGuestController,
    InventoryOwnerController,
    InventoryOperationsController,
  ],
  providers: [
    InventoryAvailabilityService,
    InventoryManagementService,
    InventoryReservationService,
    InventoryAssignmentService,
    StockUnitLifecycleService,
    StockUnitInspectionService,
    InventoryServiceOrderService,
    StockUnitSetService,
  ],
  exports: [InventoryAvailabilityService, InventoryReservationService],
})
export class InventoryModule {}
