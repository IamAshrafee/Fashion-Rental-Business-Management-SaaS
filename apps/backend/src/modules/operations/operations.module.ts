import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { BookingStageProjectorService } from './booking-stage-projector.service';
import { OperationalEventService } from './operational-event.service';
import { OperationsQueryService } from './operations-query.service';
import { BookingVersionService } from './booking-version.service';
import { StockUnitCustodyService } from './stock-unit-custody.service';
import { BookingReviewService } from './booking-review.service';
import { FulfillmentPreparationService } from './fulfillment-preparation.service';
import { BookingOperationsProjectionQueryService } from './booking-operations-projection-query.service';

@Module({
  imports: [PrismaModule],
  providers: [
    BookingStageProjectorService,
    BookingVersionService,
    OperationalEventService,
    OperationsQueryService,
    StockUnitCustodyService,
    BookingReviewService,
    FulfillmentPreparationService,
    BookingOperationsProjectionQueryService,
  ],
  exports: [
    BookingStageProjectorService,
    BookingVersionService,
    OperationalEventService,
    OperationsQueryService,
    StockUnitCustodyService,
    BookingReviewService,
    FulfillmentPreparationService,
    BookingOperationsProjectionQueryService,
  ],
})
export class OperationsModule {}
