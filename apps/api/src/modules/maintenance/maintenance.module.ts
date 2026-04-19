import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bull'
import { MaintenanceService, MAINTENANCE_QUEUE } from './maintenance.service'
import { MaintenanceController, ScheduleController, CompanyScheduleController } from './maintenance.controller'
import { MaintenanceProcessor } from './processors/maintenance.processor'
import { MaintenanceCronJobs } from './schedule/maintenance-cron.jobs'
import { NotificationsModule } from '../notifications/notifications.module'

@Module({
    imports: [
        // Registra a fila no Redis via Bull
        BullModule.registerQueue({ name: MAINTENANCE_QUEUE }),
        NotificationsModule,
    ],
    controllers: [
        MaintenanceController,
        CompanyScheduleController,
        ScheduleController,
    ],
    providers: [
        MaintenanceService,
        MaintenanceProcessor,  // Processa os jobs da fila
        MaintenanceCronJobs,   // Dispara os cron jobs
    ],
    exports: [MaintenanceService],
})
export class MaintenanceModule { }