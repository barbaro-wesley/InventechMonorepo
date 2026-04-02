import { Module } from '@nestjs/common'
import { ReportsService } from './reports.service'
import { ReportsController } from './reports.controller'
import { ReportPermissionsService } from './report-permissions.service'
import { TenantsModule } from '../tenants/tenants.module'

@Module({
  imports: [TenantsModule],
  controllers: [ReportsController],
  providers: [ReportsService, ReportPermissionsService],
  exports: [ReportPermissionsService],
})
export class ReportsModule { }