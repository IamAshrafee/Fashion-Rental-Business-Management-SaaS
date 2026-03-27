import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { CustomerService } from './customer.service';
import { CustomerController } from './customer.controller';
import { CustomerListener } from './customer.listener';

/**
 * Customer Module — P05 Customer Management.
 *
 * Handles: Customer CRUD, phone-based deduplication, tag management,
 * checkout auto-fill lookup, and event-driven stats updates.
 */
@Module({
  imports: [PrismaModule],
  controllers: [CustomerController],
  providers: [CustomerService, CustomerListener],
  exports: [CustomerService],
})
export class CustomerModule {}
