import 'reflect-metadata';
import 'dotenv/config';
import { Module, Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { randomUUID } from 'node:crypto';
import { Db, AuthGuard, TenantGuard, Errors, config, checkConfig, rateLimit } from './core';
import { AuthController } from './auth';
import { WorkspacesController, WorkspaceSettingsController } from './workspaces';
import { ResourcesController } from './resources';
import { PublicController, LearningController } from './public';
import { Storage, FilesController } from './storage';
import { CoursesController } from './courses';
import {
  Payments,
  CheckoutController,
  CommerceController,
  StripeWebhookController,
} from './payments';
import {
  Instagram,
  IntegrationsController,
  InstagramCallbackController,
  MetaWebhookController,
} from './instagram';
import { AdminController } from './admin';
@Controller('health')
class HealthController {
  constructor(private db: Db) {}
  @Get() async health() {
    try {
      await this.db.$queryRaw`SELECT 1`;
      return { status: 'ok', service: 'creatorflow-api' };
    } catch {
      throw new ServiceUnavailableException('Database unavailable');
    }
  }
}
@Module({
  controllers: [
    HealthController,
    AuthController,
    WorkspacesController,
    WorkspaceSettingsController,
    ResourcesController,
    PublicController,
    LearningController,
    FilesController,
    CoursesController,
    CheckoutController,
    CommerceController,
    StripeWebhookController,
    IntegrationsController,
    InstagramCallbackController,
    MetaWebhookController,
    AdminController,
  ],
  providers: [Db, AuthGuard, TenantGuard, Storage, Payments, Instagram],
})
export class AppModule {}
export async function createApp() {
  checkConfig();
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
    logger: process.env.NODE_ENV === 'test' ? false : ['error', 'warn', 'log'],
  });
  app.setGlobalPrefix('api');
  app.use(helmet());
  app.use(cookieParser());
  app.useGlobalFilters(new Errors());
  app.use((req: any, res: any, next: any) => {
    res.setHeader('x-request-id', randomUUID());
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    const start = Date.now();
    res.on('finish', () =>
      console.log(
        JSON.stringify({
          level: 'info',
          method: req.method,
          status: res.statusCode,
          ms: Date.now() - start,
          requestId: res.getHeader('x-request-id'),
        }),
      ),
    );
    if (req.path.startsWith('/api/webhooks/')) return next();
    rateLimit(`http:${req.ip}`, 300, 60)
      .then(() => next())
      .catch((e) => res.status(e.getStatus?.() || 503).json({ error: { message: e.message } }));
  });
  app.enableShutdownHooks();
  if (!config.production) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('CreatorFlow API')
        .setVersion('0.1.0')
        .addCookieAuth('cf_session')
        .build(),
    );
    SwaggerModule.setup('api/docs', app, document);
  }
  await app.init();
  return app;
}
if (require.main === module)
  createApp().then((app) => app.listen(config.port, process.env.API_HOST || '127.0.0.1'));
