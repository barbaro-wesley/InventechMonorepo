import { Module } from '@nestjs/common'
import { AnalyticsController } from './analytics.controller'
import { AnalyticsEquipmentService } from './services/analytics-equipment.service'
import { AnalyticsOsService } from './services/analytics-os.service'
import { AnalyticsPreventiveService } from './services/analytics-preventive.service'
import { AnalyticsFinancialService } from './services/analytics-financial.service'
import { AnalyticsProvidersService } from './services/analytics-providers.service'

@Module({
  controllers: [AnalyticsController],
  providers: [
    AnalyticsEquipmentService,
    AnalyticsOsService,
    AnalyticsPreventiveService,
    AnalyticsFinancialService,
    AnalyticsProvidersService,
  ],
})
export class AnalyticsModule {}
