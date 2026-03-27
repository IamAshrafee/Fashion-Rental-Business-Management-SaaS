import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../prisma/prisma.module';
import { UploadService } from './upload.service';
import { UploadController } from './upload.controller';

/**
 * Upload Module — P04 Product Management.
 *
 * Handles: Image upload, validation, processing (Sharp → WebP), MinIO storage.
 */
@Module({
  imports: [
    PrismaModule,
    ConfigModule,
    MulterModule.register({
      limits: {
        fileSize: 10 * 1024 * 1024, // 10 MB
        files: 10,
      },
    }),
  ],
  controllers: [UploadController],
  providers: [UploadService],
  exports: [UploadService],
})
export class UploadModule {}
