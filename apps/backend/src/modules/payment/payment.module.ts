import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { PaymentService } from './payment.service';
import {
  PaymentGuestController,
  PaymentOwnerController,
  DepositController,
} from './payment.controller';

/**
 * Payment Module — P08 Payment & Deposit System.
 *
 * Handles: Payment recording (manual COD/bKash/Nagad), SSLCommerz gateway
 * integration (init, IPN, redirects), deposit lifecycle management
 * (collect, refund, forfeit), and payment queries.
 *
 * Depends on:
 * - PrismaModule for database access
 * - EventEmitterModule (global, imported in AppModule)
 * - ConfigModule (global, imported in AppModule)
 */
@Module({
  imports: [PrismaModule],
  controllers: [
    PaymentGuestController,
    PaymentOwnerController,
    DepositController,
  ],
  providers: [PaymentService],
  exports: [PaymentService],
})
export class PaymentModule {}
