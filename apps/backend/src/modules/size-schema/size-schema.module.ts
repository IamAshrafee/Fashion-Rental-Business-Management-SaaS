import { Module } from '@nestjs/common';
import { SizeSchemaService } from './size-schema.service';
import { SizeSchemaController } from './size-schema.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SizeSchemaController],
  providers: [SizeSchemaService],
  exports: [SizeSchemaService],
})
export class SizeSchemaModule {}
