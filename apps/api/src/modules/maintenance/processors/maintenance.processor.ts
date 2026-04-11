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
import { EventType } from '../../notifications/notifications.constants'

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
            event: EventType.OS_UNASSIGNED_ALERT,
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
            event: EventType.PREVENTIVE_GENERATED,
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
    // Job: verifica equipamentos com garantia vencendo
    // ─────────────────────────────────────────
    @Process(MAINTENANCE_JOBS.CHECK_WARRANTY_EXPIRING)
    async handleCheckWarrantyExpiring(job: Job<{ daysAhead?: number }>) {
        const daysAhead = job.data.daysAhead ?? 30
        this.logger.log(`Verificando garantias que vencem nos próximos ${daysAhead} dias`)

        const equipment = await this.maintenanceService.getEquipmentWithExpiringWarranty(daysAhead)

        if (equipment.length === 0) {
            this.logger.log('Nenhuma garantia vencendo no período')
            return { fired: 0 }
        }

        const today = new Date()
        today.setHours(0, 0, 0, 0)

        await Promise.all(
            equipment.map(async (eq) => {
                const warrantyEnd = eq.warrantyEnd!
                const daysRemaining = Math.ceil(
                    (warrantyEnd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
                )

                await this.notificationsService.notify({
                    event: EventType.EQUIPMENT_WARRANTY_EXPIRING,
                    companyId: eq.companyId,
                    data: {
                        equipmentName: eq.name,
                        brand:         eq.brand ?? '',
                        model:         eq.model ?? '',
                        warrantyEnd:   warrantyEnd.toLocaleDateString('pt-BR'),
                        daysRemaining,
                        clientName:    '',
                    },
                })
            }),
        )

        this.logger.log(`Disparado alerta de garantia para ${equipment.length} equipamento(s)`)
        return { fired: equipment.length }
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