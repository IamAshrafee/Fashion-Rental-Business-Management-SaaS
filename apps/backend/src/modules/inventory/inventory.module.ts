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
import { FulfillmentGuestController, FulfillmentOwnerController } from './fulfillment.controller';
import { FulfillmentService } from './fulfillment.service';
import { ProductCompositionService } from './product-composition.service';

@Module({
  imports: [PrismaModule],
  controllers: [
    InventoryGuestController,
    InventoryOwnerController,
    InventoryOperationsController,
    FulfillmentGuestController,
    FulfillmentOwnerController,
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
    FulfillmentService,
    ProductCompositionService,
  ],
  exports: [InventoryAvailabilityService, InventoryReservationService, FulfillmentService],
})
export class InventoryModule {}
