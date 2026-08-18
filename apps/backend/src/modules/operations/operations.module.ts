import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { BookingStageProjectorService } from './booking-stage-projector.service';
import { OperationalEventService } from './operational-event.service';
import { OperationsQueryService } from './operations-query.service';
import { BookingVersionService } from './booking-version.service';
import { StockUnitCustodyService } from './stock-unit-custody.service';

@Module({
  imports: [PrismaModule],
  providers: [
    BookingStageProjectorService,
    BookingVersionService,
    OperationalEventService,
    OperationsQueryService,
    StockUnitCustodyService,
  ],
  exports: [
    BookingStageProjectorService,
    BookingVersionService,
    OperationalEventService,
    OperationsQueryService,
    StockUnitCustodyService,
  ],
})
export class OperationsModule {}
