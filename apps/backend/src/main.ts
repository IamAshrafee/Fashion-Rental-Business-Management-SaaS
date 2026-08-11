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
import type { NextFunction, Request, Response } from 'express';
import { timingSafeEqual } from 'crypto';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  // Global prefix
  app.setGlobalPrefix('api/v1');

  // CORS — allow *.localhost subdomains in development
  const corsOrigins = configService.get<string>('CORS_ORIGINS', 'http://localhost:3000');
  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Allow requests with no origin (server-to-server, same-origin, curl)
      if (!origin) return callback(null, true);

      // Development: allow any *.localhost origin (subdomain testing)
      if (/^https?:\/\/([\w-]+\.)?localhost(:\d+)?$/.test(origin)) {
        return callback(null, true);
      }

      // Development: allow hosts-file custom domains (e.g., rentbysara.local)
      if (/^https?:\/\/[\w-]+\.local(:\d+)?$/.test(origin)) {
        return callback(null, true);
      }

      // Production: check against configured CORS_ORIGINS
      const allowed = corsOrigins.split(',').map((o) => o.trim());
      if (allowed.includes(origin)) return callback(null, true);

      // Also allow any subdomain of configured origins (*.closetrent.com)
      const isSubdomainOfAllowed = allowed.some((allowedOrigin) => {
        try {
          const allowedHost = new URL(allowedOrigin).hostname;
          const originHost = new URL(origin).hostname;
          return originHost.endsWith(`.${allowedHost}`);
        } catch {
          return false;
        }
      });
      if (isSubdomainOfAllowed) return callback(null, true);

      callback(new Error(`CORS: origin ${origin} not allowed`));
    },
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
        new BullMQAdapter(jobsService.fulfillmentQueue),
        new BullMQAdapter(jobsService.notificationsQueue),
        new BullMQAdapter(jobsService.schedulerQueue),
        new BullMQAdapter(jobsService.cleanupQueue),
      ],
      serverAdapter,
    });

    if (configService.get('nodeEnv') === 'production') {
      const expectedUser = configService.getOrThrow<string>('operations.queueUsername');
      const expectedPassword = configService.getOrThrow<string>('operations.queuePassword');
      app.use('/admin/queues', (request: Request, response: Response, next: NextFunction) => {
        const [scheme, encoded] = (request.headers.authorization || '').split(' ');
        const [username, password] = scheme === 'Basic' && encoded
          ? Buffer.from(encoded, 'base64').toString('utf8').split(':', 2)
          : ['', ''];
        const matches = (left: string, right: string) => {
          const leftBuffer = Buffer.from(left);
          const rightBuffer = Buffer.from(right);
          return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
        };
        if (!matches(username, expectedUser) || !matches(password, expectedPassword)) {
          response.setHeader('WWW-Authenticate', 'Basic realm="ClosetRent operations"');
          response.status(401).send('Authentication required');
          return;
        }
        next();
      });
    }
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
