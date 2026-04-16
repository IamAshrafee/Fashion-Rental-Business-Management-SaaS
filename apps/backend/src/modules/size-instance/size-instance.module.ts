import { Module } from '@nestjs/common';
import { SizeInstanceService } from './size-instance.service';
import { SizeInstanceController } from './size-instance.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SizeInstanceController],
  providers: [SizeInstanceService],
  exports: [SizeInstanceService],
})
export class SizeInstanceModule {}
