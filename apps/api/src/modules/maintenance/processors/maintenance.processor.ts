import {
    Processor,
    Process,
    OnQueueFailed,
    OnQueueCompleted,
} from '@nestjs/bull'
import { Logger } from '@nestjs/common'
import type { Job } from 'bull'
import {
    MaintenanceService,
    MAINTENANCE_QUEUE,
    MAINTENANCE_JOBS,
} from '../maintenance.service'
import { NotificationsService } from '../../notifications/notifications.service'
import { NOTIFICATION_EVENTS } from '../../notifications/notifications.constants'

@Processor(MAINTENANCE_QUEUE)
export class MaintenanceProcessor {
    private readonly logger = new Logger(MaintenanceProcessor.name)

    constructor(
        private readonly maintenanceService: MaintenanceService,
        private readonly notificationsService: NotificationsService,
    ) { }

    // ─────────────────────────────────────────
    // Job: gera OS preventivas para schedules vencidos
    // ─────────────────────────────────────────
    @Process(MAINTENANCE_JOBS.GENERATE_PREVENTIVE)
    async handleGeneratePreventive(job: Job) {
        this.logger.log(`Processando job: ${job.id} — Gerando OS preventivas`)

        const generated = await this.maintenanceService.generatePreventiveOrders()

        this.logger.log(`Job ${job.id} concluído — ${generated} OS gerada(s)`)

        return { generated }
    }

    // ─────────────────────────────────────────
    // Job: envia alerta de OS sem assumir
    // ─────────────────────────────────────────
    @Process(MAINTENANCE_JOBS.SEND_UNASSIGNED_ALERT)
    async handleUnassignedAlert(
        job: Job<{
            serviceOrderId: string
            number: number
            title: string
            companyId: string
            groupId: string | null
            hoursWaiting: number
        }>,
    ) {
        const { serviceOrderId, number, title, companyId, groupId, hoursWaiting } = job.data

        this.logger.warn(
            `Alerta: OS #${number} "${title}" está sem técnico há ${hoursWaiting}h`,
        )

        await this.notificationsService.notify({
            event: NOTIFICATION_EVENTS.OS_UNASSIGNED_ALERT,
            companyId,
            serviceOrderId,
            data: {
                osNumber: number,
                osTitle: title,
                groupId,
                hoursWaiting,
            },
        })

        return { notified: true }
    }

    // ─────────────────────────────────────────
    // Job: notifica sobre preventiva gerada
    // ─────────────────────────────────────────
    @Process('notify-preventive-generated')
    async handleNotifyPreventiveGenerated(
        job: Job<{
            scheduleId: string
            companyId: string
            osId: string
            osNumber: number
            equipmentName: string
            groupId: string | null
        }>,
    ) {
        const { companyId, osId, osNumber, equipmentName, groupId, scheduleId } = job.data

        this.logger.log(
            `Notificando geração de preventiva — Schedule: ${scheduleId} | OS #${osNumber}`,
        )

        await this.notificationsService.notify({
            event: NOTIFICATION_EVENTS.PREVENTIVE_GENERATED,
            companyId,
            serviceOrderId: osId,
            data: {
                osNumber,
                equipmentName,
                groupId,
            },
        })

        return { notified: true }
    }

    // ─────────────────────────────────────────
    // Handlers de eventos da fila
    // ─────────────────────────────────────────
    @OnQueueFailed()
    onFailed(job: Job, error: Error) {
        this.logger.error(
            `Job falhou: ${job.name} (id: ${job.id}) | ` +
            `Tentativa: ${job.attemptsMade} | Erro: ${error.message}`,
        )
    }

    @OnQueueCompleted()
    onCompleted(job: Job, result: any) {
        this.logger.debug(
            `Job concluído: ${job.name} (id: ${job.id}) | Resultado: ${JSON.stringify(result)}`,
        )
    }
}