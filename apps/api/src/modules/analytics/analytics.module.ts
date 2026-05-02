import { Module } from '@nestjs/common'
import { AnalyticsController } from './analytics.controller'
import { AnalyticsEquipmentService } from './services/analytics-equipment.service'
import { AnalyticsOsService } from './services/analytics-os.service'
import { AnalyticsPreventiveService } from './services/analytics-preventive.service'
import { AnalyticsFinancialService } from './services/analytics-financial.service'

@Module({
  controllers: [AnalyticsController],
  providers: [
    AnalyticsEquipmentService,
    AnalyticsOsService,
    AnalyticsPreventiveService,
    AnalyticsFinancialService,
  ],
})
export class AnalyticsModule {}
