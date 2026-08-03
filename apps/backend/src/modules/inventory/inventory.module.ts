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
import { InventoryFoundationController } from './inventory-foundation.controller';
import { InventoryLocationService } from './inventory-location.service';
import { InventoryPoolService } from './inventory-pool.service';
import { AvailabilityPolicyService } from './availability-policy.service';
import { InventoryTransferController } from './inventory-transfer.controller';
import { InventoryTransferService } from './inventory-transfer.service';
import { InventoryDashboardService } from './inventory-dashboard.service';

@Module({
  imports: [PrismaModule],
  controllers: [
    InventoryGuestController,
    InventoryOwnerController,
    InventoryOperationsController,
    FulfillmentGuestController,
    FulfillmentOwnerController,
    InventoryFoundationController,
    InventoryTransferController,
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
    InventoryLocationService,
    InventoryPoolService,
    AvailabilityPolicyService,
    InventoryTransferService,
    InventoryDashboardService,
  ],
  exports: [
    InventoryAvailabilityService,
    InventoryReservationService,
    FulfillmentService,
    InventoryLocationService,
    InventoryPoolService,
    AvailabilityPolicyService,
  ],
})
export class InventoryModule {}
