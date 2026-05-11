import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { CacheModule } from '@nestjs/cache-manager';
import { LoggerModule } from 'nestjs-pino';
import { createKeyv } from '@keyv/redis';
import { CacheableMemory } from 'cacheable';
import { Keyv } from 'cacheable';
import { PrismaModule } from './common/prisma/prisma.module';
import { CryptoModule } from './common/crypto/crypto.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { EquipmentModule } from './modules/equipment/equipment.module';
import { ClientsModule } from './modules/clients/clients.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PricingModule } from './modules/pricing/pricing.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { SchedulerModule } from './modules/scheduler/scheduler.module';
import { WarehouseModule } from './modules/warehouse/warehouse.module';
import { CartModule } from './modules/cart/cart.module';
import { MeModule } from './modules/me/me.module';
import { HealthModule } from './modules/health/health.module';
import { LegalModule } from './modules/legal/legal.module';
import { OrgSettingsModule } from './modules/org-settings/org-settings.module';
import { EmailTemplatesModule } from './modules/email-templates/email-templates.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { buildLoggerConfig } from './common/logger/logger.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../.env', '.env'],
    }),
    LoggerModule.forRoot(buildLoggerConfig()),
    ScheduleModule.forRoot(),
    // В dev лимиты в 10× выше — иначе hot-reload и React strict-mode (двойные
    // запросы) бьют по throttler-у и блокируют разработку. В prod остаются строгие.
    ThrottlerModule.forRoot(
      process.env.NODE_ENV === 'development'
        ? [
            { name: 'default', ttl: 60_000, limit: 1200 },
            { name: 'auth', ttl: 60_000, limit: 100 },
          ]
        : [
            { name: 'default', ttl: 60_000, limit: 120 },
            { name: 'auth', ttl: 60_000, limit: 10 },
          ],
    ),
    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: () => {
        const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6380';
        return {
          stores: [
            new Keyv({
              store: new CacheableMemory({ ttl: 60_000, lruSize: 5000 }),
            }),
            createKeyv(redisUrl),
          ],
        };
      },
    }),
    PrismaModule,
    CryptoModule,
    AuthModule,
    UsersModule,
    CategoriesModule,
    EquipmentModule,
    ClientsModule,
    OrdersModule,
    PricingModule,
    AnalyticsModule,
    NotificationsModule,
    UploadsModule,
    SchedulerModule,
    WarehouseModule,
    CartModule,
    MeModule,
    HealthModule,
    LegalModule,
    OrgSettingsModule,
    EmailTemplatesModule,
    PaymentsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
