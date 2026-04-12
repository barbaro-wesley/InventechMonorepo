import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { APP_GUARD, APP_FILTER } from '@nestjs/core'
import { BullModule } from '@nestjs/bull'
import { ScheduleModule } from '@nestjs/schedule'

import {
  appConfig, databaseConfig, redisConfig,
  minioConfig, mailConfig, telegramConfig,
} from './config'

import { RedisModule } from './common/providers/redis.module'
import { PrismaModule } from './prisma/prisma.module'
import { AuthModule } from './modules/auth/auth.module'
import { UsersModule } from './modules/users/users.module'
import { CompaniesModule } from './modules/companies/companies.module'
import { ClientsModule } from './modules/clients/clients.module'
import { EquipmentModule } from './modules/equipment/equipment.module'
import { MaintenanceGroupsModule } from './modules/maintenance-groups/maintenance-groups.module'
import { ServiceOrdersModule } from './modules/service-orders/service-orders.module'
import { MaintenanceModule } from './modules/maintenance/maintenance.module'
import { StorageModule } from './modules/storage/storage.module'
import { NotificationsModule } from './modules/notifications/notifications.module'
import { DashboardModule } from './modules/dashboard/dashboard.module'
import { HealthModule } from './modules/health/health.module'
import { ReportsModule } from './modules/reports/reports.module'
import { PermissionsModule } from './modules/permissions/permissions.module'
import { AlertRulesModule } from './modules/alert-rules/alert-rules.module'

import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard'
import { RateLimitGuard } from './common/guards/rate-limit.guard'
import { PermissionGuard } from './common/guards/permission.guard'
import { GlobalExceptionFilter } from './common/filters/http-exception.filter'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      load: [appConfig, databaseConfig, redisConfig, minioConfig, mailConfig, telegramConfig],
    }),

    ScheduleModule.forRoot(),

    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        redis: {
          host: configService.get('redis.host'),
          port: configService.get<number>('redis.port'),
          password: configService.get('redis.password'),
          db: configService.get<number>('redis.db'),
        },
        prefix: 'manutencao',
      }),
      inject: [ConfigService],
    }),

    // RedisModule é @Global() — cliente Redis disponível em todos os módulos
    RedisModule,
    // PrismaModule é @Global() — disponível em todos os módulos
    PrismaModule,
    AuthModule,
    UsersModule,
    CompaniesModule,
    ClientsModule,
    EquipmentModule,
    MaintenanceGroupsModule,
    ServiceOrdersModule,
    MaintenanceModule,
    StorageModule,
    NotificationsModule,
    DashboardModule,
    HealthModule,
    ReportsModule,
    PermissionsModule,
    AlertRulesModule,
  ],
  providers: [
    // ─── Ordem dos guards é crítica ──────────────────────────────
    // 1. JWT autentica e popula request.user
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // 2. Rate limit (não depende de request.user)
    { provide: APP_GUARD, useClass: RateLimitGuard },
    // 3. Permission guard — resolve @Permission e @Roles (legado)
    { provide: APP_GUARD, useClass: PermissionGuard },
    // ─── Filtro global de exceções ────────────────────────────────
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
  ],
})
export class AppModule { }