import './instrument';
import 'reflect-metadata';

// На Windows-консолях (cmd/PowerShell) кодировка по умолчанию — cp866/cp1251,
// поэтому UTF-8 байты от Node.js выводятся как кракозябры (╨┐╨╡╤А...).
// Принудительно переключаем active code page на 65001 (UTF-8) при старте API,
// чтобы кириллица в логах читалась без `chcp 65001` вручную каждый раз.
// На Linux/Mac/контейнерах эта ветка не выполняется — там UTF-8 по умолчанию.
if (process.platform === 'win32') {
  try {
    // stdio: 'ignore' подавляет вывод chcp («Active code page: 65001»),
    // чтобы он не засорял старт-логи Nest.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('child_process').execSync('chcp 65001', { stdio: 'ignore' });
  } catch {
    // Не критично, если не удалось. Логи будут с кракозябрами, но API работает.
  }
}

import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Logger as PinoLogger } from 'nestjs-pino';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import basicAuth from 'express-basic-auth';
import { join } from 'path';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { AuthService } from './modules/auth/auth.service';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });

  app.useLogger(app.get(PinoLogger));

  const config = app.get(ConfigService);
  const port = config.get<number>('PORT', 3001);
  const webUrl = config.get<string>('WEB_URL', 'http://localhost:5173');
  const isProduction = config.get<string>('NODE_ENV') === 'production';

  // Hard-fail на дефолтных секретах в продакшене.
  // Если разработчик забыл переопределить JWT-секреты в .env — приложение
  // не должно подняться с дефолтами «change-me-in-production-*», иначе токены
  // будут подделываться кем угодно.
  if (isProduction) {
    const accessSecret = config.get<string>('JWT_ACCESS_SECRET') ?? '';
    const refreshSecret = config.get<string>('JWT_REFRESH_SECRET') ?? '';
    const isDefaultSecret = (s: string) => /change-?me|default|please.?change/i.test(s);
    if (!accessSecret || isDefaultSecret(accessSecret)) {
      throw new Error(
        'JWT_ACCESS_SECRET в production должен быть задан (длинная случайная строка). ' +
          'Сгенерируйте: `openssl rand -hex 64` и положите в .env.',
      );
    }
    if (!refreshSecret || isDefaultSecret(refreshSecret)) {
      throw new Error(
        'JWT_REFRESH_SECRET в production должен быть задан (длинная случайная строка). ' +
          'Сгенерируйте: `openssl rand -hex 64` и положите в .env.',
      );
    }
    if (accessSecret.length < 32 || refreshSecret.length < 32) {
      throw new Error('JWT секреты слишком короткие (минимум 32 символа в production).');
    }
  }

  // Если в .env стоит EMAIL_VERIFICATION_REQUIRED=true — приложение не
  // запустится без настроенного SMTP. Защита от случайного деплоя на прод
  // в bypass-режиме (без email-верификации регистрация была бы без проверки
  // email, а сброс пароля API уже отбивает с 503 — но лучше упасть на старте,
  // чем работать в усечённом режиме незаметно).
  const requireEmailVerification = config.get<string>('EMAIL_VERIFICATION_REQUIRED') === 'true';
  if (requireEmailVerification) {
    const auth = app.get(AuthService);
    if (!(await auth.isEmailVerificationEnabled())) {
      throw new Error(
        'EMAIL_VERIFICATION_REQUIRED=true, но SMTP не настроен. ' +
          'Заполните SMTP-настройки через админку (Настройки → Уведомления), ' +
          'либо уберите EMAIL_VERIFICATION_REQUIRED из .env для dev-режима без SMTP.',
      );
    }
  }

  app.set('trust proxy', 1);

  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  app.use(cookieParser());
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: isProduction ? undefined : false,
    }),
  );

  app.enableCors({
    origin: webUrl,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());

  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads/',
    maxAge: isProduction ? '7d' : 0,
  });

  const swaggerUser = config.get<string>('SWAGGER_USER');
  const swaggerPassword = config.get<string>('SWAGGER_PASSWORD');
  if (isProduction && swaggerUser && swaggerPassword) {
    app.use(
      ['/api/docs', '/api/docs-json'],
      basicAuth({
        challenge: true,
        users: { [swaggerUser]: swaggerPassword },
      }),
    );
  }

  if (!isProduction || (swaggerUser && swaggerPassword)) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('RentHub API')
      .setDescription('Платформа для онлайн-аренды оборудования')
      .setVersion('1.0')
      .addCookieAuth('access_token')
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }

  app.enableShutdownHooks();

  await app.listen(port);

  const logger = app.get(PinoLogger);
  logger.log(`🚀 RentHub API готов: http://localhost:${port}/api`, 'Bootstrap');
  logger.log(`💚 Health: http://localhost:${port}/api/v1/health`, 'Bootstrap');
  if (!isProduction || (swaggerUser && swaggerPassword)) {
    logger.log(`📖 Swagger: http://localhost:${port}/api/docs`, 'Bootstrap');
  }

  // Предупреждение если SMTP не настроен — фронт в этом случае пропускает
  // шаги верификации email при регистрации и сбросе пароля. Это удобно для
  // разработки, но НЕбезопасно для прода.
  const auth = app.get(AuthService);
  if (!(await auth.isEmailVerificationEnabled())) {
    logger.warn('[AUTH] ⚠️  SMTP не настроен — Email верификация отключена.', 'Bootstrap');
  }
}

bootstrap().catch((err) => {
  console.error('Не удалось запустить приложение:', err);
  process.exit(1);
});
