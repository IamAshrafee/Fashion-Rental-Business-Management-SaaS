import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseTransformInterceptor } from './common/interceptors/response-transform.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { JobsService } from './modules/jobs/jobs.service';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import cookieParser from 'cookie-parser';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  // Global prefix
  app.setGlobalPrefix('api/v1');

  // CORS
  const corsOrigins = configService.get<string>('CORS_ORIGINS', 'http://localhost:3000');
  app.enableCors({
    origin: corsOrigins.split(',').map((origin) => origin.trim()),
    credentials: true,
  });

  // Cookie parser
  app.use(cookieParser());

  // Global pipes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global filters
  app.useGlobalFilters(new HttpExceptionFilter());

  // Global interceptors
  app.useGlobalInterceptors(new ResponseTransformInterceptor(), new LoggingInterceptor());

  // ── Bull Board UI (/admin/queues) ─────────────────────────────────────────
  // Protected by basic auth in production; accessible to SaaS admins
  try {
    const jobsService = app.get(JobsService);
    const serverAdapter = new ExpressAdapter();
    serverAdapter.setBasePath('/admin/queues');

    createBullBoard({
      queues: [
        new BullMQAdapter(jobsService.notificationsQueue),
        new BullMQAdapter(jobsService.schedulerQueue),
        new BullMQAdapter(jobsService.cleanupQueue),
      ],
      serverAdapter,
    });

    app.use('/admin/queues', serverAdapter.getRouter());
    logger.log('📊 Bull Board mounted at /admin/queues');
  } catch (err) {
    logger.warn(`Bull Board could not be mounted: ${(err as Error).message}`);
  }

  // Start server
  const port = configService.get<number>('APP_PORT', 4000);
  await app.listen(port);
  logger.log(`🚀 ClosetRent API running on http://localhost:${port}/api/v1`);
}

bootstrap();
